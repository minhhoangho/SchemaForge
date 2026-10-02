import type { EnumId } from "../../model/ids.js";
import type { Enum } from "../../model/enum.js";
import { sortEnums, sortRelations, sortTables } from "../../model/ordering.js";
import type { ReferentialAction, Relation } from "../../model/relation.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import { resolveReferentialAction } from "./dialect-constraints.js";
import { createDiagnostic, finalizeDiagnostics } from "./diagnostics.js";
import type { GeneratorDiagnostic, SqlDialect } from "./generator-types.js";
import { orderColumnPairsByReferencedKey } from "./relation-graph.js";
import type { Diagnosed, SqlDdlContext } from "./sql-ddl-model-context.js";
import { columnNamesOf, createSqlDdlContext } from "./sql-ddl-model-context.js";
import {
  buildAutoIncrementIndexes,
  buildUserIndexes,
} from "./sql-ddl-model-indexes.js";
import type { SqlIndexModel, SqlTableModel } from "./sql-ddl-model-tables.js";
import { buildTableModels } from "./sql-ddl-model-tables.js";
import { removeNullCharacters } from "./sql-literals.js";

export type {
  SqlColumnModel,
  SqlEnumCheckModel,
  SqlIndexModel,
  SqlTableModel,
  SqlUniqueModel,
} from "./sql-ddl-model-tables.js";

export type SqlEnumModel = {
  readonly enumId: EnumId;
  readonly name: string;
  readonly values: readonly string[];
};

export type SqlForeignKeyModel = {
  readonly name: string;
  readonly tableName: string;
  readonly columnNames: readonly string[];
  readonly referencedTableName: string;
  readonly referencedColumnNames: readonly string[];
  readonly onDelete: ReferentialAction;
  readonly onUpdate: ReferentialAction;
};

export type SqlDdlModel = {
  readonly enums: readonly SqlEnumModel[];
  readonly tables: readonly SqlTableModel[];
  readonly indexes: readonly SqlIndexModel[];
  readonly foreignKeys: readonly SqlForeignKeyModel[];
  readonly diagnostics: readonly GeneratorDiagnostic[];
};

// PostgreSQL cannot store U+0000 in an enum label.
function buildEnum(
  context: SqlDdlContext,
  element: Enum,
): Diagnosed<SqlEnumModel> {
  const isPostgresql = context.dialect === "postgresql";
  const values = element.values.map((value) =>
    isPostgresql
      ? removeNullCharacters(value)
      : { text: value, hasRemoved: false },
  );
  return {
    value: {
      enumId: element.id,
      name: element.name,
      values: values.map((value) => value.text),
    },
    diagnostics: values.flatMap((value, valueIndex) =>
      value.hasRemoved
        ? [
            createDiagnostic("null-character-removed", [
              "enums",
              element.id,
              "values",
              valueIndex,
            ]),
          ]
        : [],
    ),
  };
}

type ForeignKeyActions = Pick<SqlForeignKeyModel, "onDelete" | "onUpdate">;

function resolveActions(
  context: SqlDdlContext,
  relation: Relation,
): Diagnosed<ForeignKeyActions> {
  if (context.cascadeConflicts.has(relation.id)) {
    return {
      value: { onDelete: "noAction", onUpdate: "noAction" },
      diagnostics: [
        createDiagnostic("referential-action-cycle", [
          "relations",
          relation.id,
        ]),
      ],
    };
  }
  const onDelete = resolveReferentialAction(context.dialect, relation.onDelete);
  const onUpdate = resolveReferentialAction(context.dialect, relation.onUpdate);
  const lossyEvents = [
    ...(onDelete.isLossy ? ["onDelete"] : []),
    ...(onUpdate.isLossy ? ["onUpdate"] : []),
  ];
  return {
    value: { onDelete: onDelete.action, onUpdate: onUpdate.action },
    diagnostics: lossyEvents.map((event) =>
      createDiagnostic("referential-action-not-supported", [
        "relations",
        relation.id,
        event,
      ]),
    ),
  };
}

function buildForeignKeys(
  context: SqlDdlContext,
): readonly Diagnosed<SqlForeignKeyModel>[] {
  const { schema } = context;
  return sortRelations(schema).flatMap((relation) => {
    const name = context.names.foreignKeys.get(relation.id);
    const tableName = schema.tables[relation.fromTableId]?.name;
    const referencedTableName = schema.tables[relation.toTableId]?.name;
    if (
      context.dropped.relationIds.has(relation.id) ||
      name === undefined ||
      tableName === undefined ||
      referencedTableName === undefined
    ) {
      return [];
    }
    const pairs = orderColumnPairsByReferencedKey(schema, relation);
    const actions = resolveActions(context, relation);
    const foreignKey: SqlForeignKeyModel = {
      name,
      tableName,
      columnNames: columnNamesOf(
        context,
        pairs.map((pair) => pair.fromColumnId),
      ),
      referencedTableName,
      referencedColumnNames: columnNamesOf(
        context,
        pairs.map((pair) => pair.toColumnId),
      ),
      ...actions.value,
    };
    return [{ value: foreignKey, diagnostics: actions.diagnostics }];
  });
}

/**
 * Every decision of the three SQL DDL generators (names, types, defaults,
 * dropped constraints, actions and diagnostics), so each only prints syntax.
 */
export function buildSqlDdlModel(
  schema: SchemaDocument,
  dialect: SqlDialect,
): SqlDdlModel {
  const context = createSqlDdlContext(schema, dialect);
  const enums = sortEnums(schema).map((element) =>
    buildEnum(context.value, element),
  );
  const tables = buildTableModels(context.value, sortTables(schema));
  const userIndexes = buildUserIndexes(context.value);
  const foreignKeys = buildForeignKeys(context.value);
  return {
    enums: enums.map((element) => element.value),
    tables: tables.tables,
    indexes: [
      ...userIndexes.map((index) => index.value),
      ...tables.filteredIndexes,
      ...buildAutoIncrementIndexes(context.value),
    ],
    foreignKeys: foreignKeys.map((foreignKey) => foreignKey.value),
    diagnostics: finalizeDiagnostics([
      ...context.diagnostics,
      ...enums.flatMap((element) => element.diagnostics),
      ...tables.diagnostics,
      ...userIndexes.flatMap((index) => index.diagnostics),
      ...foreignKeys.flatMap((foreignKey) => foreignKey.diagnostics),
    ]),
  };
}
