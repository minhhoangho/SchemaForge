import type { SqlStatement } from "./statement-scanner.js";
import {
  findOpenParenthesis,
  isNameAt,
  isSymbolAt,
  readParenthesizedList,
  readQualifiedName,
  wordAt,
  type Tokens,
  type TokenRange,
} from "./sql-token-reading.js";

export type SqlIndexDefinition = {
  // null for PostgreSQL `CREATE INDEX ON t (…)`.
  readonly indexName: string | null;
  // Without the schema.
  readonly tableName: string;
  readonly start: number;
  readonly isUnique: boolean;
  // In order; null for an expression element.
  readonly columnNames: readonly (string | null)[];
  // `DESC`, `NULLS FIRST | LAST`, an operator class, `COLLATE` or a MySQL
  // prefix length on a column element (`ASC` does not count).
  readonly hasDroppedElementOption: boolean;
  // SQL Server `INCLUDE (…)`.
  readonly hasInclude: boolean;
  readonly hasWhere: boolean;
  // The columns of a `WHERE <column> IS NOT NULL [AND …]` filter, as CG-01
  // writes for SQL Server; null for any other filter or no filter.
  readonly whereNotNullColumnNames: readonly string[] | null;
};

export type IndexElements = {
  readonly columnNames: readonly (string | null)[];
  readonly hasDroppedElementOption: boolean;
  // The index of the closing parenthesis, or tokens.length when it is missing.
  readonly close: number;
};

type ElementOption = "direction" | "nulls" | "collation" | "operatorClass";

type OptionStep = {
  readonly option: ElementOption;
  readonly next: number;
  readonly isDropped: boolean;
};

type Element = {
  readonly columnName: string | null;
  readonly isDropped: boolean;
};

const EXPRESSION: Element = { columnName: null, isDropped: false };
const OPTION_WORDS: ReadonlySet<string> = new Set([
  "ASC",
  "DESC",
  "NULLS",
  "COLLATE",
]);

function readOption(tokens: Tokens, index: number): OptionStep | null {
  const word = wordAt(tokens, index);
  if (word === "ASC" || word === "DESC") {
    return { option: "direction", next: index + 1, isDropped: word === "DESC" };
  }
  const nullsOrder = wordAt(tokens, index + 1);
  if (word === "NULLS") {
    return nullsOrder === "FIRST" || nullsOrder === "LAST"
      ? { option: "nulls", next: index + 2, isDropped: true }
      : null;
  }
  if (word === "COLLATE") {
    const collation = readQualifiedName(tokens, index + 1);
    return collation === null
      ? null
      : { option: "collation", next: collation.next, isDropped: true };
  }
  const operatorClass = OPTION_WORDS.has(word ?? "")
    ? null
    : readQualifiedName(tokens, index);
  return operatorClass === null
    ? null
    : { option: "operatorClass", next: operatorClass.next, isDropped: true };
}

function isPrefixLengthAt(tokens: Tokens, index: number): boolean {
  return (
    isSymbolAt(tokens, index, "(") &&
    tokens[index + 1]?.kind === "number" &&
    isSymbolAt(tokens, index + 2, ")")
  );
}

// A column name followed by an optional MySQL prefix length and at most one of
// each element option; anything else is an expression.
function readElement(tokens: Tokens, range: TokenRange): Element {
  const name = tokens[range.start];
  if (!isNameAt(tokens, range.start) || name === undefined) {
    return EXPRESSION;
  }
  const hasPrefixLength = isPrefixLengthAt(tokens, range.start + 1);
  let index = range.start + (hasPrefixLength ? 4 : 1);
  let isDropped = hasPrefixLength;
  const seen = new Set<ElementOption>();
  while (index < range.end) {
    const step = readOption(tokens, index);
    if (step === null || step.next > range.end || seen.has(step.option)) {
      return EXPRESSION;
    }
    seen.add(step.option);
    isDropped ||= step.isDropped;
    index = step.next;
  }
  return { columnName: name.value, isDropped };
}

/** Reads the column list of an index or unique constraint opened at `open`. */
export function readIndexElements(tokens: Tokens, open: number): IndexElements {
  const list = readParenthesizedList(tokens, open);
  const elements = list.items.map((range) => readElement(tokens, range));
  return {
    columnNames: elements.map((element) => element.columnName),
    hasDroppedElementOption: elements.some((element) => element.isDropped),
    close: list.close,
  };
}

// `<name> IS NOT NULL [AND …]` from `index` to the end or to WITH or ON.
function readNotNullFilter(
  tokens: Tokens,
  index: number,
): readonly string[] | null {
  const columnNames: string[] = [];
  let current = index;
  for (;;) {
    const name = tokens[current];
    const isNotNull =
      isNameAt(tokens, current) &&
      wordAt(tokens, current + 1) === "IS" &&
      wordAt(tokens, current + 2) === "NOT" &&
      wordAt(tokens, current + 3) === "NULL";
    if (!isNotNull || name === undefined) {
      return null;
    }
    columnNames.push(name.value);
    current += 4;
    const next = wordAt(tokens, current);
    if (current === tokens.length || next === "WITH" || next === "ON") {
      return columnNames;
    }
    if (next !== "AND") {
      return null;
    }
    current += 1;
  }
}

type IndexClauses = Pick<
  SqlIndexDefinition,
  "hasInclude" | "hasWhere" | "whereNotNullColumnNames"
>;

// Reads INCLUDE and WHERE after the column list; WITH (…), a filegroup and
// other storage options are skipped.
function readClauses(tokens: Tokens, from: number): IndexClauses {
  let hasInclude = false;
  for (let index = from; index < tokens.length; index += 1) {
    const word = tokens[index]?.depth === 0 ? wordAt(tokens, index) : null;
    hasInclude ||= word === "INCLUDE";
    if (word === "WHERE") {
      const whereNotNullColumnNames = readNotNullFilter(tokens, index + 1);
      return { hasInclude, hasWhere: true, whereNotNullColumnNames };
    }
  }
  return { hasInclude, hasWhere: false, whereNotNullColumnNames: null };
}

function skipWord(tokens: Tokens, index: number, word: string): number {
  return wordAt(tokens, index) === word ? index + 1 : index;
}

// `CREATE [UNIQUE] [CLUSTERED | NONCLUSTERED] INDEX [CONCURRENTLY]
// [IF NOT EXISTS] [n] ON`: the index after ON, or null.
function readIndexHead(tokens: Tokens): {
  readonly isUnique: boolean;
  readonly indexName: string | null;
  readonly on: number;
} | null {
  const isUnique = wordAt(tokens, 1) === "UNIQUE";
  let index = isUnique ? 2 : 1;
  const clustering = wordAt(tokens, index);
  index += clustering === "CLUSTERED" || clustering === "NONCLUSTERED" ? 1 : 0;
  if (wordAt(tokens, 0) !== "CREATE" || wordAt(tokens, index) !== "INDEX") {
    return null;
  }
  index = skipWord(tokens, index + 1, "CONCURRENTLY");
  const hasIfNotExists =
    wordAt(tokens, index) === "IF" &&
    wordAt(tokens, index + 1) === "NOT" &&
    wordAt(tokens, index + 2) === "EXISTS";
  index += hasIfNotExists ? 3 : 0;
  const name =
    wordAt(tokens, index) === "ON" ? null : readQualifiedName(tokens, index);
  const on = name?.next ?? index;
  return wordAt(tokens, on) === "ON"
    ? { isUnique, indexName: name?.lastName ?? null, on }
    : null;
}

/**
 * Reads `CREATE [UNIQUE] [CLUSTERED | NONCLUSTERED] INDEX [CONCURRENTLY]
 * [IF NOT EXISTS] [n] ON [ONLY] [schema.]t [USING m] (…) …` for the parts
 * @dbml/core 10.2.0 drops; null for any other statement.
 */
export function readSqlIndexDefinition(
  statement: SqlStatement,
): SqlIndexDefinition | null {
  const { tokens } = statement;
  const head = readIndexHead(tokens);
  const table =
    head === null
      ? null
      : readQualifiedName(tokens, skipWord(tokens, head.on + 1, "ONLY"));
  const open =
    table === null ? null : findOpenParenthesis(tokens, table.next, 0);
  if (head === null || table === null || open === null) {
    return null;
  }
  const elements = readIndexElements(tokens, open);
  if (elements.close === tokens.length) {
    return null;
  }
  return {
    indexName: head.indexName,
    tableName: table.lastName,
    start: statement.start,
    isUnique: head.isUnique,
    columnNames: elements.columnNames,
    hasDroppedElementOption: elements.hasDroppedElementOption,
    ...readClauses(tokens, elements.close + 1),
  };
}
