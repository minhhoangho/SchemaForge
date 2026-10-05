import { readIndexElements } from "./sql-index-definitions.js";
import type { SqlStatement } from "./statement-scanner.js";
import {
  findAlterTableAction,
  isNameAt,
  isSymbolAt,
  readParenthesizedList,
  readQualifiedName,
  wordAt,
  type Tokens,
  type TokenRange,
} from "./sql-token-reading.js";

export type SqlColumnDefinition = {
  // The `value` of the column name token (without quotes).
  readonly name: string;
  // The offset of the column name token.
  readonly start: number;
  // The source text of the type; "" when the column declares no type (a SQL
  // Server computed column).
  readonly rawType: string;
  readonly hasOnUpdate: boolean;
  readonly hasCollation: boolean;
  readonly isComputed: boolean;
};

export type SqlUniqueConstraint = {
  readonly name: string | null;
  readonly columnNames: readonly string[];
  // The MySQL form `UNIQUE KEY | INDEX [n] (…)`.
  readonly isMysqlKey: boolean;
  // `DESC`, `NULLS …`, an operator class, `COLLATE` or a MySQL prefix length
  // on a column element.
  readonly hasDroppedElementOption: boolean;
};

export type SqlTableDefinition = {
  // Without the schema.
  readonly tableName: string;
  readonly start: number;
  readonly columns: readonly SqlColumnDefinition[];
  readonly uniqueConstraints: readonly SqlUniqueConstraint[];
};

export type SqlAddedUniqueConstraint = {
  readonly tableName: string;
  readonly start: number;
  readonly constraint: SqlUniqueConstraint;
};

/** Words that end the type of a column definition (CHARACTER only before SET). */
export const COLUMN_CONSTRAINT_WORDS: ReadonlySet<string> = new Set([
  "NOT",
  "NULL",
  "DEFAULT",
  "CONSTRAINT",
  "PRIMARY",
  "UNIQUE",
  "KEY",
  "REFERENCES",
  "CHECK",
  "COLLATE",
  "CHARSET",
  "CHARACTER",
  "GENERATED",
  "AS",
  "AUTO_INCREMENT",
  "COMMENT",
  "ON",
  "ROWGUIDCOL",
  "SPARSE",
  "VISIBLE",
  "INVISIBLE",
]);

// Words that start a table element other than a column.
const TABLE_CONSTRAINT_WORDS: ReadonlySet<string> = new Set([
  "CONSTRAINT",
  "PRIMARY",
  "UNIQUE",
  "FOREIGN",
  "CHECK",
  "KEY",
  "INDEX",
  "FULLTEXT",
  "SPATIAL",
  "EXCLUDE",
  "LIKE",
]);

// The first word of each referential action after `ON UPDATE`.
const FOREIGN_KEY_ACTION_WORDS: ReadonlySet<string> = new Set([
  "CASCADE",
  "RESTRICT",
  "SET",
  "NO",
]);

type ColumnAttributes = Pick<
  SqlColumnDefinition,
  "hasOnUpdate" | "hasCollation" | "isComputed"
>;

function skipClustering(tokens: Tokens, index: number): number {
  const word = wordAt(tokens, index);
  return word === "CLUSTERED" || word === "NONCLUSTERED" ? index + 1 : index;
}

// `[CONSTRAINT n] UNIQUE [KEY | INDEX] [CLUSTERED | NONCLUSTERED] [n]
// [CLUSTERED | NONCLUSTERED] (…)` from `index`, with the column list closed
// before `end`; what follows the list (`WITH (…)`, `ON [filegroup]`) is
// skipped. Null for another form or an expression element.
function readUniqueConstraint(
  tokens: Tokens,
  index: number,
  end: number,
): SqlUniqueConstraint | null {
  const hasConstraintName =
    wordAt(tokens, index) === "CONSTRAINT" &&
    wordAt(tokens, index + 1) !== "UNIQUE";
  const constraintName = hasConstraintName ? tokens[index + 1] : undefined;
  let current =
    index +
    (hasConstraintName ? 2 : wordAt(tokens, index) === "CONSTRAINT" ? 1 : 0);
  if (wordAt(tokens, current) !== "UNIQUE") {
    return null;
  }
  const keyWord = wordAt(tokens, current + 1);
  const isMysqlKey = keyWord === "KEY" || keyWord === "INDEX";
  current = skipClustering(tokens, current + (isMysqlKey ? 2 : 1));
  const keyName = isNameAt(tokens, current) ? tokens[current] : undefined;
  current = skipClustering(tokens, current + (keyName === undefined ? 0 : 1));
  if (!isSymbolAt(tokens, current, "(")) {
    return null;
  }
  const elements = readIndexElements(tokens, current);
  const columnNames = elements.columnNames.filter((name) => name !== null);
  const isReadable =
    elements.close < end && columnNames.length === elements.columnNames.length;
  return isReadable
    ? {
        name: keyName?.value ?? constraintName?.value ?? null,
        columnNames,
        isMysqlKey,
        hasDroppedElementOption: elements.hasDroppedElementOption,
      }
    : null;
}

function isTypeEndAt(tokens: Tokens, index: number, depth: number): boolean {
  const word = wordAt(tokens, index);
  return (
    tokens[index]?.depth === depth &&
    word !== null &&
    COLUMN_CONSTRAINT_WORDS.has(word) &&
    (word !== "CHARACTER" || wordAt(tokens, index + 1) === "SET")
  );
}

// Reads the attributes after the type, at the depth of the column definition.
function readAttributes(
  tokens: Tokens,
  range: TokenRange,
  depth: number,
): ColumnAttributes {
  let isInReferences = false;
  let hasOnUpdate = false;
  let hasCollation = false;
  let isComputed = false;
  for (let index = range.start; index < range.end; index += 1) {
    const word = tokens[index]?.depth === depth ? wordAt(tokens, index) : null;
    const next = wordAt(tokens, index + 1);
    isInReferences ||= word === "REFERENCES";
    const isForeignKeyAction =
      isInReferences &&
      FOREIGN_KEY_ACTION_WORDS.has(wordAt(tokens, index + 2) ?? "");
    hasOnUpdate ||= word === "ON" && next === "UPDATE" && !isForeignKeyAction;
    hasCollation ||=
      word === "COLLATE" ||
      word === "CHARSET" ||
      (word === "CHARACTER" && next === "SET");
    isComputed ||= word === "AS" && isSymbolAt(tokens, index + 1, "(");
  }
  return { hasOnUpdate, hasCollation, isComputed };
}

function readColumn(
  tokens: Tokens,
  range: TokenRange,
  source: string,
): SqlColumnDefinition | null {
  const name = tokens[range.start];
  if (name === undefined || !isNameAt(tokens, range.start)) {
    return null;
  }
  let typeEnd = range.start + 1;
  while (typeEnd < range.end && !isTypeEndAt(tokens, typeEnd, name.depth)) {
    typeEnd += 1;
  }
  const firstType = tokens[range.start + 1];
  const lastType = tokens[typeEnd - 1];
  const rawType =
    typeEnd > range.start + 1 &&
    firstType !== undefined &&
    lastType !== undefined
      ? source.slice(firstType.start, lastType.start + lastType.text.length)
      : "";
  const attributes = readAttributes(
    tokens,
    { start: typeEnd, end: range.end },
    name.depth,
  );
  return {
    name: name.value,
    start: name.start,
    rawType,
    ...attributes,
    // SQL Server `c AS <expression> [PERSISTED]` declares no type.
    isComputed:
      attributes.isComputed || wordAt(tokens, range.start + 1) === "AS",
  };
}

/**
 * Reads the column definitions and table-level unique constraints of
 * `CREATE TABLE [IF NOT EXISTS] [schema.]t (…)` for what @dbml/core 10.2.0
 * drops; null for any other statement. `source` is the text the statement was
 * scanned from.
 */
export function readSqlTableDefinition(
  statement: SqlStatement,
  source: string,
): SqlTableDefinition | null {
  const { tokens } = statement;
  if (wordAt(tokens, 0) !== "CREATE" || wordAt(tokens, 1) !== "TABLE") {
    return null;
  }
  const hasIfNotExists =
    wordAt(tokens, 2) === "IF" &&
    wordAt(tokens, 3) === "NOT" &&
    wordAt(tokens, 4) === "EXISTS";
  const table = readQualifiedName(tokens, hasIfNotExists ? 5 : 2);
  if (table === null || !isSymbolAt(tokens, table.next, "(")) {
    return null;
  }
  const list = readParenthesizedList(tokens, table.next);
  if (list.close === tokens.length) {
    return null;
  }
  const columns: SqlColumnDefinition[] = [];
  const uniqueConstraints: SqlUniqueConstraint[] = [];
  for (const range of list.items) {
    if (!TABLE_CONSTRAINT_WORDS.has(wordAt(tokens, range.start) ?? "")) {
      const column = readColumn(tokens, range, source);
      columns.push(...(column === null ? [] : [column]));
      continue;
    }
    const unique = readUniqueConstraint(tokens, range.start, range.end);
    uniqueConstraints.push(...(unique === null ? [] : [unique]));
  }
  return {
    tableName: table.lastName,
    start: statement.start,
    columns,
    uniqueConstraints,
  };
}

/**
 * Reads `ALTER TABLE [ONLY] [IF EXISTS] [schema.]t [WITH CHECK | WITH NOCHECK]
 * ADD [CONSTRAINT n] UNIQUE [KEY | INDEX] [n] [CLUSTERED | NONCLUSTERED] (…)`;
 * null for any other statement.
 */
export function readAddedUniqueConstraint(
  statement: SqlStatement,
): SqlAddedUniqueConstraint | null {
  const { tokens } = statement;
  if (wordAt(tokens, 0) !== "ALTER" || wordAt(tokens, 1) !== "TABLE") {
    return null;
  }
  const action = findAlterTableAction(tokens);
  const constraint =
    wordAt(tokens, action.index) === "ADD"
      ? readUniqueConstraint(tokens, action.index + 1, tokens.length)
      : null;
  return constraint === null || action.tableName === ""
    ? null
    : { tableName: action.tableName, start: statement.start, constraint };
}
