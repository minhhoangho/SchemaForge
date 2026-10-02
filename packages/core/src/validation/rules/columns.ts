import { sortByPathThenCode } from "../../document-path.js";
import type { DocumentPath } from "../../document-path.js";
import type { Column } from "../../model/column.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { Table } from "../../model/table.js";
import { isUniqueColumnSet } from "../column-uniqueness.js";
import type { Issue } from "../issue-codes.js";
import { isSafeCustomTypeName } from "./custom-type-name.js";

const AUTO_INCREMENT_TYPE_KINDS = new Set(["smallint", "integer", "bigint"]);

function checkPrimaryKeyNullable(
  column: Column,
  isPrimaryKeyColumn: boolean,
): readonly Issue[] {
  if (isPrimaryKeyColumn && column.isNullable) {
    return [
      {
        code: "column-primary-key-nullable",
        path: ["columns", column.id, "isNullable"],
      },
    ];
  }
  return [];
}

function checkAutoIncrement(
  schema: SchemaDocument,
  column: Column,
  isPrimaryKeyColumn: boolean,
): readonly Issue[] {
  if (!column.isAutoIncrement) {
    return [];
  }
  const path: DocumentPath = ["columns", column.id, "isAutoIncrement"];
  const issues: Issue[] = [];
  if (!AUTO_INCREMENT_TYPE_KINDS.has(column.type.kind)) {
    issues.push({ code: "column-auto-increment-invalid-type", path });
  }
  if (column.isNullable) {
    issues.push({ code: "column-auto-increment-nullable", path });
  }
  if (column.defaultValue !== null) {
    issues.push({ code: "column-auto-increment-with-default", path });
  }
  const isKeyOrUnique =
    isPrimaryKeyColumn ||
    isUniqueColumnSet(schema, column.tableId, [column.id]);
  if (!isKeyOrUnique) {
    issues.push({ code: "column-auto-increment-not-key", path });
  }
  return issues;
}

function checkScale(column: Column): readonly Issue[] {
  if (
    column.type.kind === "decimal" &&
    column.type.scale > column.type.precision
  ) {
    return [
      {
        code: "column-type-invalid-scale",
        path: ["columns", column.id, "type", "scale"],
      },
    ];
  }
  return [];
}

function checkCustomType(column: Column): readonly Issue[] {
  if (column.type.kind !== "custom" || isSafeCustomTypeName(column.type.name)) {
    return [];
  }
  return [
    {
      code: "column-custom-type-invalid",
      path: ["columns", column.id, "type", "name"],
    },
  ];
}

function checkColumn(
  schema: SchemaDocument,
  column: Column,
  table: Table | undefined,
): readonly Issue[] {
  const isPrimaryKeyColumn =
    table?.primaryKeyColumnIds.includes(column.id) === true;
  return [
    ...checkPrimaryKeyNullable(column, isPrimaryKeyColumn),
    ...checkAutoIncrement(schema, column, isPrimaryKeyColumn),
    ...checkScale(column),
    ...checkCustomType(column),
  ];
}

function checkTableAutoIncrementCount(
  table: Table,
  schema: SchemaDocument,
): readonly Issue[] {
  const autoIncrementColumnCount = table.columnIds.filter(
    (columnId) => schema.columns[columnId]?.isAutoIncrement === true,
  ).length;
  const MAX_AUTO_INCREMENT_COLUMNS = 1;
  if (autoIncrementColumnCount <= MAX_AUTO_INCREMENT_COLUMNS) {
    return [];
  }
  return [
    {
      code: "table-multiple-auto-increment",
      path: ["tables", table.id, "columnIds"],
    },
  ];
}

/** Validates column attribute rules: primary key, auto-increment, scale and custom types (spec sections 3, 4, 8). */
export function validateColumns(schema: SchemaDocument): readonly Issue[] {
  const columnIssues = Object.values(schema.columns).flatMap((column) =>
    checkColumn(schema, column, schema.tables[column.tableId]),
  );
  const tableIssues = Object.values(schema.tables).flatMap((table) =>
    checkTableAutoIncrementCount(table, schema),
  );
  return sortByPathThenCode([...columnIssues, ...tableIssues]);
}
