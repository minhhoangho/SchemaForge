import type { SqlDialect } from "../../generators/shared/generator-types.js";
import type { SqlStatement, SqlToken } from "./statement-scanner.js";

export type StatementKind =
  | "parser"
  | "postgresqlAlterColumn"
  | "sqlserverExtendedProperty"
  | "ignored"
  | "data"
  | "view"
  | "routine"
  | "trigger"
  | "sequence"
  | "unsupported";

type Tokens = readonly SqlToken[];

type FirstWordRule =
  StatementKind | ((tokens: Tokens, dialect: SqlDialect) => StatementKind);

// The kind of statement that each object keyword after CREATE introduces.
// TYPE depends on `AS ENUM` and is handled on its own.
const CREATE_OBJECT_KINDS: ReadonlyMap<string, StatementKind> = new Map<
  string,
  StatementKind
>([
  ["TABLE", "parser"],
  ["INDEX", "parser"],
  ["VIEW", "view"],
  ["FUNCTION", "routine"],
  ["PROCEDURE", "routine"],
  ["PROC", "routine"],
  ["TRIGGER", "trigger"],
  ["SEQUENCE", "sequence"],
  ["DATABASE", "ignored"],
  ["SCHEMA", "ignored"],
  ["EXTENSION", "ignored"],
]);

// Words that may stand between CREATE and the object keyword: `OR REPLACE`,
// `OR ALTER`, index options, and the `ALGORITHM=…`, `DEFINER=…` and
// `SQL SECURITY …` clauses that mysqldump writes. Non-word tokens (`=`, the
// quoted definer names) are skipped.
const CREATE_MODIFIERS: ReadonlySet<string> = new Set([
  "OR",
  "REPLACE",
  "ALTER",
  "UNIQUE",
  "CLUSTERED",
  "NONCLUSTERED",
  "MATERIALIZED",
  "RECURSIVE",
  "CONSTRAINT",
  "AGGREGATE",
  "ALGORITHM",
  "UNDEFINED",
  "MERGE",
  "TEMPTABLE",
  "DEFINER",
  "CURRENT_USER",
  "SQL",
  "SECURITY",
  "INVOKER",
]);

const ALTER_TABLE_TARGET_PREFIXES: ReadonlySet<string> = new Set([
  "ONLY",
  "IF",
  "EXISTS",
]);

function wordAt(tokens: Tokens, index: number): string | null {
  const token = tokens[index];
  return token?.kind === "word" ? token.value.toUpperCase() : null;
}

function isSymbolAt(tokens: Tokens, index: number, symbol: string): boolean {
  const token = tokens[index];
  return token?.kind === "symbol" && token.text === symbol;
}

function isNameAt(tokens: Tokens, index: number): boolean {
  const kind = tokens[index]?.kind;
  return kind === "word" || kind === "quotedIdentifier";
}

function hasWordPair(tokens: Tokens, first: string, second: string): boolean {
  return tokens.some(
    (token, index) =>
      token.depth === 0 &&
      wordAt(tokens, index) === first &&
      wordAt(tokens, index + 1) === second,
  );
}

// Reads `name` or `schema.name` (quoted or not) starting at `index`.
function readQualifiedName(
  tokens: Tokens,
  index: number,
): { readonly lastName: string; readonly next: number } | null {
  if (!isNameAt(tokens, index)) {
    return null;
  }
  let last = index;
  while (isSymbolAt(tokens, last + 1, ".") && isNameAt(tokens, last + 2)) {
    last += 2;
  }
  return { lastName: tokens[last]?.value ?? "", next: last + 1 };
}

function classifyCreate(tokens: Tokens): StatementKind {
  for (const token of tokens.slice(1)) {
    if (token.kind !== "word") {
      continue;
    }
    const word = token.value.toUpperCase();
    if (word === "TYPE") {
      return hasWordPair(tokens, "AS", "ENUM") ? "parser" : "unsupported";
    }
    const kind = CREATE_OBJECT_KINDS.get(word);
    if (kind !== undefined || !CREATE_MODIFIERS.has(word)) {
      return kind ?? "unsupported";
    }
  }
  return "unsupported";
}

// Returns the index of the first action token of `ALTER TABLE [IF EXISTS]
// [ONLY] name [*] [WITH {CHECK | NOCHECK}] …`.
function findAlterTableAction(tokens: Tokens): number {
  let index = 2;
  while (ALTER_TABLE_TARGET_PREFIXES.has(wordAt(tokens, index) ?? "")) {
    index += 1;
  }
  index = readQualifiedName(tokens, index)?.next ?? index;
  index += isSymbolAt(tokens, index, "*") ? 1 : 0;
  const isWithCheck =
    wordAt(tokens, index) === "WITH" &&
    ["CHECK", "NOCHECK"].includes(wordAt(tokens, index + 1) ?? "");
  return isWithCheck ? index + 2 : index;
}

// `ALTER [COLUMN] c ADD GENERATED …` or `ALTER [COLUMN] c SET DEFAULT …`,
// starting after the ALTER action keyword.
function isPostgresqlAlterColumn(tokens: Tokens, index: number): boolean {
  const nameIndex = wordAt(tokens, index) === "COLUMN" ? index + 1 : index;
  if (!isNameAt(tokens, nameIndex)) {
    return false;
  }
  const change = `${wordAt(tokens, nameIndex + 1) ?? ""} ${wordAt(tokens, nameIndex + 2) ?? ""}`;
  return change === "ADD GENERATED" || change === "SET DEFAULT";
}

function classifyAlterTable(
  tokens: Tokens,
  dialect: SqlDialect,
): StatementKind {
  const actionIndex = findAlterTableAction(tokens);
  const action = wordAt(tokens, actionIndex) ?? "";
  const nextWord = wordAt(tokens, actionIndex + 1);
  if (action === "ADD") {
    return "parser";
  }
  if (["DISABLE", "ENABLE"].includes(action) && nextWord === "KEYS") {
    return "data";
  }
  // SSMS writes `ALTER TABLE t [WITH CHECK] CHECK CONSTRAINT fk` after every
  // foreign key; enabling a constraint changes no model structure.
  const isSqlServerConstraintCheck =
    dialect === "sqlserver" &&
    ["CHECK", "NOCHECK"].includes(action) &&
    nextWord === "CONSTRAINT";
  if (isSqlServerConstraintCheck) {
    return "ignored";
  }
  const isAlterColumn =
    action === "ALTER" &&
    dialect === "postgresql" &&
    isPostgresqlAlterColumn(tokens, actionIndex + 1);
  return isAlterColumn ? "postgresqlAlterColumn" : "unsupported";
}

function classifyAlter(tokens: Tokens, dialect: SqlDialect): StatementKind {
  if (hasWordPair(tokens, "OWNER", "TO")) {
    return "ignored";
  }
  const object = wordAt(tokens, 1);
  if (object === "TABLE") {
    return classifyAlterTable(tokens, dialect);
  }
  if (object === "SEQUENCE") {
    return "sequence";
  }
  const databaseName =
    object === "DATABASE" ? readQualifiedName(tokens, 2) : null;
  const isDatabaseSet =
    databaseName !== null && wordAt(tokens, databaseName.next) === "SET";
  return isDatabaseSet ? "ignored" : "unsupported";
}

function classifyExec(tokens: Tokens, dialect: SqlDialect): StatementKind {
  const procedure = readQualifiedName(tokens, 1)?.lastName.toUpperCase();
  return dialect === "sqlserver" && procedure === "SP_ADDEXTENDEDPROPERTY"
    ? "sqlserverExtendedProperty"
    : "unsupported";
}

function classifyComment(tokens: Tokens): StatementKind {
  const target = wordAt(tokens, 2) ?? "";
  return wordAt(tokens, 1) === "ON" && ["TABLE", "COLUMN"].includes(target)
    ? "parser"
    : "unsupported";
}

// `SELECT pg_catalog.set_config(…)`, which pg_dump writes to set the search path.
function classifySelect(tokens: Tokens): StatementKind {
  const name = readQualifiedName(tokens, 1);
  const isSetConfig =
    name?.lastName.toUpperCase() === "SET_CONFIG" &&
    isSymbolAt(tokens, name.next, "(");
  return isSetConfig ? "ignored" : "unsupported";
}

function whenSecondWord(second: string, kind: StatementKind): FirstWordRule {
  return (tokens) => (wordAt(tokens, 1) === second ? kind : "unsupported");
}

const FIRST_WORD_RULES: ReadonlyMap<string, FirstWordRule> = new Map<
  string,
  FirstWordRule
>([
  ["CREATE", classifyCreate],
  ["ALTER", classifyAlter],
  ["EXEC", classifyExec],
  ["EXECUTE", classifyExec],
  ["COMMENT", classifyComment],
  ["SELECT", classifySelect],
  ["START", whenSecondWord("TRANSACTION", "ignored")],
  ["SET", "ignored"],
  ["USE", "ignored"],
  ["GO", "ignored"],
  ["BEGIN", "ignored"],
  ["COMMIT", "ignored"],
  ["ROLLBACK", "ignored"],
  ["DECLARE", "ignored"],
  ["GRANT", "ignored"],
  ["REVOKE", "ignored"],
  ["DROP", "ignored"],
  ["INSERT", "data"],
  ["COPY", "data"],
  ["UPDATE", "data"],
  ["DELETE", "data"],
  ["LOCK", whenSecondWord("TABLES", "data")],
  ["UNLOCK", whenSecondWord("TABLES", "data")],
]);

// Classifies a statement by its leading keywords (compared case-insensitively),
// following the statement table of spec part 7, section 5.
export function classifyStatement(
  statement: SqlStatement,
  dialect: SqlDialect,
): StatementKind {
  const rule = FIRST_WORD_RULES.get(wordAt(statement.tokens, 0) ?? "");
  if (rule === undefined) {
    return "unsupported";
  }
  return typeof rule === "string" ? rule : rule(statement.tokens, dialect);
}
