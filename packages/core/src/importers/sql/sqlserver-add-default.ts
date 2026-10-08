import type { ColumnChange } from "./sql-draft-overrides.js";
import type { SqlStatement } from "./statement-scanner.js";
import {
  findAlterTableAction,
  isNameAt,
  tokensText,
  wordAt,
  type Tokens,
} from "./sql-token-reading.js";

// The index of DEFAULT after `ADD [CONSTRAINT n]`, or null.
function findDefaultKeyword(tokens: Tokens, addIndex: number): number | null {
  const index =
    wordAt(tokens, addIndex + 1) === "CONSTRAINT" &&
    isNameAt(tokens, addIndex + 2)
      ? addIndex + 3
      : addIndex + 1;
  return wordAt(tokens, index) === "DEFAULT" ? index : null;
}

/**
 * Reads SQL Server `ALTER TABLE [schema.]t [WITH CHECK | WITH NOCHECK] ADD
 * [CONSTRAINT n] DEFAULT <expression> FOR c`, the form SSMS writes column
 * defaults in; null for any other statement. The constraint name is not kept:
 * CG-01 names defaults itself. The expression goes to mapSqlDefault, which
 * removes the parentheses SSMS writes around it.
 */
export function readSqlServerAddDefault(
  statement: SqlStatement,
): ColumnChange | null {
  const { tokens } = statement;
  if (wordAt(tokens, 0) !== "ALTER" || wordAt(tokens, 1) !== "TABLE") {
    return null;
  }
  const action = findAlterTableAction(tokens);
  const defaultIndex =
    wordAt(tokens, action.index) === "ADD"
      ? findDefaultKeyword(tokens, action.index)
      : null;
  const forIndex = tokens.length - 2;
  const column = tokens[forIndex + 1];
  const isReadable =
    defaultIndex !== null &&
    action.tableName !== "" &&
    forIndex > defaultIndex + 1 &&
    tokens[forIndex]?.depth === 0 &&
    wordAt(tokens, forIndex) === "FOR" &&
    isNameAt(tokens, forIndex + 1);
  return isReadable && column !== undefined
    ? {
        tableName: action.tableName,
        columnName: column.value,
        start: statement.start,
        change: {
          kind: "default",
          raw: {
            kind: "expression",
            text: tokensText(tokens.slice(defaultIndex + 1, forIndex)),
          },
        },
      }
    : null;
}
