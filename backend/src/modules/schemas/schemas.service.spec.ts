import { Logger } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { MAX_SCHEMAS_PER_USER } from "@schemaforge/api-contract";
import { buildSchema, makeTable } from "@schemaforge/core/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../prisma/prisma.service.js";
import { ListSchemasQueryDto } from "./dto/list-schemas-query.dto.js";
import { encodeSchemaListCursor } from "./schema-list-cursor.js";
import { SchemasRepository } from "./schemas.repository.js";
import { MAX_DOCUMENT_ERRORS, SchemasService } from "./schemas.service.js";

const OWNER_ID = "0190f3a0-0000-7000-8000-0000000000ff";
const OTHER_OWNER_ID = "0190f3a0-0000-7000-8000-0000000000ee";
const SCHEMA_ID = "0190f3a0-0000-7000-8000-000000000001";
const MISSING_SCHEMA_ID = "0190f3a0-0000-7000-8000-000000000009";
const NOW = new Date("2026-09-18T10:00:00.000Z");
const INVALID_TABLE_COUNT = 150;

const DOCUMENT = buildSchema({
  name: "orders",
  tables: [makeTable({ id: "tbl_orders" })],
});

// Two tables with the same name: a semantic issue, still a valid structure.
const DOCUMENT_WITH_ISSUES = buildSchema({
  name: "orders",
  tables: [
    makeTable({ id: "tbl_a", name: "orders" }),
    makeTable({ id: "tbl_b", name: "orders" }),
  ],
});

function manyInvalidTables(): Readonly<Record<string, unknown>> {
  return Object.fromEntries(
    Array.from({ length: INVALID_TABLE_COUNT }, (_value, index) => [
      `tbl_${String(index)}`,
      "not-a-table",
    ]),
  );
}

const DOCUMENT_WITH_MANY_ERRORS = {
  version: 1,
  name: "broken",
  tables: manyInvalidTables(),
  columns: {},
  relations: {},
  indexes: {},
  enums: {},
  subjectAreas: {},
  notes: {},
};

type SchemaRow = {
  id: string;
  ownerId: string;
  name: string;
  document: unknown;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
};

type KeysetCondition =
  | { readonly updatedAt: { readonly lt: Date } }
  | { readonly updatedAt: Date; readonly id: { readonly lt: string } };

type SchemaWhere = {
  readonly id?: string;
  readonly ownerId?: string;
  readonly revision?: number;
  readonly OR?: readonly KeysetCondition[];
};

function makeRow(
  overrides: Partial<SchemaRow> & Pick<SchemaRow, "id">,
): SchemaRow {
  return {
    ownerId: OWNER_ID,
    name: "orders",
    document: DOCUMENT,
    revision: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function isKeysetMatch(row: SchemaRow, condition: KeysetCondition): boolean {
  return "id" in condition
    ? row.updatedAt.getTime() === condition.updatedAt.getTime() &&
        row.id < condition.id.lt
    : row.updatedAt.getTime() < condition.updatedAt.lt.getTime();
}

function isMatch(row: SchemaRow, where: SchemaWhere): boolean {
  return (
    (where.id === undefined || row.id === where.id) &&
    (where.ownerId === undefined || row.ownerId === where.ownerId) &&
    (where.revision === undefined || row.revision === where.revision) &&
    (where.OR === undefined ||
      where.OR.some((condition) => isKeysetMatch(row, condition)))
  );
}

function byUpdatedAtThenIdDesc(left: SchemaRow, right: SchemaRow): number {
  const byUpdatedAt = right.updatedAt.getTime() - left.updatedAt.getTime();
  return byUpdatedAt === 0 ? right.id.localeCompare(left.id) : byUpdatedAt;
}

/** An in-memory stand-in for `prisma.schema` that honours the owner conditions. */
function createFakePrisma(rows: readonly SchemaRow[]) {
  const store = [...rows];
  const schema = {
    findMany: vi.fn(
      ({ where, take }: { where: SchemaWhere; take: number }): SchemaRow[] =>
        store
          .filter((row) => isMatch(row, where))
          .toSorted(byUpdatedAtThenIdDesc)
          .slice(0, take),
    ),
    findFirst: vi.fn(
      ({ where }: { where: SchemaWhere }): SchemaRow | null =>
        store.find((row) => isMatch(row, where)) ?? null,
    ),
    count: vi.fn(
      ({ where }: { where: SchemaWhere }): number =>
        store.filter((row) => isMatch(row, where)).length,
    ),
    create: vi.fn(
      ({
        data,
      }: {
        data: Partial<SchemaRow> & Pick<SchemaRow, "id">;
      }): SchemaRow => {
        const row = makeRow(data);
        store.push(row);
        return row;
      },
    ),
    updateManyAndReturn: vi.fn(
      ({
        where,
        data,
      }: {
        where: SchemaWhere;
        data: { document: unknown; name: string };
      }): SchemaRow[] =>
        store
          .filter((row) => isMatch(row, where))
          .map((row) =>
            Object.assign(row, data, { revision: row.revision + 1 }),
          ),
    ),
    deleteMany: vi.fn(
      ({ where }: { where: SchemaWhere }): { count: number } => {
        const kept = store.filter((row) => !isMatch(row, where));
        const count = store.length - kept.length;
        store.splice(0, store.length, ...kept);
        return { count };
      },
    ),
  };
  const client = { rows: store, schema, $transaction: vi.fn() };
  client.$transaction.mockImplementation(
    (run: (tx: typeof client) => unknown) => run(client),
  );
  return client;
}

function makeQuery(
  overrides: Partial<ListSchemasQueryDto> = {},
): ListSchemasQueryDto {
  return Object.assign(new ListSchemasQueryDto(), overrides);
}

async function createService(rows: readonly SchemaRow[]): Promise<{
  readonly service: SchemasService;
  readonly prisma: ReturnType<typeof createFakePrisma>;
}> {
  const prisma = createFakePrisma(rows);
  const moduleRef = await Test.createTestingModule({
    providers: [
      SchemasService,
      SchemasRepository,
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();
  return { service: moduleRef.get(SchemasService), prisma };
}

describe("SchemasService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("create", () => {
    it("rejects a structurally invalid document with document-invalid and core error codes and paths", async () => {
      const { service } = await createService([]);

      await expect(
        service.create(OWNER_ID, { id: SCHEMA_ID, document: { version: 99 } }),
      ).rejects.toMatchObject({
        body: {
          statusCode: 422,
          code: "document-invalid",
          documentErrors: [{ code: "version-unsupported", path: ["version"] }],
        },
      });
    });

    it("returns at most 100 document errors", async () => {
      const { service } = await createService([]);

      const error: unknown = await service
        .create(OWNER_ID, {
          id: SCHEMA_ID,
          document: DOCUMENT_WITH_MANY_ERRORS,
        })
        .catch((caught: unknown) => caught);

      expect(documentErrorsOf(error)).toHaveLength(MAX_DOCUMENT_ERRORS);
    });

    it("stores the document returned by parseSchemaDocument with its name", async () => {
      const { service, prisma } = await createService([]);

      const summary = await service.create(OWNER_ID, {
        id: SCHEMA_ID,
        document: DOCUMENT,
      });

      expect(summary).toMatchObject({
        id: SCHEMA_ID,
        name: "orders",
        revision: 1,
      });
      expect(prisma.rows).toEqual([
        expect.objectContaining({
          id: SCHEMA_ID,
          ownerId: OWNER_ID,
          name: "orders",
          document: DOCUMENT,
        }),
      ]);
    });

    it("stores a document that has semantic issues", async () => {
      const { service, prisma } = await createService([]);

      await service.create(OWNER_ID, {
        id: SCHEMA_ID,
        document: DOCUMENT_WITH_ISSUES,
      });

      expect(prisma.rows).toHaveLength(1);
    });

    it("rejects creation over the limit with schema-limit-reached", async () => {
      const rows = Array.from(
        { length: MAX_SCHEMAS_PER_USER },
        (_value, index) =>
          makeRow({
            id: `0190f3a0-0000-7000-8000-${String(index).padStart(12, "0")}`,
          }),
      );
      const { service } = await createService(rows);

      await expect(
        service.create(OWNER_ID, { id: SCHEMA_ID, document: DOCUMENT }),
      ).rejects.toMatchObject({
        body: { statusCode: 403, code: "schema-limit-reached" },
      });
    });
  });

  describe("update", () => {
    it("updates with the matching revision", async () => {
      const { service } = await createService([
        makeRow({ id: SCHEMA_ID, revision: 2 }),
      ]);

      const summary = await service.update(OWNER_ID, SCHEMA_ID, {
        document: DOCUMENT_WITH_ISSUES,
        expectedRevision: 2,
      });

      expect(summary).toMatchObject({ id: SCHEMA_ID, revision: 3 });
    });

    it("rejects a stale revision with revision-conflict and the current revision", async () => {
      const { service } = await createService([
        makeRow({ id: SCHEMA_ID, revision: 5 }),
      ]);

      await expect(
        service.update(OWNER_ID, SCHEMA_ID, {
          document: DOCUMENT,
          expectedRevision: 3,
        }),
      ).rejects.toMatchObject({
        body: {
          statusCode: 409,
          code: "revision-conflict",
          currentRevision: 5,
        },
      });
    });

    it("rejects an update of a missing schema with not-found", async () => {
      const { service } = await createService([]);

      await expect(
        service.update(OWNER_ID, MISSING_SCHEMA_ID, {
          document: DOCUMENT,
          expectedRevision: 1,
        }),
      ).rejects.toMatchObject({ body: { statusCode: 404, code: "not-found" } });
    });

    it("rejects an update of another user's schema with not-found", async () => {
      const { service } = await createService([
        makeRow({ id: SCHEMA_ID, ownerId: OTHER_OWNER_ID }),
      ]);

      await expect(
        service.update(OWNER_ID, SCHEMA_ID, {
          document: DOCUMENT,
          expectedRevision: 1,
        }),
      ).rejects.toMatchObject({ body: { statusCode: 404, code: "not-found" } });
    });
  });

  describe("get", () => {
    it("returns the parsed document of a schema", async () => {
      const { service } = await createService([makeRow({ id: SCHEMA_ID })]);

      const detail = await service.get(OWNER_ID, SCHEMA_ID);

      expect(detail).toMatchObject({ id: SCHEMA_ID, document: DOCUMENT });
    });

    it("fails with internal-error and logs the schema id when the stored document cannot be parsed", async () => {
      const logged = vi
        .spyOn(Logger.prototype, "error")
        .mockImplementation(() => undefined);
      const { service } = await createService([
        makeRow({ id: SCHEMA_ID, document: { version: 99 } }),
      ]);

      await expect(service.get(OWNER_ID, SCHEMA_ID)).rejects.toMatchObject({
        body: { statusCode: 500, code: "internal-error" },
      });
      expect(logged).toHaveBeenCalledWith(expect.stringContaining(SCHEMA_ID));
    });

    it("rejects a schema of another user with not-found", async () => {
      const { service } = await createService([
        makeRow({ id: SCHEMA_ID, ownerId: OTHER_OWNER_ID }),
      ]);

      await expect(service.get(OWNER_ID, SCHEMA_ID)).rejects.toMatchObject({
        body: { statusCode: 404, code: "not-found" },
      });
    });
  });

  describe("list", () => {
    it("returns a next cursor when more rows exist", async () => {
      const second = makeRow({
        id: "0190f3a0-0000-7000-8000-000000000002",
        updatedAt: new Date("2026-09-18T09:00:00.000Z"),
      });
      const { service } = await createService([
        makeRow({ id: "0190f3a0-0000-7000-8000-000000000003" }),
        second,
        makeRow({
          id: "0190f3a0-0000-7000-8000-000000000001",
          updatedAt: new Date("2026-09-18T08:00:00.000Z"),
        }),
      ]);

      const list = await service.list(OWNER_ID, makeQuery({ limit: 2 }));

      expect(list.items.map((item) => item.id)).toEqual([
        "0190f3a0-0000-7000-8000-000000000003",
        second.id,
      ]);
      expect(list.nextCursor).toBe(
        encodeSchemaListCursor({ updatedAt: second.updatedAt, id: second.id }),
      );
    });

    it("returns a null next cursor on the last page", async () => {
      const { service } = await createService([makeRow({ id: SCHEMA_ID })]);

      const list = await service.list(OWNER_ID, makeQuery({ limit: 2 }));

      expect(list).toEqual({
        items: [expect.objectContaining({ id: SCHEMA_ID })],
        nextCursor: null,
      });
    });

    it("lists only the schemas of the caller", async () => {
      const { service } = await createService([
        makeRow({ id: SCHEMA_ID, ownerId: OTHER_OWNER_ID }),
      ]);

      const list = await service.list(OWNER_ID, makeQuery({ limit: 2 }));

      expect(list.items).toEqual([]);
    });

    it("rejects an undecodable cursor with validation-failed", async () => {
      const { service } = await createService([]);

      await expect(
        service.list(OWNER_ID, makeQuery({ limit: 2, cursor: "not-a-cursor" })),
      ).rejects.toMatchObject({
        body: {
          statusCode: 400,
          code: "validation-failed",
          fields: [{ path: "cursor", constraint: "isSchemaListCursor" }],
        },
      });
    });
  });

  describe("remove", () => {
    it("deletes a schema of the caller", async () => {
      const { service, prisma } = await createService([
        makeRow({ id: SCHEMA_ID }),
      ]);

      await service.remove(OWNER_ID, SCHEMA_ID);

      expect(prisma.rows).toEqual([]);
    });

    it("rejects deleting another user's schema with not-found", async () => {
      const { service, prisma } = await createService([
        makeRow({ id: SCHEMA_ID, ownerId: OTHER_OWNER_ID }),
      ]);

      await expect(service.remove(OWNER_ID, SCHEMA_ID)).rejects.toMatchObject({
        body: { statusCode: 404, code: "not-found" },
      });
      expect(prisma.rows).toHaveLength(1);
    });
  });
});

function documentErrorsOf(error: unknown): readonly unknown[] {
  return error !== null &&
    typeof error === "object" &&
    "body" in error &&
    error.body !== null &&
    typeof error.body === "object" &&
    "documentErrors" in error.body &&
    Array.isArray(error.body.documentErrors)
    ? error.body.documentErrors
    : [];
}
