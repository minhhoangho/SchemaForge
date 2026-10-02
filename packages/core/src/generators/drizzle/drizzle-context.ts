import type { ColumnId } from "../../model/ids.js";
import type { Relation } from "../../model/relation.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { RelationFieldNames } from "../shared/relation-field-names.js";
import { buildRelationFieldNames } from "../shared/relation-field-names.js";
import type {
  Diagnosed,
  SqlDdlContext,
} from "../shared/sql-ddl-model-context.js";
import { createSqlDdlContext } from "../shared/sql-ddl-model-context.js";
import type { DrizzleDialect, DrizzleVariableNames } from "./drizzle-names.js";
import {
  allocateDrizzleVariableNames,
  listWrittenRelations,
} from "./drizzle-names.js";

/** Everything the Drizzle blocks read, computed once per call. */
export type DrizzleContext = {
  readonly schema: SchemaDocument;
  readonly dialect: DrizzleDialect;
  // Types, dropped constraints, constraint names and MySQL renames, shared
  // with the SQL generator of the same dialect.
  readonly sql: SqlDdlContext;
  readonly names: DrizzleVariableNames;
  readonly fields: RelationFieldNames;
  // Relations whose foreign key is kept, in `sortRelations` order.
  readonly relations: readonly Relation[];
};

export function createDrizzleContext(
  schema: SchemaDocument,
  dialect: DrizzleDialect,
): Diagnosed<DrizzleContext> {
  const sql = createSqlDdlContext(schema, dialect);
  const names = allocateDrizzleVariableNames(schema, dialect);
  return {
    value: {
      schema,
      dialect,
      sql: sql.value,
      names,
      fields: buildRelationFieldNames(schema, names.tableVariables),
      relations: listWrittenRelations(schema, dialect),
    },
    diagnostics: sql.diagnostics,
  };
}

/** `table.<key>` inside a config callback, `<variable>.<key>` elsewhere. */
export function columnReference(
  context: DrizzleContext,
  owner: string,
  columnId: ColumnId,
): string {
  return `${owner}.${context.fields.columnFieldNames.get(columnId) ?? ""}`;
}
