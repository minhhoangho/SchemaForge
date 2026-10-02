import { sortIndexes, sortTables } from "../../model/ordering.js";
import type { Index } from "../../model/table-index.js";
import { resolveSqlServerUnique } from "./dialect-constraints.js";
import { createDiagnostic } from "./diagnostics.js";
import type { Diagnosed, SqlDdlContext } from "./sql-ddl-model-context.js";
import { columnNamesOf } from "./sql-ddl-model-context.js";
import type { SqlIndexModel } from "./sql-ddl-model-tables.js";

function buildUserIndex(
  context: SqlDdlContext,
  index: Index,
  tableName: string,
): Diagnosed<SqlIndexModel> {
  const { schema } = context;
  const model: SqlIndexModel = {
    name: context.indexName(index),
    tableName,
    columnNames: columnNamesOf(context, index.columnIds),
    isUnique: index.isUnique,
    filterColumnNames: [],
  };
  if (context.dialect !== "sqlserver" || !index.isUnique) {
    return { value: model, diagnostics: [] };
  }
  const unique = resolveSqlServerUnique(schema, index.tableId, index.columnIds);
  if (unique.mode === "filtered") {
    const nullableIds = index.columnIds.filter(
      (columnId) => schema.columns[columnId]?.isNullable === true,
    );
    return {
      value: {
        ...model,
        filterColumnNames: columnNamesOf(context, nullableIds),
      },
      diagnostics: [],
    };
  }
  return {
    value: model,
    diagnostics: unique.isNullsRestricted
      ? [createDiagnostic("unique-nulls-restricted", ["indexes", index.id])]
      : [],
  };
}

/** User indexes in `sortIndexes` order, without the dropped ones. */
export function buildUserIndexes(
  context: SqlDdlContext,
): readonly Diagnosed<SqlIndexModel>[] {
  return sortIndexes(context.schema).flatMap((index) => {
    const tableName = context.schema.tables[index.tableId]?.name;
    return tableName === undefined || context.dropped.indexIds.has(index.id)
      ? []
      : [buildUserIndex(context, index, tableName)];
  });
}

// MySQL error 1075: an AUTO_INCREMENT column must lead some index (spec R14).
export function buildAutoIncrementIndexes(
  context: SqlDdlContext,
): readonly SqlIndexModel[] {
  const { dropped, names } = context;
  return sortTables(context.schema).flatMap((table) =>
    table.columnIds.flatMap((columnId) => {
      const name = names.autoIncrementIndexes.get(columnId);
      const columnName = context.columnName(columnId);
      return !dropped.autoIncrementIndexColumnIds.has(columnId) ||
        name === undefined ||
        columnName === undefined
        ? []
        : [
            {
              name,
              tableName: table.name,
              columnNames: [columnName],
              isUnique: false,
              filterColumnNames: [],
            },
          ];
    }),
  );
}
