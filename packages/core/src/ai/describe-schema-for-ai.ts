import type { Column } from "../model/column.js";
import type { ColumnDefault } from "../model/column-default.js";
import type { ColumnType } from "../model/column-type.js";
import type { ColumnId, TableId } from "../model/ids.js";
import {
  sortEnums,
  sortIndexes,
  sortRelations,
  sortTables,
} from "../model/ordering.js";
import type {
  ReferentialAction,
  Relation,
  RelationKind,
} from "../model/relation.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Index } from "../model/table-index.js";
import type { Table } from "../model/table.js";
import { formatAiName } from "./describe-path-for-ai.js";

/* eslint-disable @typescript-eslint/naming-convention -- AI-R30 fixes these JSON keys of the prompt view, which the system instructions name */
type AiColumnView = {
  readonly name: string;
  readonly type: string;
  // Left out when false, like unique and autoIncrement: the sketch of AI-R30
  // made it required, but a column must stay within 60 characters (spec
  // section 5), and most columns are not nullable.
  readonly nullable?: true;
  readonly unique?: true;
  readonly autoIncrement?: true;
  readonly default?: string;
  readonly comment?: string;
};

type AiIndexView = {
  readonly name: string;
  readonly columns: readonly string[];
  readonly unique: boolean;
};
/* eslint-enable @typescript-eslint/naming-convention -- end of the AI-R30 view keys */

type AiTableView = {
  readonly name: string;
  readonly comment?: string;
  readonly columns: readonly AiColumnView[];
  readonly primaryKey: readonly string[];
  readonly indexes: readonly AiIndexView[];
};

type AiRelationView = {
  readonly from: string;
  readonly to: string;
  readonly kind: RelationKind;
  readonly onDelete: ReferentialAction;
  readonly onUpdate: ReferentialAction;
};

/** The names-only schema the backend puts in the prompt (AI-R30). */
export type AiSchemaView = {
  readonly name: string;
  readonly enums: readonly {
    readonly name: string;
    readonly values: readonly string[];
  }[];
  readonly tables: readonly AiTableView[];
  readonly relations: readonly AiRelationView[];
};

// A parsed document has no dangling reference; this only keeps an id out of
// the view if one slips through, as describePathForAi does.
const UNKNOWN_NAME = "?";

function columnName(schema: SchemaDocument, id: ColumnId): string {
  return schema.columns[id]?.name ?? UNKNOWN_NAME;
}

function columnNames(
  schema: SchemaDocument,
  ids: readonly ColumnId[],
): readonly string[] {
  return ids.map((id) => columnName(schema, id));
}

/** `orders(user_id,tenant_id)`, every name through formatAiName (AI-R30). */
export function describeRelationEndpoint(
  schema: SchemaDocument,
  tableId: TableId,
  columnIds: readonly ColumnId[],
): string {
  const table = formatAiName(schema.tables[tableId]?.name ?? UNKNOWN_NAME);
  const columns = columnNames(schema, columnIds).map(formatAiName);
  return `${table}(${columns.join(",")})`;
}

function describeType(schema: SchemaDocument, type: ColumnType): string {
  switch (type.kind) {
    case "char":
    case "varchar":
      return `${type.kind}(${String(type.length)})`;
    case "decimal":
      return `decimal(${String(type.precision)},${String(type.scale)})`;
    case "enum":
      return `enum ${formatAiName(schema.enums[type.enumId]?.name ?? UNKNOWN_NAME)}`;
    // A custom type is an SQL type expression, not an identifier, so it stays raw.
    case "custom":
      return `custom ${type.name}`;
    case "smallint":
    case "integer":
    case "bigint":
    case "real":
    case "double":
    case "boolean":
    case "text":
    case "uuid":
    case "date":
    case "time":
    case "timestamp":
    case "timestamptz":
    case "json":
    case "binary":
      return type.kind;
    default: {
      const unreachable: never = type;
      return unreachable;
    }
  }
}

function describeDefault(defaultValue: ColumnDefault): string {
  switch (defaultValue.kind) {
    case "literal":
      return defaultValue.value;
    case "currentTimestamp":
      return "CURRENT_TIMESTAMP";
    case "generateUuid":
      return "UUID()";
    default: {
      const unreachable: never = defaultValue;
      return unreachable;
    }
  }
}

// Fields holding their default are left out to keep a column near 50 to 60
// characters (spec section 5).
function describeColumn(schema: SchemaDocument, column: Column): AiColumnView {
  return {
    name: column.name,
    type: describeType(schema, column.type),
    ...(column.isNullable && { nullable: true }),
    ...(column.isUnique && { unique: true }),
    ...(column.isAutoIncrement && { autoIncrement: true }),
    ...(column.defaultValue !== null && {
      default: describeDefault(column.defaultValue),
    }),
    ...(column.comment !== "" && { comment: column.comment }),
  };
}

function describeTable(
  schema: SchemaDocument,
  table: Table,
  indexes: readonly Index[],
): AiTableView {
  return {
    name: table.name,
    ...(table.comment !== "" && { comment: table.comment }),
    columns: table.columnIds.flatMap((id) => {
      const column = schema.columns[id];
      return column === undefined ? [] : [describeColumn(schema, column)];
    }),
    primaryKey: columnNames(schema, table.primaryKeyColumnIds),
    indexes: indexes.map((index) => ({
      name: index.name,
      columns: columnNames(schema, index.columnIds),
      unique: index.isUnique,
    })),
  };
}

function describeRelation(
  schema: SchemaDocument,
  relation: Relation,
): AiRelationView {
  const pairs = relation.columnPairs;
  return {
    from: describeRelationEndpoint(
      schema,
      relation.fromTableId,
      pairs.map((pair) => pair.fromColumnId),
    ),
    to: describeRelationEndpoint(
      schema,
      relation.toTableId,
      pairs.map((pair) => pair.toColumnId),
    ),
    kind: relation.kind,
    onDelete: relation.onDelete,
    onUpdate: relation.onUpdate,
  };
}

function groupIndexesByTable(
  schema: SchemaDocument,
): ReadonlyMap<TableId, readonly Index[]> {
  const groups = new Map<TableId, Index[]>();
  for (const index of sortIndexes(schema)) {
    const group = groups.get(index.tableId);
    if (group === undefined) {
      groups.set(index.tableId, [index]);
    } else {
      group.push(index);
    }
  }
  return groups;
}

/**
 * The schema by names only, in core order, with no ids, positions, subject
 * areas or notes, for the `<schema>` block of the prompt (AI-R30).
 */
export function describeSchemaForAi(schema: SchemaDocument): AiSchemaView {
  const indexesByTable = groupIndexesByTable(schema);
  return {
    name: schema.name,
    enums: sortEnums(schema).map((element) => ({
      name: element.name,
      values: element.values,
    })),
    tables: sortTables(schema).map((table) =>
      describeTable(schema, table, indexesByTable.get(table.id) ?? []),
    ),
    relations: sortRelations(schema).map((relation) =>
      describeRelation(schema, relation),
    ),
  };
}
