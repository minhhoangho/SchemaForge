import { Test } from "@nestjs/testing";
import { buildSchema, makeTable } from "@schemaforge/core/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../prisma/prisma.service.js";
import {
  SCHEMA_SUMMARY_SELECT,
  SchemasRepository,
} from "./schemas.repository.js";

const SCHEMA_ID = "0190f3a0-0000-7000-8000-000000000001";
const OTHER_SCHEMA_ID = "0190f3a0-0000-7000-8000-000000000002";
const OWNER_ID = "0190f3a0-0000-7000-8000-0000000000ff";
const CURSOR_UPDATED_AT = new Date("2026-09-18T10:00:00.000Z");
const MAX_SCHEMAS = 2;

const DOCUMENT = buildSchema({
  name: "orders",
  tables: [makeTable({ id: "tbl_orders" })],
});

const SUMMARY = {
  id: SCHEMA_ID,
  name: "orders",
  revision: 1,
  createdAt: CURSOR_UPDATED_AT,
  updatedAt: CURSOR_UPDATED_AT,
};

function createFakePrisma() {
  const schema = {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue(SUMMARY),
    updateManyAndReturn: vi.fn().mockResolvedValue([]),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  };
  const client = { schema, $transaction: vi.fn() };
  client.$transaction.mockImplementation(
    (run: (tx: typeof client) => unknown) => run(client),
  );
  return client;
}

describe("SchemasRepository", () => {
  let prisma: ReturnType<typeof createFakePrisma>;
  let repository: SchemasRepository;

  beforeEach(async () => {
    prisma = createFakePrisma();
    const moduleRef = await Test.createTestingModule({
      providers: [
        SchemasRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    repository = moduleRef.get(SchemasRepository);
  });

  it("orders the list by updatedAt then id descending without selecting the document", async () => {
    await repository.listPage({ ownerId: OWNER_ID, take: 10, after: null });

    expect(prisma.schema.findMany).toHaveBeenCalledWith({
      where: { ownerId: OWNER_ID },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 10,
      select: SCHEMA_SUMMARY_SELECT,
    });
    expect(SCHEMA_SUMMARY_SELECT).not.toHaveProperty("document");
  });

  it("adds the keyset condition when a cursor is given", async () => {
    await repository.listPage({
      ownerId: OWNER_ID,
      take: 10,
      after: { updatedAt: CURSOR_UPDATED_AT, id: SCHEMA_ID },
    });

    expect(prisma.schema.findMany).toHaveBeenCalledWith({
      where: {
        ownerId: OWNER_ID,
        OR: [
          { updatedAt: { lt: CURSOR_UPDATED_AT } },
          { updatedAt: CURSOR_UPDATED_AT, id: { lt: SCHEMA_ID } },
        ],
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 10,
      select: SCHEMA_SUMMARY_SELECT,
    });
  });

  it("scopes the detail lookup by id and owner", async () => {
    await repository.findDetail(SCHEMA_ID, OWNER_ID);

    expect(prisma.schema.findFirst).toHaveBeenCalledWith({
      where: { id: SCHEMA_ID, ownerId: OWNER_ID },
      select: { ...SCHEMA_SUMMARY_SELECT, document: true },
    });
  });

  it("scopes the revision lookup by id and owner", async () => {
    prisma.schema.findFirst.mockResolvedValueOnce({ revision: 4 });

    const revision = await repository.findRevision(SCHEMA_ID, OWNER_ID);

    expect(prisma.schema.findFirst).toHaveBeenCalledWith({
      where: { id: SCHEMA_ID, ownerId: OWNER_ID },
      select: { revision: true },
    });
    expect(revision).toBe(4);
  });

  it("returns null without creating when the owner already has the maximum number of schemas", async () => {
    prisma.schema.count.mockResolvedValueOnce(MAX_SCHEMAS);

    const created = await repository.createWithinLimit(
      { id: SCHEMA_ID, ownerId: OWNER_ID, document: DOCUMENT },
      MAX_SCHEMAS,
    );

    expect(created).toBeNull();
    expect(prisma.schema.create).not.toHaveBeenCalled();
    expect(prisma.schema.count).toHaveBeenCalledWith({
      where: { ownerId: OWNER_ID },
    });
  });

  it("creates the schema with the document name inside the transaction", async () => {
    const created = await repository.createWithinLimit(
      { id: SCHEMA_ID, ownerId: OWNER_ID, document: DOCUMENT },
      MAX_SCHEMAS,
    );

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.schema.create).toHaveBeenCalledWith({
      data: {
        id: SCHEMA_ID,
        ownerId: OWNER_ID,
        name: "orders",
        document: DOCUMENT,
      },
      select: SCHEMA_SUMMARY_SELECT,
    });
    expect(created).toEqual(SUMMARY);
  });

  it("updates only a row matching id, owner and expected revision and increments the revision", async () => {
    prisma.schema.updateManyAndReturn.mockResolvedValueOnce([SUMMARY]);

    const updated = await repository.updateIfRevision(
      { id: SCHEMA_ID, ownerId: OWNER_ID, document: DOCUMENT },
      2,
    );

    expect(prisma.schema.updateManyAndReturn).toHaveBeenCalledWith({
      where: { id: SCHEMA_ID, ownerId: OWNER_ID, revision: 2 },
      data: {
        document: DOCUMENT,
        name: "orders",
        revision: { increment: 1 },
      },
      select: SCHEMA_SUMMARY_SELECT,
    });
    expect(updated).toEqual(SUMMARY);
  });

  it("returns null when no row matches the conditional update", async () => {
    const updated = await repository.updateIfRevision(
      { id: OTHER_SCHEMA_ID, ownerId: OWNER_ID, document: DOCUMENT },
      2,
    );

    expect(updated).toBeNull();
  });

  it("scopes delete by id and owner", async () => {
    prisma.schema.deleteMany.mockResolvedValueOnce({ count: 1 });

    const isDeleted = await repository.deleteOwned(SCHEMA_ID, OWNER_ID);

    expect(prisma.schema.deleteMany).toHaveBeenCalledWith({
      where: { id: SCHEMA_ID, ownerId: OWNER_ID },
    });
    expect(isDeleted).toBe(true);
  });

  it("reports no deletion when no row matched", async () => {
    const isDeleted = await repository.deleteOwned(SCHEMA_ID, OWNER_ID);

    expect(isDeleted).toBe(false);
  });
});
