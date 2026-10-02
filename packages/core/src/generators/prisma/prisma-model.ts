import type { Column } from "../../model/column.js";
import type { Enum } from "../../model/enum.js";
import type { Table } from "../../model/table.js";
import { createDiagnostic } from "../shared/diagnostics.js";
import type { GeneratorDiagnostic } from "../shared/generator-types.js";
import type { Diagnosed } from "../shared/sql-ddl-model-context.js";
import type { PrismaContext } from "./prisma-context.js";
import { renderPrismaDefault } from "./prisma-default.js";
import {
  formatPrismaString,
  renderPrismaFieldType,
} from "./prisma-field-type.js";
import { fieldList, renderRelationFields } from "./prisma-relation-fields.js";

const MEMBER_INDENT = "  ";
const LINE_BREAK = /\r\n|\r|\n/;

function commentLines(comment: string, indent: string): readonly string[] {
  if (comment === "") {
    return [];
  }
  return comment
    .split(LINE_BREAK)
    .map((line) => (line === "" ? `${indent}///` : `${indent}/// ${line}`));
}

// Fields and block attributes are separated by one empty line when both exist.
function joinGroups(
  members: readonly string[],
  attributes: readonly string[],
): readonly string[] {
  return members.length > 0 && attributes.length > 0
    ? [...members, "", ...attributes]
    : [...members, ...attributes];
}

function mapAttribute(
  prismaName: string,
  originalName: string,
): readonly string[] {
  return prismaName === originalName
    ? []
    : [`${MEMBER_INDENT}@@map(${formatPrismaString(originalName)})`];
}

/** An enum block (PostgreSQL and MySQL only). */
export function renderPrismaEnum(
  context: PrismaContext,
  element: Enum,
): readonly string[] {
  const enumName = context.enumNames.get(element.id) ?? "";
  const valueNames = context.enumValueNames.get(element.id) ?? [];
  const values = element.values.map((value, valueIndex) => {
    const valueName = valueNames[valueIndex] ?? "";
    return valueName === value
      ? `${MEMBER_INDENT}${valueName}`
      : `${MEMBER_INDENT}${valueName} @map(${formatPrismaString(value)})`;
  });
  return [
    `enum ${enumName} {`,
    ...joinGroups(values, mapAttribute(enumName, element.name)),
    "}",
  ];
}

function isSinglePrimaryKey(
  context: PrismaContext,
  table: Table,
  column: Column,
): boolean {
  const [onlyKeyColumnId, ...otherKeyColumnIds] = table.primaryKeyColumnIds;
  return (
    onlyKeyColumnId === column.id &&
    otherKeyColumnIds.length === 0 &&
    !context.sql.dropped.primaryKeyTableIds.has(table.id)
  );
}

function renderColumnField(
  context: PrismaContext,
  table: Table,
  column: Column,
): Diagnosed<readonly string[]> {
  const { schema, provider, sql } = context;
  const type = sql.types.get(column.id);
  if (type === undefined) {
    return { value: [], diagnostics: [] };
  }
  const fieldType = renderPrismaFieldType({
    provider,
    column,
    type,
    enumNames: context.enumNames,
    enums: schema.enums,
  });
  const defaultValue = renderPrismaDefault({
    provider,
    column,
    type,
    enums: schema.enums,
    enumValueNames: context.enumValueNames,
  });
  const fieldName = context.fields.columnFieldNames.get(column.id) ?? "";
  const databaseName = sql.columnName(column.id) ?? column.name;
  const isUnique =
    column.isUnique && !sql.dropped.uniqueColumnIds.has(column.id);
  const parts = [
    fieldName,
    fieldType.typeName,
    isSinglePrimaryKey(context, table, column) ? "@id" : null,
    isUnique ? "@unique" : null,
    defaultValue.value === null ? null : `@default(${defaultValue.value})`,
    fieldName === databaseName
      ? null
      : `@map(${formatPrismaString(databaseName)})`,
    fieldType.nativeAttribute,
  ];
  const isNullsRestricted =
    provider === "sqlserver" && isUnique && column.isNullable;
  return {
    value: [
      ...commentLines(column.comment, MEMBER_INDENT),
      MEMBER_INDENT + parts.filter((part) => part !== null).join(" "),
    ],
    diagnostics: [
      ...fieldType.diagnostics,
      ...defaultValue.diagnostics,
      ...(isNullsRestricted
        ? [
            createDiagnostic("unique-nulls-restricted", [
              "columns",
              column.id,
              "isUnique",
            ]),
          ]
        : []),
    ],
  };
}

function renderIndexAttributes(
  context: PrismaContext,
  table: Table,
): Diagnosed<readonly string[]> {
  const { sql, schema } = context;
  const indexes = (context.indexesByTable.get(table.id) ?? []).filter(
    (index) => !sql.dropped.indexIds.has(index.id),
  );
  const render = (index: (typeof indexes)[number]): string =>
    `${MEMBER_INDENT}@@${index.isUnique ? "unique" : "index"}(${fieldList(context, index.columnIds)}, map: ${formatPrismaString(sql.indexName(index))})`;
  // MySQL error 1075: an auto-increment column must lead some index (R14).
  const autoIncrementIndexes = table.columnIds.flatMap((columnId) => {
    const name = sql.names.autoIncrementIndexes.get(columnId);
    return !sql.dropped.autoIncrementIndexColumnIds.has(columnId) ||
      name === undefined
      ? []
      : [
          `${MEMBER_INDENT}@@index(${fieldList(context, [columnId])}, map: ${formatPrismaString(name)})`,
        ];
  });
  const nullsRestricted: readonly GeneratorDiagnostic[] =
    context.provider === "sqlserver"
      ? indexes
          .filter(
            (index) =>
              index.isUnique &&
              index.columnIds.some(
                (columnId) => schema.columns[columnId]?.isNullable === true,
              ),
          )
          .map((index) =>
            createDiagnostic("unique-nulls-restricted", ["indexes", index.id]),
          )
      : [];
  return {
    value: [
      ...indexes.filter((index) => index.isUnique).map(render),
      ...indexes.filter((index) => !index.isUnique).map(render),
      ...autoIncrementIndexes,
    ],
    diagnostics: nullsRestricted,
  };
}

function renderBlockAttributes(
  context: PrismaContext,
  table: Table,
  modelName: string,
): Diagnosed<readonly string[]> {
  const isCompositeKeyKept =
    table.primaryKeyColumnIds.length > 1 &&
    !context.sql.dropped.primaryKeyTableIds.has(table.id);
  const indexes = renderIndexAttributes(context, table);
  return {
    value: [
      ...(isCompositeKeyKept
        ? [
            `${MEMBER_INDENT}@@id(${fieldList(context, table.primaryKeyColumnIds)})`,
          ]
        : []),
      ...indexes.value,
      ...mapAttribute(modelName, table.name),
      ...(context.ignoredTableIds.has(table.id)
        ? [`${MEMBER_INDENT}@@ignore`]
        : []),
    ],
    diagnostics: indexes.diagnostics,
  };
}

/** A model block: comment, column fields, relation fields, block attributes. */
export function renderPrismaModel(
  context: PrismaContext,
  table: Table,
): Diagnosed<readonly string[]> {
  const modelName = context.modelNames.get(table.id) ?? "";
  const columnFields = table.columnIds.flatMap((columnId) => {
    const column = context.schema.columns[columnId];
    return column === undefined
      ? []
      : [renderColumnField(context, table, column)];
  });
  const relationFields = renderRelationFields(context, table);
  const attributes = renderBlockAttributes(context, table, modelName);
  return {
    value: [
      ...commentLines(table.comment, ""),
      `model ${modelName} {`,
      ...joinGroups(
        [
          ...columnFields.flatMap((field) => field.value),
          ...relationFields.value,
        ],
        attributes.value,
      ),
      "}",
    ],
    diagnostics: [
      ...columnFields.flatMap((field) => field.diagnostics),
      ...relationFields.diagnostics,
      ...attributes.diagnostics,
    ],
  };
}
