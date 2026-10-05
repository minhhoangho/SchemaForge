import type { RawSqlDefault } from "../shared/sql-default-mapping.js";
import type { SqlStatement } from "./statement-scanner.js";
import {
  findAlterTableAction,
  isNameAt,
  isSymbolAt,
  wordAt,
  type Tokens,
} from "./sql-token-reading.js";

export type PostgresqlAlterColumn = {
  readonly tableName: string;
  readonly columnName: string;
  readonly start: number;
  readonly change:
    | { readonly kind: "identity" }
    | { readonly kind: "default"; readonly raw: RawSqlDefault };
};

type Change = PostgresqlAlterColumn["change"];

const BOOLEAN_WORDS: ReadonlySet<string> = new Set(["TRUE", "FALSE"]);

// `ADD GENERATED {ALWAYS | BY DEFAULT} AS IDENTITY [( … )]` up to the end.
function readIdentity(tokens: Tokens, index: number): Change | null {
  const generated =
    wordAt(tokens, index) === "ADD" && wordAt(tokens, index + 1) === "GENERATED"
      ? index + 2
      : null;
  if (generated === null) {
    return null;
  }
  const when = wordAt(tokens, generated);
  const isByDefault =
    when === "BY" && wordAt(tokens, generated + 1) === "DEFAULT";
  const asIndex =
    when === "ALWAYS" ? generated + 1 : isByDefault ? generated + 2 : -1;
  const isIdentity =
    wordAt(tokens, asIndex) === "AS" &&
    wordAt(tokens, asIndex + 1) === "IDENTITY";
  // The sequence options in parentheses are dropped with the sequence; the
  // closing parenthesis has depth 0 like the opening one.
  const rest = tokens.slice(asIndex + 2);
  const hasOnlyOptions =
    rest.length === 0 ||
    (isSymbolAt(rest, 0, "(") &&
      rest.findIndex((token, index) => index > 0 && token.depth === 0) ===
        rest.length - 1);
  return isIdentity && hasOnlyOptions ? { kind: "identity" } : null;
}

// Rebuilds the source text of the tokens, with a space for each character
// between them (comments and line breaks become spaces).
function tokensText(tokens: Tokens): string {
  const first = tokens[0]?.start ?? 0;
  let text = "";
  for (const token of tokens) {
    text += " ".repeat(token.start - first - text.length) + token.text;
  }
  return text;
}

function toRawDefault(tokens: Tokens): RawSqlDefault {
  const [token, extra] = tokens;
  const text = tokensText(tokens);
  if (token === undefined || extra !== undefined) {
    return { kind: "expression", text };
  }
  if (token.kind === "string" && token.text.startsWith("'")) {
    // mapSqlDefault takes the content between the quotes, still escaped.
    return { kind: "string", text: token.text.slice(1, -1) };
  }
  if (token.kind === "number") {
    return { kind: "number", text };
  }
  const isBoolean = BOOLEAN_WORDS.has(wordAt(tokens, 0) ?? "");
  return { kind: isBoolean ? "boolean" : "expression", text };
}

// `SET DEFAULT <expression>` up to the end, with no second action after it.
function readDefault(tokens: Tokens, index: number): Change | null {
  const isSetDefault =
    wordAt(tokens, index) === "SET" && wordAt(tokens, index + 1) === "DEFAULT";
  const expression = tokens.slice(index + 2);
  const hasSecondAction = expression.some(
    (token, position) =>
      token.depth === 0 && isSymbolAt(expression, position, ","),
  );
  return isSetDefault && expression.length > 0 && !hasSecondAction
    ? { kind: "default", raw: toRawDefault(expression) }
    : null;
}

/**
 * Reads PostgreSQL `ALTER TABLE [ONLY] [schema.]t ALTER [COLUMN] c` followed
 * by `ADD GENERATED … AS IDENTITY …` or `SET DEFAULT …`, as pg_dump writes for
 * identity and serial columns; null for any other statement.
 */
export function readPostgresqlAlterColumn(
  statement: SqlStatement,
): PostgresqlAlterColumn | null {
  const { tokens } = statement;
  if (wordAt(tokens, 0) !== "ALTER" || wordAt(tokens, 1) !== "TABLE") {
    return null;
  }
  const action = findAlterTableAction(tokens);
  if (wordAt(tokens, action.index) !== "ALTER" || action.tableName === "") {
    return null;
  }
  const nameIndex =
    wordAt(tokens, action.index + 1) === "COLUMN"
      ? action.index + 2
      : action.index + 1;
  const columnName = tokens[nameIndex]?.value;
  if (!isNameAt(tokens, nameIndex) || columnName === undefined) {
    return null;
  }
  const change =
    readIdentity(tokens, nameIndex + 1) ?? readDefault(tokens, nameIndex + 1);
  return change === null
    ? null
    : {
        tableName: action.tableName,
        columnName,
        start: statement.start,
        change,
      };
}
