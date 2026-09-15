import { describe, expect, it } from "vitest";

import type { Column } from "../model/column.js";
import type { Enum } from "../model/enum.js";
import type { ColumnId } from "../model/ids.js";
import type { Relation } from "../model/relation.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { SubjectArea } from "../model/subject-area.js";
import type { Table } from "../model/table.js";
import { parseSchemaDocument } from "../parse/parse-schema-document.js";
import { validateSchema } from "../validation/validate-schema.js";
import { createSampleSchema } from "./sample-schema.js";
import { unwrapOk } from "./unwrap-result.js";

function findTable(schema: SchemaDocument, name: string): Table {
  const table = Object.values(schema.tables).find(
    (candidate) => candidate.name === name,
  );
  if (table === undefined) {
    throw new Error(`The sample schema has no table named ${name}`);
  }
  return table;
}

function findColumn(
  schema: SchemaDocument,
  table: Table,
  name: string,
): Column {
  const column = Object.values(schema.columns).find(
    (candidate) => candidate.tableId === table.id && candidate.name === name,
  );
  if (column === undefined) {
    throw new Error(`Table ${table.name} has no column named ${name}`);
  }
  return column;
}

function findEnum(schema: SchemaDocument, name: string): Enum {
  const enumDefinition = Object.values(schema.enums).find(
    (candidate) => candidate.name === name,
  );
  if (enumDefinition === undefined) {
    throw new Error(`The sample schema has no enum named ${name}`);
  }
  return enumDefinition;
}

function findSubjectArea(schema: SchemaDocument, name: string): SubjectArea {
  const subjectArea = Object.values(schema.subjectAreas).find(
    (candidate) => candidate.name === name,
  );
  if (subjectArea === undefined) {
    throw new Error(`The sample schema has no subject area named ${name}`);
  }
  return subjectArea;
}

// Throws unless exactly one relation joins the two tables, so a test never
// silently picks one of several.
function findRelation(
  schema: SchemaDocument,
  fromTableName: string,
  toTableName: string,
): Relation {
  const fromTable = findTable(schema, fromTableName);
  const toTable = findTable(schema, toTableName);
  const relations = Object.values(schema.relations).filter(
    (relation) =>
      relation.fromTableId === fromTable.id &&
      relation.toTableId === toTable.id,
  );
  const [relation] = relations;
  if (relation === undefined || relations.length > 1) {
    throw new Error(
      `Expected one relation from ${fromTableName} to ${toTableName}, found ${String(relations.length)}`,
    );
  }
  return relation;
}

function findColumnName(schema: SchemaDocument, columnId: ColumnId): string {
  const column = schema.columns[columnId];
  if (column === undefined) {
    throw new Error(`The sample schema has no column ${columnId}`);
  }
  return column.name;
}

function namesOf(
  schema: SchemaDocument,
  columnIds: readonly ColumnId[],
): readonly string[] {
  return columnIds.map((columnId) => findColumnName(schema, columnId));
}

function describeColumnPairs(
  schema: SchemaDocument,
  relation: Relation,
): readonly (readonly string[])[] {
  return relation.columnPairs.map((pair) => [
    findColumnName(schema, pair.fromColumnId),
    findColumnName(schema, pair.toColumnId),
  ]);
}

describe("createSampleSchema", () => {
  it("has no semantic issues", () => {
    expect(validateSchema(createSampleSchema())).toStrictEqual([]);
  });

  it("passes parseSchemaDocument after JSON stringify and parse and equals the original", () => {
    const schema = createSampleSchema();

    const parsed = unwrapOk(
      parseSchemaDocument(JSON.parse(JSON.stringify(schema))),
    );

    expect(parsed).toStrictEqual(schema);
  });

  it("returns structurally equal schemas on every call", () => {
    expect(createSampleSchema()).toStrictEqual(createSampleSchema());
  });

  it("contains a composite primary key and a composite foreign key", () => {
    const schema = createSampleSchema();
    const foreignKey = findRelation(schema, "order_items", "orders");

    expect({
      ordersPrimaryKey: namesOf(
        schema,
        findTable(schema, "orders").primaryKeyColumnIds,
      ),
      orderItemsPrimaryKey: namesOf(
        schema,
        findTable(schema, "order_items").primaryKeyColumnIds,
      ),
      foreignKeyPairs: describeColumnPairs(schema, foreignKey),
    }).toStrictEqual({
      ordersPrimaryKey: ["tenant_id", "order_number"],
      orderItemsPrimaryKey: ["tenant_id", "order_number", "line_number"],
      foreignKeyPairs: [
        ["tenant_id", "tenant_id"],
        ["order_number", "order_number"],
      ],
    });
  });

  it("contains a one-to-one relation and a self-referencing relation", () => {
    const schema = createSampleSchema();
    const profileRelation = findRelation(schema, "user_profiles", "users");
    const managerRelation = findRelation(schema, "users", "users");

    expect({
      profileKind: profileRelation.kind,
      profilePairs: describeColumnPairs(schema, profileRelation),
      managerKind: managerRelation.kind,
      managerPairs: describeColumnPairs(schema, managerRelation),
      managerOnDelete: managerRelation.onDelete,
    }).toStrictEqual({
      profileKind: "oneToOne",
      profilePairs: [["user_id", "id"]],
      managerKind: "oneToMany",
      managerPairs: [["manager_id", "id"]],
      managerOnDelete: "setNull",
    });
  });

  it("contains a junction table with an extra column", () => {
    const schema = createSampleSchema();
    const userTags = findTable(schema, "user_tags");

    expect({
      columns: namesOf(schema, userTags.columnIds),
      primaryKey: namesOf(schema, userTags.primaryKeyColumnIds),
      usersPairs: describeColumnPairs(
        schema,
        findRelation(schema, "user_tags", "users"),
      ),
      tagsPairs: describeColumnPairs(
        schema,
        findRelation(schema, "user_tags", "tags"),
      ),
      assignedAt: findColumn(schema, userTags, "assigned_at").defaultValue,
    }).toStrictEqual({
      columns: ["users_id", "tags_id", "assigned_at"],
      primaryKey: ["users_id", "tags_id"],
      usersPairs: [["users_id", "id"]],
      tagsPairs: [["tags_id", "id"]],
      assignedAt: { kind: "currentTimestamp" },
    });
  });

  it("contains an enum column with a literal default", () => {
    const schema = createSampleSchema();
    const orderStatus = findEnum(schema, "order_status");
    const status = findColumn(schema, findTable(schema, "orders"), "status");

    expect({
      values: orderStatus.values,
      type: status.type,
      defaultValue: status.defaultValue,
    }).toStrictEqual({
      values: ["pending", "paid", "shipped"],
      type: { kind: "enum", enumId: orderStatus.id },
      defaultValue: { kind: "literal", value: "pending" },
    });
  });

  it("contains both default expressions and a custom type", () => {
    const schema = createSampleSchema();
    const users = findTable(schema, "users");

    expect({
      tenantsId: findColumn(schema, findTable(schema, "tenants"), "id")
        .defaultValue,
      usersCreatedAt: findColumn(schema, users, "created_at").defaultValue,
      usersLocation: findColumn(schema, users, "location").type,
    }).toStrictEqual({
      tenantsId: { kind: "generateUuid" },
      usersCreatedAt: { kind: "currentTimestamp" },
      usersLocation: { kind: "custom", name: "geometry(Point, 4326)" },
    });
  });

  it("contains a multi-column unique index, a subject area with members and a note", () => {
    const schema = createSampleSchema();
    const sales = findSubjectArea(schema, "Sales");

    expect({
      indexes: Object.values(schema.indexes).map((index) => ({
        tableId: index.tableId,
        columns: namesOf(schema, index.columnIds),
        isUnique: index.isUnique,
      })),
      salesTables: Object.values(schema.tables)
        .filter((table) => table.subjectAreaId === sales.id)
        .map((table) => table.name)
        .toSorted(),
      noteCount: Object.keys(schema.notes).length,
    }).toStrictEqual({
      indexes: [
        {
          tableId: findTable(schema, "users").id,
          columns: ["tenant_id", "email"],
          isUnique: true,
        },
      ],
      salesTables: ["order_items", "orders"],
      noteCount: 1,
    });
  });
});
