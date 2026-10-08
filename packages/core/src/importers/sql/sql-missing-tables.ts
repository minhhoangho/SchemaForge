import { toNameKey } from "../../model/name-limits.js";
import type { SqlTableDefinition } from "./sql-column-definitions.js";
import type { SqlStatement } from "./statement-scanner.js";
import {
  findAlterTableAction,
  readQualifiedName,
  wordAt,
  type Tokens,
} from "./sql-token-reading.js";

// The tables an ALTER TABLE names, without their schema: its target and the
// table after each REFERENCES.
function namedTables(tokens: Tokens): readonly string[] {
  const referenced = tokens.flatMap((token, index) =>
    token.depth === 0 && wordAt(tokens, index) === "REFERENCES"
      ? [readQualifiedName(tokens, index + 1)?.lastName ?? ""]
      : [],
  );
  return [findAlterTableAction(tokens).tableName, ...referenced].filter(
    (name) => name !== "",
  );
}

/**
 * The ALTER TABLE statements among those kept for the parser that name a
 * table the source does not create, as their target or after REFERENCES.
 * @dbml/core 10.2.0 rejects the whole source for a foreign key to such a
 * table and drops a key added to one without an error, so the importer masks
 * these statements before parsing and reports them as reference-not-found
 * (import / export spec, section 5, "Quan hệ").
 */
export function findStatementsOnMissingTables(
  statements: readonly SqlStatement[],
  tableDefinitions: readonly SqlTableDefinition[],
): readonly SqlStatement[] {
  const created = new Set(
    tableDefinitions.map(({ tableName }) => toNameKey(tableName)),
  );
  return statements.filter(
    ({ tokens }) =>
      wordAt(tokens, 0) === "ALTER" &&
      wordAt(tokens, 1) === "TABLE" &&
      namedTables(tokens).some((name) => !created.has(toNameKey(name))),
  );
}
