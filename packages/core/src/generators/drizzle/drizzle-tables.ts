import type { ColumnId } from "../../model/ids.js";
import { sortIndexes } from "../../model/ordering.js";
import type { Relation } from "../../model/relation.js";
import type { Table } from "../../model/table.js";
import { formatJsDocLines } from "../shared/identifiers.js";
import { orderColumnPairsByReferencedKey } from "../shared/relation-graph.js";
import type { Diagnosed } from "../shared/sql-ddl-model-context.js";
import { resolveForeignKeyActions } from "../shared/sql-ddl-model.js";
import { REFERENTIAL_ACTION_SQL } from "../shared/sql-referential-actions.js";
import { renderDrizzleColumn } from "./drizzle-columns.js";
import type { DrizzleContext } from "./drizzle-context.js";
import { columnReference } from "./drizzle-context.js";
import type { DrizzleDialect } from "./drizzle-names.js";

export type DrizzleTable = {
  readonly lines: readonly string[];
  readonly builders: readonly string[];
  readonly hasCallback: boolean;
};

// The callback return type that keeps tables referencing each other from
// being inferred as `any` (TS7022, TS7024; spec R21).
export const EXTRA_CONFIG_TYPES: Readonly<Record<DrizzleDialect, string>> = {
  postgresql: "PgTableExtraConfigValue",
  mysql: "MySqlTableExtraConfigValue",
};

const TABLE_FUNCTIONS: Readonly<Record<DrizzleDialect, string>> = {
  postgresql: "pgTable",
  mysql: "mysqlTable",
};

// Columns and callback entries sit two levels deep; a chained call one more.
const ENTRY_INDENT = "    ";
const CHAINED_CALL_OFFSET = "  ";

type Constraint = {
  readonly lines: readonly string[];
  readonly builder: string;
};

const PARAMETER = "table";

function references(
  context: DrizzleContext,
  owner: string,
  columnIds: readonly ColumnId[],
): string {
  return columnIds
    .map((columnId) => columnReference(context, owner, columnId))
    .join(", ");
}

function keyConstraints(
  context: DrizzleContext,
  table: Table,
): readonly Constraint[] {
  const { schema, dropped, names } = context.sql;
  const primaryKeyName = names.primaryKeys.get(table.id);
  const primaryKey =
    primaryKeyName === undefined || dropped.primaryKeyTableIds.has(table.id)
      ? []
      : [
          {
            lines: [
              `primaryKey({ name: ${JSON.stringify(primaryKeyName)}, columns: [${references(context, PARAMETER, table.primaryKeyColumnIds)}] })`,
            ],
            builder: "primaryKey",
          },
        ];
  const uniques = table.columnIds.flatMap((columnId) => {
    const name = names.uniqueColumns.get(columnId);
    return schema.columns[columnId]?.isUnique !== true ||
      dropped.uniqueColumnIds.has(columnId) ||
      name === undefined
      ? []
      : [
          {
            lines: [
              `unique(${JSON.stringify(name)}).on(${references(context, PARAMETER, [columnId])})`,
            ],
            builder: "unique",
          },
        ];
  });
  return [...primaryKey, ...uniques];
}

function indexConstraints(
  context: DrizzleContext,
  table: Table,
): readonly Constraint[] {
  const { schema, dropped, names } = context.sql;
  const userIndexes = sortIndexes(schema)
    .filter(
      (index) => index.tableId === table.id && !dropped.indexIds.has(index.id),
    )
    .map((index) => {
      const builder = index.isUnique ? "uniqueIndex" : "index";
      return {
        lines: [
          `${builder}(${JSON.stringify(context.sql.indexName(index))}).on(${references(context, PARAMETER, index.columnIds)})`,
        ],
        builder,
      };
    });
  // MySQL only: an AUTO_INCREMENT column must lead some index (R14).
  const autoIncrementIndexes = table.columnIds.flatMap((columnId) => {
    const name = names.autoIncrementIndexes.get(columnId);
    return !dropped.autoIncrementIndexColumnIds.has(columnId) ||
      name === undefined
      ? []
      : [
          {
            lines: [
              `index(${JSON.stringify(name)}).on(${references(context, PARAMETER, [columnId])})`,
            ],
            builder: "index",
          },
        ];
  });
  return [...userIndexes, ...autoIncrementIndexes];
}

function foreignKeyConstraint(
  context: DrizzleContext,
  relation: Relation,
): Diagnosed<Constraint> {
  const pairs = orderColumnPairsByReferencedKey(context.schema, relation);
  const target =
    relation.toTableId === relation.fromTableId
      ? PARAMETER
      : (context.names.tableVariables.get(relation.toTableId) ?? "");
  const name = context.sql.names.foreignKeys.get(relation.id) ?? "";
  const actions = resolveForeignKeyActions(context.sql, relation);
  const action = (value: Relation["onDelete"]): string =>
    JSON.stringify(REFERENTIAL_ACTION_SQL[value].toLowerCase());
  return {
    value: {
      lines: [
        `foreignKey({ name: ${JSON.stringify(name)}, columns: [${references(
          context,
          PARAMETER,
          pairs.map((pair) => pair.fromColumnId),
        )}], foreignColumns: [${references(
          context,
          target,
          pairs.map((pair) => pair.toColumnId),
        )}] })`,
        `${CHAINED_CALL_OFFSET}.onDelete(${action(actions.value.onDelete)})`,
        `${CHAINED_CALL_OFFSET}.onUpdate(${action(actions.value.onUpdate)})`,
      ],
      builder: "foreignKey",
    },
    diagnostics: actions.diagnostics,
  };
}

function renderColumns(
  context: DrizzleContext,
  table: Table,
): Diagnosed<{
  readonly lines: readonly string[];
  readonly builders: readonly string[];
}> {
  const { sql } = context;
  const columns = table.columnIds.flatMap((columnId) => {
    const column = context.schema.columns[columnId];
    const type = sql.types.get(columnId);
    const columnName = sql.columnName(columnId);
    if (
      column === undefined ||
      type === undefined ||
      columnName === undefined
    ) {
      return [];
    }
    const rendered = renderDrizzleColumn({
      dialect: context.dialect,
      column,
      columnName,
      type,
      names: context.names,
      enums: context.schema.enums,
    });
    const key = context.fields.columnFieldNames.get(columnId) ?? "";
    return [
      {
        lines: [
          ...formatJsDocLines(column.comment, ENTRY_INDENT),
          `${ENTRY_INDENT}${key}: ${rendered.expression},`,
        ],
        rendered,
      },
    ];
  });
  return {
    value: {
      lines: columns.flatMap((entry) => entry.lines),
      builders: columns.flatMap((entry) => entry.rendered.builders),
    },
    diagnostics: columns.flatMap((entry) => entry.rendered.diagnostics),
  };
}

function withTrailingComma(constraint: Constraint): readonly string[] {
  return constraint.lines.map((line, index) =>
    index === constraint.lines.length - 1
      ? `${ENTRY_INDENT}${line},`
      : `${ENTRY_INDENT}${line}`,
  );
}

/** One `export const … = pgTable(…)` block (plan Task 18, "Cấu trúc file" 4). */
export function renderDrizzleTable(
  context: DrizzleContext,
  table: Table,
): Diagnosed<DrizzleTable> {
  const variable = context.names.tableVariables.get(table.id) ?? "";
  const tableFunction = TABLE_FUNCTIONS[context.dialect];
  const columns = renderColumns(context, table);
  const foreignKeys = context.relations
    .filter((relation) => relation.fromTableId === table.id)
    .map((relation) => foreignKeyConstraint(context, relation));
  const constraints = [
    ...keyConstraints(context, table),
    ...indexConstraints(context, table),
    ...foreignKeys.map((foreignKey) => foreignKey.value),
  ];
  const hasCallback = constraints.length > 0;
  const head = `export const ${variable} = ${tableFunction}(`;
  const body =
    columns.value.lines.length === 0 && !hasCallback
      ? [`${head}${JSON.stringify(table.name)}, {});`]
      : [
          head,
          `  ${JSON.stringify(table.name)},`,
          "  {",
          ...columns.value.lines,
          "  },",
          ...(hasCallback
            ? [
                `  (${PARAMETER}): ${EXTRA_CONFIG_TYPES[context.dialect]}[] => [`,
                ...constraints.flatMap(withTrailingComma),
                "  ],",
              ]
            : []),
          ");",
        ];
  return {
    value: {
      lines: [...formatJsDocLines(table.comment, ""), ...body],
      builders: [
        tableFunction,
        ...columns.value.builders,
        ...constraints.map((constraint) => constraint.builder),
      ],
      hasCallback,
    },
    diagnostics: [
      ...columns.diagnostics,
      ...foreignKeys.flatMap((foreignKey) => foreignKey.diagnostics),
    ],
  };
}
