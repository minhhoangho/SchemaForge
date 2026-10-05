import type { SqlStatement } from "./statement-scanner.js";
import {
  isSymbolAt,
  readQualifiedName,
  wordAt,
  type Tokens,
} from "./sql-token-reading.js";

export type SqlServerDescription = {
  readonly tableName: string;
  readonly columnName: string | null;
  readonly description: string;
  readonly start: number;
};

type ArgumentValue =
  | { readonly kind: "string"; readonly text: string }
  | { readonly kind: "null" }
  | { readonly kind: "other" };

const PROCEDURE_NAME = "SP_ADDEXTENDEDPROPERTY";
const DESCRIPTION_PROPERTY = "MS_Description";
// The parameters of sp_addextendedproperty in positional order.
const PARAMETERS = [
  "@NAME",
  "@VALUE",
  "@LEVEL0TYPE",
  "@LEVEL0NAME",
  "@LEVEL1TYPE",
  "@LEVEL1NAME",
  "@LEVEL2TYPE",
  "@LEVEL2NAME",
] as const;
const KNOWN_PARAMETERS: ReadonlySet<string> = new Set(PARAMETERS);

function readValue(tokens: Tokens): ArgumentValue {
  const [token, extra] = tokens;
  if (token === undefined || extra !== undefined) {
    return { kind: "other" };
  }
  if (token.kind === "string") {
    return { kind: "string", text: token.value };
  }
  return wordAt(tokens, 0) === "NULL" ? { kind: "null" } : { kind: "other" };
}

// Reads the arguments into a map keyed by upper-case parameter name; null when
// an argument is unknown, repeated, or positional after a named one.
function readArguments(
  tokens: Tokens,
): ReadonlyMap<string, ArgumentValue> | null {
  const values = new Map<string, ArgumentValue>();
  let start = 0;
  let isNamed = false;
  for (let index = 0; index <= tokens.length; index += 1) {
    if (index < tokens.length && !isSymbolAt(tokens, index, ",")) {
      continue;
    }
    const argument = tokens.slice(start, index);
    start = index + 1;
    const named = isSymbolAt(argument, 1, "=") ? wordAt(argument, 0) : null;
    isNamed ||= named !== null;
    const parameter = named ?? (isNamed ? undefined : PARAMETERS[values.size]);
    if (
      parameter === undefined ||
      !KNOWN_PARAMETERS.has(parameter) ||
      values.has(parameter)
    ) {
      return null;
    }
    values.set(parameter, readValue(argument.slice(named === null ? 0 : 2)));
  }
  return values;
}

function stringOf(value: ArgumentValue | undefined): string | null {
  return value?.kind === "string" ? value.text : null;
}

function toDescription(
  values: ReadonlyMap<string, ArgumentValue>,
  start: number,
): SqlServerDescription | null {
  const description = stringOf(values.get("@VALUE"));
  const tableName = stringOf(values.get("@LEVEL1NAME"));
  const isTable =
    stringOf(values.get("@NAME")) === DESCRIPTION_PROPERTY &&
    stringOf(values.get("@LEVEL1TYPE"))?.toUpperCase() === "TABLE";
  if (!isTable || description === null || tableName === null) {
    return null;
  }
  const level2Type = values.get("@LEVEL2TYPE");
  if (level2Type === undefined || level2Type.kind === "null") {
    return { tableName, columnName: null, description, start };
  }
  const columnName = stringOf(values.get("@LEVEL2NAME"));
  return stringOf(level2Type)?.toUpperCase() === "COLUMN" && columnName !== null
    ? { tableName, columnName, description, start }
    : null;
}

/**
 * Reads a table or column description written by SQL Server Management Studio
 * as `EXEC [sys.]sp_addextendedproperty` with named or positional arguments;
 * null for any other statement or property.
 */
export function readSqlServerDescription(
  statement: SqlStatement,
): SqlServerDescription | null {
  const { tokens } = statement;
  const command = wordAt(tokens, 0);
  const procedure = readQualifiedName(tokens, 1);
  if (
    (command !== "EXEC" && command !== "EXECUTE") ||
    procedure?.lastName.toUpperCase() !== PROCEDURE_NAME
  ) {
    return null;
  }
  const values = readArguments(tokens.slice(procedure.next));
  return values === null ? null : toDescription(values, statement.start);
}
