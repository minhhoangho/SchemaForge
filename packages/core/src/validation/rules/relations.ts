import { sortByPathThenCode } from "../../document-path.js";
import type { ColumnId } from "../../model/ids.js";
import type { ColumnType } from "../../model/column-type.js";
import type { ColumnPair, Relation } from "../../model/relation.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import { isUniqueColumnSet } from "../column-uniqueness.js";
import type { Issue } from "../issue-codes.js";

// Structural invariants already guarantee every column pair references
// columns that exist and belong to the relation's tables (Task 4), so type
// lookups here only need to satisfy noUncheckedIndexedAccess.
function findColumnType(
  schema: SchemaDocument,
  columnId: ColumnId,
): ColumnType | undefined {
  return schema.columns[columnId]?.type;
}

function areColumnTypesEqual(from: ColumnType, to: ColumnType): boolean {
  switch (from.kind) {
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
      return to.kind === from.kind;
    case "decimal":
      return (
        to.kind === "decimal" &&
        to.precision === from.precision &&
        to.scale === from.scale
      );
    case "char":
      return to.kind === "char" && to.length === from.length;
    case "varchar":
      return to.kind === "varchar" && to.length === from.length;
    case "enum":
      return to.kind === "enum" && to.enumId === from.enumId;
    case "custom":
      return to.kind === "custom" && to.name === from.name;
  }
}

function isColumnPairMismatched(
  schema: SchemaDocument,
  pair: ColumnPair,
): boolean {
  const fromType = findColumnType(schema, pair.fromColumnId);
  const toType = findColumnType(schema, pair.toColumnId);
  if (fromType === undefined || toType === undefined) {
    return false;
  }
  return !areColumnTypesEqual(fromType, toType);
}

function findColumnTypeMismatchIssues(
  relation: Relation,
  schema: SchemaDocument,
): readonly Issue[] {
  const issues: Issue[] = [];
  relation.columnPairs.forEach((pair, index) => {
    if (isColumnPairMismatched(schema, pair)) {
      issues.push({
        code: "relation-column-type-mismatch",
        path: ["relations", relation.id, "columnPairs", index],
      });
    }
  });
  return issues;
}

function findTargetNotUniqueIssues(
  relation: Relation,
  schema: SchemaDocument,
): readonly Issue[] {
  const toColumnIds = relation.columnPairs.map((pair) => pair.toColumnId);
  if (isUniqueColumnSet(schema, relation.toTableId, toColumnIds)) {
    return [];
  }
  return [
    {
      code: "relation-target-not-unique",
      path: ["relations", relation.id, "columnPairs"],
    },
  ];
}

function findOneToOneNotUniqueIssues(
  relation: Relation,
  schema: SchemaDocument,
): readonly Issue[] {
  if (relation.kind !== "oneToOne") {
    return [];
  }
  const fromColumnIds = relation.columnPairs.map((pair) => pair.fromColumnId);
  if (isUniqueColumnSet(schema, relation.fromTableId, fromColumnIds)) {
    return [];
  }
  return [
    {
      code: "relation-one-to-one-not-unique",
      path: ["relations", relation.id, "kind"],
    },
  ];
}

function findForeignKeyColumns(
  relation: Relation,
  schema: SchemaDocument,
): readonly { readonly isNullable: boolean; readonly hasDefault: boolean }[] {
  return relation.columnPairs.flatMap((pair) => {
    const column = schema.columns[pair.fromColumnId];
    return column === undefined
      ? []
      : [
          {
            isNullable: column.isNullable,
            hasDefault: column.defaultValue !== null,
          },
        ];
  });
}

type ReferentialActionField = "onDelete" | "onUpdate";

function findSetNullIssue(
  relation: Relation,
  field: ReferentialActionField,
  foreignKeyColumns: readonly { readonly isNullable: boolean }[],
): readonly Issue[] {
  if (relation[field] !== "setNull") {
    return [];
  }
  const hasNonNullableColumn = foreignKeyColumns.some(
    (column) => !column.isNullable,
  );
  return hasNonNullableColumn
    ? [
        {
          code: "relation-set-null-not-nullable",
          path: ["relations", relation.id, field],
        },
      ]
    : [];
}

function findSetDefaultIssue(
  relation: Relation,
  field: ReferentialActionField,
  foreignKeyColumns: readonly { readonly hasDefault: boolean }[],
): readonly Issue[] {
  if (relation[field] !== "setDefault") {
    return [];
  }
  const hasColumnWithoutDefault = foreignKeyColumns.some(
    (column) => !column.hasDefault,
  );
  return hasColumnWithoutDefault
    ? [
        {
          code: "relation-set-default-without-default",
          path: ["relations", relation.id, field],
        },
      ]
    : [];
}

function findReferentialActionIssues(
  relation: Relation,
  schema: SchemaDocument,
): readonly Issue[] {
  const foreignKeyColumns = findForeignKeyColumns(relation, schema);
  const fields: readonly ReferentialActionField[] = ["onDelete", "onUpdate"];
  return fields.flatMap((field) => [
    ...findSetNullIssue(relation, field, foreignKeyColumns),
    ...findSetDefaultIssue(relation, field, foreignKeyColumns),
  ]);
}

function validateRelation(
  relation: Relation,
  schema: SchemaDocument,
): readonly Issue[] {
  return [
    ...findColumnTypeMismatchIssues(relation, schema),
    ...findTargetNotUniqueIssues(relation, schema),
    ...findOneToOneNotUniqueIssues(relation, schema),
    ...findReferentialActionIssues(relation, schema),
  ];
}

/** Validates relations (spec section 5): type compatibility, target uniqueness and referential actions. */
export function validateRelations(schema: SchemaDocument): readonly Issue[] {
  const issues = Object.values(schema.relations).flatMap((relation) =>
    validateRelation(relation, schema),
  );
  return sortByPathThenCode(issues);
}
