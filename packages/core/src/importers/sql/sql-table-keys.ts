import { readIndexElements } from "./sql-index-definitions.js";
import type { SqlStatement } from "./statement-scanner.js";
import {
  findAlterTableAction,
  isNameAt,
  isSymbolAt,
  wordAt,
  type Tokens,
} from "./sql-token-reading.js";

// The keys inside CREATE TABLE other than the primary key, and the unique
// constraints added through ALTER TABLE, as the scanner reads them again
// (import / export spec, section 5, "Scanner đọc lại câu đã đưa cho parser").

export type SqlUniqueConstraint = {
  readonly name: string | null;
  readonly columnNames: readonly string[];
  // The MySQL form `UNIQUE KEY | INDEX [n] (…)`.
  readonly isMysqlKey: boolean;
  // `DESC`, `NULLS …`, an operator class, `COLLATE` or a MySQL prefix length
  // on a column element.
  readonly hasDroppedElementOption: boolean;
};

// A MySQL `[FULLTEXT | SPATIAL] KEY | INDEX [n] (…)` inside CREATE TABLE.
export type SqlTableKey = {
  readonly name: string | null;
  readonly columnNames: readonly string[];
  readonly kind: "plain" | "fulltext" | "spatial";
  // `DESC` or a prefix length on a column element.
  readonly hasDroppedElementOption: boolean;
};

export type SqlAddedUniqueConstraint = {
  readonly tableName: string;
  readonly start: number;
  readonly constraint: SqlUniqueConstraint;
};

function skipClustering(tokens: Tokens, index: number): number {
  const word = wordAt(tokens, index);
  return word === "CLUSTERED" || word === "NONCLUSTERED" ? index + 1 : index;
}

// `[CONSTRAINT n] UNIQUE [KEY | INDEX] [CLUSTERED | NONCLUSTERED] [n]
// [CLUSTERED | NONCLUSTERED] (…)` from `index`, with the column list closed
// before `end`; what follows the list (`WITH (…)`, `ON [filegroup]`) is
// skipped. Null for another form or an expression element.
export function readUniqueConstraint(
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

const TABLE_KEY_KINDS: ReadonlyMap<string, SqlTableKey["kind"]> = new Map([
  ["FULLTEXT", "fulltext"],
  ["SPATIAL", "spatial"],
]);

// `[FULLTEXT | SPATIAL] {KEY | INDEX} [n] (…)` from `index` (FULLTEXT and
// SPATIAL may stand alone), with the column list closed before `end`; what
// follows the list (`USING BTREE`, `COMMENT '…'`) is skipped. Null for another
// form or an expression element, which the parser reports itself.
export function readTableKey(
  tokens: Tokens,
  index: number,
  end: number,
): SqlTableKey | null {
  const kind = TABLE_KEY_KINDS.get(wordAt(tokens, index) ?? "") ?? "plain";
  let current = kind === "plain" ? index : index + 1;
  const keyWord = wordAt(tokens, current);
  if (keyWord === "KEY" || keyWord === "INDEX") {
    current += 1;
  } else if (kind === "plain") {
    return null;
  }
  const name = isNameAt(tokens, current) ? tokens[current] : undefined;
  current += name === undefined ? 0 : 1;
  if (!isSymbolAt(tokens, current, "(")) {
    return null;
  }
  const elements = readIndexElements(tokens, current);
  const columnNames = elements.columnNames.filter((column) => column !== null);
  const isReadable =
    elements.close < end && columnNames.length === elements.columnNames.length;
  return isReadable
    ? {
        name: name?.value ?? null,
        columnNames,
        kind,
        hasDroppedElementOption: elements.hasDroppedElementOption,
      }
    : null;
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
