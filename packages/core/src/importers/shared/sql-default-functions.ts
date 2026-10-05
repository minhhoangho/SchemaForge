import type { SqlDialect } from "../../generators/shared/generator-types.js";
import { toNameKey } from "../../model/name-limits.js";
import type { SqlToken } from "../sql/sql-lexer.js";

export type DefaultFunctionResult =
  "currentTimestamp" | "generateUuid" | "approximateUuid" | "sequence";

type DefaultFunction = {
  readonly result: DefaultFunctionResult;
  readonly dialects: readonly SqlDialect[];
  // A keyword such as CURRENT_TIMESTAMP is also written without parentheses.
  readonly isKeyword: boolean;
  // precision: no argument or one fractional seconds precision.
  readonly args: "none" | "precision" | "any";
};

const ALL_DIALECTS: readonly SqlDialect[] = [
  "postgresql",
  "mysql",
  "sqlserver",
];

// The expression rows of the default table, import / export spec section 5.
const DEFAULT_FUNCTIONS: ReadonlyMap<string, DefaultFunction> = new Map([
  [
    "now",
    {
      result: "currentTimestamp",
      dialects: ["postgresql", "mysql"],
      isKeyword: false,
      args: "precision",
    },
  ],
  [
    "current_timestamp",
    {
      result: "currentTimestamp",
      dialects: ALL_DIALECTS,
      isKeyword: true,
      args: "precision",
    },
  ],
  [
    "localtimestamp",
    {
      result: "currentTimestamp",
      dialects: ["postgresql", "mysql"],
      isKeyword: true,
      args: "precision",
    },
  ],
  [
    "sysdatetime",
    {
      result: "currentTimestamp",
      dialects: ["sqlserver"],
      isKeyword: false,
      args: "none",
    },
  ],
  [
    "sysdatetimeoffset",
    {
      result: "currentTimestamp",
      dialects: ["sqlserver"],
      isKeyword: false,
      args: "none",
    },
  ],
  [
    "getdate",
    {
      result: "currentTimestamp",
      dialects: ["sqlserver"],
      isKeyword: false,
      args: "none",
    },
  ],
  [
    "getutcdate",
    {
      result: "currentTimestamp",
      dialects: ["sqlserver"],
      isKeyword: false,
      args: "none",
    },
  ],
  [
    "gen_random_uuid",
    {
      result: "generateUuid",
      dialects: ["postgresql"],
      isKeyword: false,
      args: "none",
    },
  ],
  [
    "uuid_generate_v4",
    {
      result: "generateUuid",
      dialects: ["postgresql"],
      isKeyword: false,
      args: "none",
    },
  ],
  [
    "uuid",
    {
      result: "generateUuid",
      dialects: ["mysql"],
      isKeyword: false,
      args: "none",
    },
  ],
  [
    "newid",
    {
      result: "generateUuid",
      dialects: ["sqlserver"],
      isKeyword: false,
      args: "none",
    },
  ],
  [
    "newsequentialid",
    {
      result: "approximateUuid",
      dialects: ["sqlserver"],
      isKeyword: false,
      args: "none",
    },
  ],
  [
    "nextval",
    {
      result: "sequence",
      dialects: ["postgresql"],
      isKeyword: false,
      args: "any",
    },
  ],
]);

export function isSqlSymbol(
  token: SqlToken | undefined,
  symbol: string,
): boolean {
  return token?.kind === "symbol" && token.text === symbol;
}

// tokens must be one parenthesized list whose `)` closes the first `(`.
function hasAcceptedArguments(
  tokens: readonly SqlToken[],
  accepted: DefaultFunction["args"],
): boolean {
  const open = tokens[0];
  if (
    open === undefined ||
    !isSqlSymbol(open, "(") ||
    !isSqlSymbol(tokens.at(-1), ")")
  ) {
    return false;
  }
  const inside = tokens.slice(1, -1);
  if (!inside.every((token) => token.depth > open.depth)) {
    return false;
  }
  switch (accepted) {
    case "none":
      return inside.length === 0;
    case "precision":
      return (
        inside.length === 0 ||
        (inside.length === 1 && inside[0]?.kind === "number")
      );
    case "any":
      return inside.length > 0;
    default: {
      const unreachable: never = accepted;
      return unreachable;
    }
  }
}

/**
 * Finds a default function the model knows in a normalized expression. A
 * schema qualifier is skipped: pg_dump writes `public.uuid_generate_v4()`.
 */
export function findDefaultFunction(
  tokens: readonly SqlToken[],
  dialect: SqlDialect | "any",
): DefaultFunctionResult | null {
  const isQualified = tokens[0]?.kind === "word" && isSqlSymbol(tokens[1], ".");
  const [name, ...rest] = isQualified ? tokens.slice(2) : tokens;
  if (name?.kind !== "word") {
    return null;
  }
  const known = DEFAULT_FUNCTIONS.get(toNameKey(name.text));
  if (
    known === undefined ||
    (dialect !== "any" && !known.dialects.includes(dialect))
  ) {
    return null;
  }
  const isAccepted =
    rest.length === 0
      ? known.isKeyword
      : hasAcceptedArguments(rest, known.args);
  return isAccepted ? known.result : null;
}
