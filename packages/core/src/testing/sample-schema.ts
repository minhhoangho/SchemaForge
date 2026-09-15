import type { Column } from "../model/column.js";
import type { ColumnType } from "../model/column-type.js";
import { createEmptySchema } from "../model/create-empty-schema.js";
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
import type { Position } from "../model/position.js";
import type { Relation } from "../model/relation.js";
import type { SchemaDocument } from "../model/schema-document.js";
import { applyOperation } from "../operations/apply-operation.js";
import { buildManyToMany } from "../operations/build-many-to-many.js";
import type {
  BatchOperation,
  Operation,
  OperationOfType,
} from "../operations/operation.js";
import { createCounterIdGenerator, makeColumn } from "./factories.js";

const SAMPLE_SCHEMA_NAME = "Sample";
const EMAIL_LENGTH = 255;
const TOTAL_PRECISION = 12;
const TOTAL_SCALE = 2;

const UUID: ColumnType = { kind: "uuid" };
const INTEGER: ColumnType = { kind: "integer" };
const BIGINT: ColumnType = { kind: "bigint" };
const TIMESTAMPTZ: ColumnType = { kind: "timestamptz" };

const POSITIONS = {
  tenants: { x: 0, y: 0 },
  users: { x: 320, y: 0 },
  userProfiles: { x: 640, y: 0 },
  tags: { x: 0, y: 320 },
  userTags: { x: 320, y: 320 },
  orders: { x: 640, y: 320 },
  orderItems: { x: 960, y: 320 },
  note: { x: 0, y: 640 },
} as const satisfies Readonly<Record<string, Position>>;

type TableFields = OperationOfType<"addTable">["table"];

type ColumnFields = Omit<Partial<Column>, "id" | "tableId"> &
  Pick<Column, "name" | "type">;

type BuiltTable<Ids> = {
  readonly ids: Ids;
  readonly operations: readonly Operation[];
};

type TenantsIds = { readonly tableId: TableId; readonly id: ColumnId };

type UsersIds = {
  readonly tableId: TableId;
  readonly id: ColumnId;
  readonly tenantId: ColumnId;
  readonly email: ColumnId;
  readonly managerId: ColumnId;
};

type OrdersIds = {
  readonly tableId: TableId;
  readonly tenantId: ColumnId;
  readonly orderNumber: ColumnId;
};

type TagsIds = { readonly tableId: TableId; readonly id: ColumnId };

type CatalogIds = {
  readonly orderStatusId: EnumId;
  readonly salesId: SubjectAreaId;
};

function createColumn(
  generateId: GenerateId,
  tableId: TableId,
  fields: ColumnFields,
): Column {
  return makeColumn({ ...fields, id: createColumnId(generateId), tableId });
}

// A table is added bare, then its columns in order, then its primary key.
function buildTableSteps(
  table: Omit<TableFields, "comment">,
  columns: readonly Column[],
  primaryKey: readonly Column[],
): readonly Operation[] {
  return [
    { type: "addTable", table: { ...table, comment: "" } },
    ...columns.map((column, insertAt): OperationOfType<"addColumn"> => ({
      type: "addColumn",
      column,
      insertAt,
    })),
    {
      type: "setPrimaryKey",
      tableId: table.id,
      columnIds: primaryKey.map((column) => column.id),
    },
  ];
}

function buildAddRelation(
  generateId: GenerateId,
  fields: Omit<Relation, "id" | "onUpdate">,
): OperationOfType<"addRelation"> {
  return {
    type: "addRelation",
    relation: {
      ...fields,
      id: createRelationId(generateId),
      onUpdate: "noAction",
    },
  };
}

function buildCatalog(generateId: GenerateId): BuiltTable<CatalogIds> {
  const orderStatusId = createEnumId(generateId);
  const salesId = createSubjectAreaId(generateId);
  return {
    ids: { orderStatusId, salesId },
    operations: [
      {
        type: "addEnum",
        enum: {
          id: orderStatusId,
          name: "order_status",
          values: ["pending", "paid", "shipped"],
        },
      },
      { type: "addSubjectArea", subjectArea: { id: salesId, name: "Sales" } },
    ],
  };
}

function buildTenants(generateId: GenerateId): BuiltTable<TenantsIds> {
  const tableId = createTableId(generateId);
  const id = createColumn(generateId, tableId, {
    name: "id",
    type: UUID,
    defaultValue: { kind: "generateUuid" },
  });
  return {
    ids: { tableId, id: id.id },
    operations: buildTableSteps(
      {
        id: tableId,
        name: "tenants",
        position: POSITIONS.tenants,
        subjectAreaId: null,
      },
      [id],
      [id],
    ),
  };
}

function buildUsers(generateId: GenerateId): BuiltTable<UsersIds> {
  const tableId = createTableId(generateId);
  const column = (fields: ColumnFields): Column =>
    createColumn(generateId, tableId, fields);
  const id = column({ name: "id", type: BIGINT, isAutoIncrement: true });
  const tenantId = column({ name: "tenant_id", type: UUID });
  const email = column({
    name: "email",
    type: { kind: "varchar", length: EMAIL_LENGTH },
  });
  const managerId = column({
    name: "manager_id",
    type: BIGINT,
    isNullable: true,
  });
  const createdAt = column({
    name: "created_at",
    type: TIMESTAMPTZ,
    defaultValue: { kind: "currentTimestamp" },
  });
  const location = column({
    name: "location",
    type: { kind: "custom", name: "geometry(Point, 4326)" },
    isNullable: true,
  });
  return {
    ids: {
      tableId,
      id: id.id,
      tenantId: tenantId.id,
      email: email.id,
      managerId: managerId.id,
    },
    operations: buildTableSteps(
      {
        id: tableId,
        name: "users",
        position: POSITIONS.users,
        subjectAreaId: null,
      },
      [id, tenantId, email, managerId, createdAt, location],
      [id],
    ),
  };
}

function buildUsersConstraints(
  generateId: GenerateId,
  users: UsersIds,
  tenants: TenantsIds,
): readonly Operation[] {
  return [
    {
      type: "addIndex",
      index: {
        id: createIndexId(generateId),
        tableId: users.tableId,
        name: "users_tenant_id_email_key",
        columnIds: [users.tenantId, users.email],
        isUnique: true,
      },
    },
    buildAddRelation(generateId, {
      kind: "oneToMany",
      fromTableId: users.tableId,
      toTableId: tenants.tableId,
      columnPairs: [{ fromColumnId: users.tenantId, toColumnId: tenants.id }],
      onDelete: "cascade",
    }),
    buildAddRelation(generateId, {
      kind: "oneToMany",
      fromTableId: users.tableId,
      toTableId: users.tableId,
      columnPairs: [{ fromColumnId: users.managerId, toColumnId: users.id }],
      onDelete: "setNull",
    }),
  ];
}

function buildUserProfiles(
  generateId: GenerateId,
  users: UsersIds,
): readonly Operation[] {
  const tableId = createTableId(generateId);
  const userId = createColumn(generateId, tableId, {
    name: "user_id",
    type: BIGINT,
  });
  const bio = createColumn(generateId, tableId, {
    name: "bio",
    type: { kind: "text" },
    isNullable: true,
  });
  return [
    ...buildTableSteps(
      {
        id: tableId,
        name: "user_profiles",
        position: POSITIONS.userProfiles,
        subjectAreaId: null,
      },
      [userId, bio],
      [userId],
    ),
    buildAddRelation(generateId, {
      kind: "oneToOne",
      fromTableId: tableId,
      toTableId: users.tableId,
      columnPairs: [{ fromColumnId: userId.id, toColumnId: users.id }],
      onDelete: "cascade",
    }),
  ];
}

function buildOrders(
  generateId: GenerateId,
  users: UsersIds,
  catalog: CatalogIds,
): BuiltTable<OrdersIds> {
  const tableId = createTableId(generateId);
  const column = (fields: ColumnFields): Column =>
    createColumn(generateId, tableId, fields);
  const tenantId = column({ name: "tenant_id", type: UUID });
  const orderNumber = column({ name: "order_number", type: INTEGER });
  const status = column({
    name: "status",
    type: { kind: "enum", enumId: catalog.orderStatusId },
    defaultValue: { kind: "literal", value: "pending" },
  });
  const total = column({
    name: "total",
    type: { kind: "decimal", precision: TOTAL_PRECISION, scale: TOTAL_SCALE },
    defaultValue: { kind: "literal", value: "0.00" },
  });
  const userId = column({ name: "user_id", type: BIGINT });
  return {
    ids: { tableId, tenantId: tenantId.id, orderNumber: orderNumber.id },
    operations: [
      ...buildTableSteps(
        {
          id: tableId,
          name: "orders",
          position: POSITIONS.orders,
          subjectAreaId: catalog.salesId,
        },
        [tenantId, orderNumber, status, total, userId],
        [tenantId, orderNumber],
      ),
      buildAddRelation(generateId, {
        kind: "oneToMany",
        fromTableId: tableId,
        toTableId: users.tableId,
        columnPairs: [{ fromColumnId: userId.id, toColumnId: users.id }],
        onDelete: "noAction",
      }),
    ],
  };
}

function buildOrderItems(
  generateId: GenerateId,
  orders: OrdersIds,
  catalog: CatalogIds,
): readonly Operation[] {
  const tableId = createTableId(generateId);
  const column = (fields: ColumnFields): Column =>
    createColumn(generateId, tableId, fields);
  const tenantId = column({ name: "tenant_id", type: UUID });
  const orderNumber = column({ name: "order_number", type: INTEGER });
  const lineNumber = column({ name: "line_number", type: INTEGER });
  const quantity = column({
    name: "quantity",
    type: INTEGER,
    defaultValue: { kind: "literal", value: "1" },
  });
  return [
    ...buildTableSteps(
      {
        id: tableId,
        name: "order_items",
        position: POSITIONS.orderItems,
        subjectAreaId: catalog.salesId,
      },
      [tenantId, orderNumber, lineNumber, quantity],
      [tenantId, orderNumber, lineNumber],
    ),
    buildAddRelation(generateId, {
      kind: "oneToMany",
      fromTableId: tableId,
      toTableId: orders.tableId,
      columnPairs: [
        { fromColumnId: tenantId.id, toColumnId: orders.tenantId },
        { fromColumnId: orderNumber.id, toColumnId: orders.orderNumber },
      ],
      onDelete: "cascade",
    }),
  ];
}

function buildTags(generateId: GenerateId): BuiltTable<TagsIds> {
  const tableId = createTableId(generateId);
  const id = createColumn(generateId, tableId, { name: "id", type: UUID });
  return {
    ids: { tableId, id: id.id },
    operations: buildTableSteps(
      {
        id: tableId,
        name: "tags",
        position: POSITIONS.tags,
        subjectAreaId: null,
      },
      [id],
      [id],
    ),
  };
}

type BaseSteps = {
  readonly users: UsersIds;
  readonly tags: TagsIds;
  readonly operations: readonly Operation[];
};

// Everything except the junction table, which buildManyToMany derives from a
// schema that already holds both ends.
function buildBaseSteps(generateId: GenerateId): BaseSteps {
  const catalog = buildCatalog(generateId);
  const tenants = buildTenants(generateId);
  const users = buildUsers(generateId);
  const orders = buildOrders(generateId, users.ids, catalog.ids);
  const tags = buildTags(generateId);
  return {
    users: users.ids,
    tags: tags.ids,
    operations: [
      ...catalog.operations,
      ...tenants.operations,
      ...users.operations,
      ...buildUsersConstraints(generateId, users.ids, tenants.ids),
      ...buildUserProfiles(generateId, users.ids),
      ...orders.operations,
      ...buildOrderItems(generateId, orders.ids, catalog.ids),
      ...tags.operations,
    ],
  };
}

function applyOrThrow(
  schema: SchemaDocument,
  operation: Operation,
): SchemaDocument {
  const result = applyOperation(schema, operation);
  if (!result.isOk) {
    throw new Error(
      `The sample schema could not be built: ${JSON.stringify(result.error)}`,
    );
  }
  return result.value.schema;
}

function isAddTableStep(
  operation: Operation,
): operation is OperationOfType<"addTable"> {
  return operation.type === "addTable";
}

// The junction batch adds its table first and one column per key column, so
// the extra column goes to the table it adds, after those columns.
function buildUserTags(
  baseSchema: SchemaDocument,
  generateId: GenerateId,
  base: BaseSteps,
): readonly Operation[] {
  const manyToMany = buildManyToMany(
    baseSchema,
    {
      leftTableId: base.users.tableId,
      rightTableId: base.tags.tableId,
      junctionTableName: "user_tags",
      position: POSITIONS.userTags,
    },
    generateId,
  );
  if (!manyToMany.isOk || manyToMany.value.type !== "batch") {
    throw new Error(
      `The sample junction table could not be built: ${JSON.stringify(manyToMany)}`,
    );
  }
  const steps = manyToMany.value.operations;
  const junctionTable = steps.find(isAddTableStep);
  if (junctionTable === undefined) {
    throw new Error("The junction batch does not add a table");
  }
  const assignedAt = createColumn(generateId, junctionTable.table.id, {
    name: "assigned_at",
    type: TIMESTAMPTZ,
    defaultValue: { kind: "currentTimestamp" },
  });
  const keyColumnCount = steps.filter(
    (step) => step.type === "addColumn",
  ).length;
  return [
    manyToMany.value,
    { type: "addColumn", column: assignedAt, insertAt: keyColumnCount },
  ];
}

function buildNote(generateId: GenerateId): OperationOfType<"addNote"> {
  return {
    type: "addNote",
    note: {
      id: createNoteId(generateId),
      text: "Orders and their items belong to the Sales subject area.",
      position: POSITIONS.note,
    },
  };
}

/**
 * Returns a semantically valid schema that uses every concept of the model,
 * built as one batch of operations. Every call returns an equal schema.
 * Throws only when a core operation or builder regresses.
 */
export function createSampleSchema(): SchemaDocument {
  const generateId = createCounterIdGenerator();
  const emptySchema = createEmptySchema(SAMPLE_SCHEMA_NAME);
  const base = buildBaseSteps(generateId);
  const baseSchema = applyOrThrow(emptySchema, {
    type: "batch",
    operations: base.operations,
  });
  const sampleBatch: BatchOperation = {
    type: "batch",
    operations: [
      ...base.operations,
      ...buildUserTags(baseSchema, generateId, base),
      buildNote(generateId),
    ],
  };
  return applyOrThrow(emptySchema, sampleBatch);
}
