import { Parser } from "@dbml/core";
import type { Database } from "@dbml/core";
import {
  sortEnums,
  sortIndexes,
  sortNotes,
  sortRelations,
  sortSubjectAreas,
  sortTables,
} from "@schemaforge/core";
import type {
  ColumnId,
  ColumnType,
  ReferentialAction,
  SchemaDocument,
} from "@schemaforge/core";
import { generateDbml } from "@schemaforge/core/generators/dbml";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { listConformanceFixtures } from "./support/fixtures.js";

// `@dbml/core` types these properties as `any`; the shapes narrow them.
const fieldTypeShape = z.object({ type_name: z.string() });
const indexColumnShape = z.object({ value: z.string() });
const actionShape = z.string();
const optionalTextShape = z.string().nullish();

const ACTION_KEYWORDS: Readonly<Record<ReferentialAction, string>> = {
  noAction: "no action",
  restrict: "restrict",
  cascade: "cascade",
  setNull: "set null",
  setDefault: "set default",
};

// `@dbml/core` 10.2 strips the common indentation of a `'''…'''` string, so a
// multi-line text whose every line is indented only has to be present.
function isIndentedMultilineText(text: string): boolean {
  const lines = text.split(/\r\n|\r|\n/);
  return lines.length > 1 && lines.every((line) => /^\s/.test(line));
}

function expectedText(text: string): unknown {
  return isIndentedMultilineText(text) ? expect.any(String) : text;
}

function parsedText(text: unknown): string {
  return optionalTextShape.parse(text) ?? "";
}

function expectedTypeName(schema: SchemaDocument, type: ColumnType): string {
  switch (type.kind) {
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
    case "decimal":
      return `decimal(${String(type.precision)},${String(type.scale)})`;
    case "char":
    case "varchar":
      return `${type.kind}(${String(type.length)})`;
    case "enum":
      return schema.enums[type.enumId]?.name ?? "text";
    case "custom":
      return type.name;
  }
}

function columnNames(
  schema: SchemaDocument,
  columnIds: readonly ColumnId[],
): readonly string[] {
  return columnIds.map((columnId) => schema.columns[columnId]?.name ?? "");
}

function summarizeSchema(schema: SchemaDocument): unknown {
  const tables = sortTables(schema);
  return {
    tables: tables.map((table) => ({
      name: table.name,
      note: expectedText(table.comment),
      columns: table.columnIds.flatMap((columnId) => {
        const column = schema.columns[columnId];
        return column === undefined
          ? []
          : [
              {
                name: column.name,
                typeName: expectedTypeName(schema, column.type),
                note: expectedText(column.comment),
              },
            ];
      }),
      indexes: sortIndexes(schema)
        .filter((index) => index.tableId === table.id)
        .map((index) => ({
          name: index.name,
          columns: columnNames(schema, index.columnIds),
        })),
    })),
    relations: sortRelations(schema).map((relation) => [
      ACTION_KEYWORDS[relation.onDelete],
      ACTION_KEYWORDS[relation.onUpdate],
    ]),
    enums: sortEnums(schema).map((element) => ({
      name: element.name,
      values: element.values,
    })),
    groups: sortSubjectAreas(schema).map((area) => ({
      name: area.name,
      tables: tables
        .filter((table) => table.subjectAreaId === area.id)
        .map((table) => table.name),
    })),
    notes: sortNotes(schema).map((note) => expectedText(note.text)),
  };
}

function summarizeDatabase(database: Database): unknown {
  const schemas = database.schemas;
  return {
    tables: schemas
      .flatMap((schema) => schema.tables)
      .map((table) => ({
        name: table.name,
        note: parsedText(table.note),
        columns: table.fields.map((field) => ({
          name: field.name,
          typeName: fieldTypeShape.parse(field.type).type_name,
          note: parsedText(field.note),
        })),
        // The composite primary key is an index without a name in DBML.
        indexes: table.indexes
          .filter((index) => !index.pk)
          .map((index) => ({
            name: index.name,
            columns: index.columns.map(
              (column) => indexColumnShape.parse(column).value,
            ),
          })),
      })),
    relations: schemas
      .flatMap((schema) => schema.refs)
      .map((ref) => [
        actionShape.parse(ref.onDelete),
        actionShape.parse(ref.onUpdate),
      ]),
    enums: schemas
      .flatMap((schema) => schema.enums)
      .map((element) => ({
        name: element.name,
        values: element.values.map((value) => value.name),
      })),
    groups: schemas
      .flatMap((schema) => schema.tableGroups)
      .map((group) => ({
        name: group.name,
        tables: group.tables.map((table) => table.name),
      })),
    notes: database.notes.map((note) => parsedText(note.content)),
  };
}

describe.each(listConformanceFixtures())("dbml for $name", ({ schema }) => {
  it("parses with @dbml/core", () => {
    const { file } = generateDbml(schema, {});

    expect(() => new Parser().parse(file.content, "dbmlv2")).not.toThrow();
  });

  // Default values are not compared: `@dbml/core` reads numeric defaults as
  // JavaScript numbers, so a bigint default loses precision on the way back.
  it("matches the schema", () => {
    const { file } = generateDbml(schema, {});
    const database = new Parser().parse(file.content, "dbmlv2");

    expect(summarizeDatabase(database)).toStrictEqual(summarizeSchema(schema));
  });
});
