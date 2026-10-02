import type { Column } from "../model/column.js";
import type { ColumnType } from "../model/column-type.js";
import type {
  ColumnId,
  EnumId,
  GenerateId,
  SubjectAreaId,
  TableId,
} from "../model/ids.js";
import {
  createColumnId,
  createEnumId,
  createIndexId,
  createNoteId,
  createRelationId,
  createSubjectAreaId,
  createTableId,
} from "../model/ids.js";
import type { Relation } from "../model/relation.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Table } from "../model/table.js";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeEnum,
  makeIndex,
  makeNote,
  makeRelation,
  makeSubjectArea,
  makeTable,
} from "./factories.js";

const SCHEMA_NAME = `Tên "kỳ lạ" của 'schema'`;
const USERS_COMMENT = [
  `Người dùng: it's "quoted", \`ticked\` [bracketed] a\\b */ end`,
  "-- ; DROP TABLE x",
].join("\n");
const NOTE_TEXT = [
  "Ghi chú nhiều dòng",
  "chứa ''' ba nháy đơn",
  "và a\\b",
].join("\n");
// Every quote character of the three SQL dialects plus the escape character.
const QUOTED_TABLE_NAME = `tên "lạ" \`x\` [y] 'z' \\ w`;
// 63 bytes in UTF-8, the PostgreSQL limit; its generated constraint names overflow it.
const LONGEST_TABLE_NAME =
  "bảng có tên dài đúng sáu mươi ba byte theo utf-8 nhé";
const ORDER_STATUS_VALUES = [
  "chờ xử lý",
  "đã giao",
  `it's "quoted"`,
  "ma",
  "má",
  "a\\b",
  "*/ end",
];
const TABLE_SPACING = 320;

const UUID: ColumnType = { kind: "uuid" };
const INTEGER: ColumnType = { kind: "integer" };
const TEXT: ColumnType = { kind: "text" };

type ColumnFields = Omit<Partial<Column>, "id" | "tableId"> &
  Pick<Column, "name" | "type">;

type TableFields = Omit<Partial<Table>, "id" | "columnIds" | "position"> &
  Pick<Table, "name">;

type BuiltTable = {
  readonly table: Table;
  readonly columns: readonly Column[];
};

// The primary key is the first `primaryKeyLength` columns, in order.
function buildTable(
  generateId: GenerateId,
  fields: TableFields,
  columns: readonly ColumnFields[],
  primaryKeyLength: number,
): BuiltTable {
  const tableId = createTableId(generateId);
  const builtColumns = columns.map((column) =>
    makeColumn({ ...column, id: createColumnId(generateId), tableId }),
  );
  return {
    table: makeTable({
      ...fields,
      id: tableId,
      primaryKeyColumnIds: builtColumns
        .slice(0, primaryKeyLength)
        .map((column) => column.id),
    }),
    columns: builtColumns,
  };
}

function findColumnId(built: BuiltTable, name: string): ColumnId {
  const column = built.columns.find((candidate) => candidate.name === name);
  if (column === undefined) {
    throw new Error(`Naming edge table has no column named ${name}`);
  }
  return column.id;
}

function buildUsers(
  generateId: GenerateId,
  subjectAreaId: SubjectAreaId,
): BuiltTable {
  return buildTable(
    generateId,
    { name: "người dùng", comment: USERS_COMMENT, subjectAreaId },
    [
      { name: "id", type: UUID, defaultValue: { kind: "generateUuid" } },
      {
        name: "họ tên",
        type: { kind: "varchar", length: 100 },
        isNullable: true,
        comment: "trước\u0000sau",
      },
      { name: "USER_ID", type: INTEGER },
      { name: "ma", type: TEXT, isUnique: true },
      { name: "má", type: TEXT, isUnique: true },
      {
        name: "ghi chú",
        type: { kind: "varchar", length: 50 },
        defaultValue: { kind: "literal", value: "it's a\\b" },
      },
    ],
    1,
  );
}

function buildOrders(
  generateId: GenerateId,
  subjectAreaId: SubjectAreaId,
  orderStatusId: EnumId,
): BuiltTable {
  return buildTable(
    generateId,
    { name: "order", subjectAreaId },
    [
      { name: "id", type: INTEGER },
      { name: "select", type: TEXT },
      { name: "group", type: INTEGER },
      { name: "người dùng id", type: UUID },
      { name: "updated_by", type: UUID, isNullable: true },
      {
        name: "trạng thái",
        type: { kind: "enum", enumId: orderStatusId },
        defaultValue: { kind: "literal", value: "chờ xử lý" },
      },
    ],
    1,
  );
}

// Tables whose only edge case is their own name or a column name.
function buildNamedTables(generateId: GenerateId): readonly BuiltTable[] {
  const integerId: ColumnFields = { name: "id", type: INTEGER };
  return [
    buildTable(generateId, { name: "order items" }, [integerId], 1),
    buildTable(generateId, { name: "order_items" }, [integerId], 1),
    buildTable(
      generateId,
      { name: "2fa codes" },
      [
        { name: "code", type: { kind: "varchar", length: 6 } },
        { name: "__proto__", type: TEXT, isNullable: true },
      ],
      1,
    ),
    buildTable(
      generateId,
      { name: "用户" },
      [integerId, { name: "名字", type: TEXT }],
      1,
    ),
    buildTable(
      generateId,
      { name: QUOTED_TABLE_NAME },
      [integerId, { name: QUOTED_TABLE_NAME, type: TEXT }],
      1,
    ),
    buildTable(
      generateId,
      { name: LONGEST_TABLE_NAME },
      [
        integerId,
        {
          name: "mã duy nhất",
          type: { kind: "varchar", length: 20 },
          isUnique: true,
        },
      ],
      1,
    ),
  ];
}

function buildUserRelations(
  generateId: GenerateId,
  users: BuiltTable,
  orders: BuiltTable,
): readonly Relation[] {
  const toUsers = (fromColumnId: ColumnId): Relation["columnPairs"] => [
    { fromColumnId, toColumnId: findColumnId(users, "id") },
  ];
  const fromTableId: TableId = orders.table.id;
  return [
    makeRelation({
      id: createRelationId(generateId),
      fromTableId,
      toTableId: users.table.id,
      columnPairs: toUsers(findColumnId(orders, "người dùng id")),
      onDelete: "cascade",
    }),
    makeRelation({
      id: createRelationId(generateId),
      fromTableId,
      toTableId: users.table.id,
      columnPairs: toUsers(findColumnId(orders, "updated_by")),
      onDelete: "setNull",
    }),
  ];
}

function placeTables(tables: readonly BuiltTable[]): readonly Table[] {
  return tables.map(({ table }, index) => ({
    ...table,
    position: { x: index * TABLE_SPACING, y: 0 },
  }));
}

/**
 * Returns a semantically valid schema whose names, comments, enum values and
 * literals hit every quoting, escaping and identifier-mapping edge case of the
 * generators (code generators spec, section 10). Every call returns an equal
 * schema.
 */
export function createNamingEdgeSchema(): SchemaDocument {
  const generateId = createCounterIdGenerator();
  const orderStatus = makeEnum({
    id: createEnumId(generateId),
    name: "trạng thái đơn",
    values: ORDER_STATUS_VALUES,
  });
  const salesArea = makeSubjectArea({
    id: createSubjectAreaId(generateId),
    name: `Khu "bán hàng"`,
  });
  const users = buildUsers(generateId, salesArea.id);
  const orders = buildOrders(generateId, salesArea.id, orderStatus.id);
  const tables = [users, orders, ...buildNamedTables(generateId)];
  return buildSchema({
    name: SCHEMA_NAME,
    tables: placeTables(tables),
    columns: tables.flatMap((built) => built.columns),
    relations: buildUserRelations(generateId, users, orders),
    indexes: [
      makeIndex({
        id: createIndexId(generateId),
        tableId: users.table.id,
        name: `chỉ mục "họ tên"`,
        columnIds: [findColumnId(users, "họ tên")],
      }),
    ],
    enums: [orderStatus],
    subjectAreas: [salesArea],
    notes: [makeNote({ id: createNoteId(generateId), text: NOTE_TEXT })],
  });
}
