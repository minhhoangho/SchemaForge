import { Injectable } from "@nestjs/common";
import type { SchemaDocument } from "@schemaforge/core";

import type { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { SchemaListCursor } from "./schema-list-cursor.js";

export const SCHEMA_SUMMARY_SELECT = {
  id: true,
  name: true,
  revision: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.SchemaSelect;

export const SCHEMA_DETAIL_SELECT = {
  ...SCHEMA_SUMMARY_SELECT,
  document: true,
} as const satisfies Prisma.SchemaSelect;

const SCHEMA_REVISION_SELECT = {
  revision: true,
} as const satisfies Prisma.SchemaSelect;

export type SchemaSummaryRecord = Prisma.SchemaGetPayload<{
  select: typeof SCHEMA_SUMMARY_SELECT;
}>;

export type SchemaDetailRecord = Prisma.SchemaGetPayload<{
  select: typeof SCHEMA_DETAIL_SELECT;
}>;

export type SchemaWrite = {
  readonly id: string;
  readonly ownerId: string;
  readonly document: SchemaDocument;
};

/** A parsed document is already plain JSON data, so no cast is needed here. */
function toJsonInput(document: SchemaDocument): Prisma.InputJsonValue {
  return document;
}

function buildListWhere(
  ownerId: string,
  after: SchemaListCursor | null,
): Prisma.SchemaWhereInput {
  return after === null
    ? { ownerId }
    : {
        ownerId,
        OR: [
          { updatedAt: { lt: after.updatedAt } },
          { updatedAt: after.updatedAt, id: { lt: after.id } },
        ],
      };
}

/**
 * The only place that touches `prisma.schema`. Every query carries `ownerId`,
 * so a schema of another user is never read, written or deleted. Prisma errors
 * (such as `P2002` on a duplicate id) travel up to `ApiExceptionFilter`.
 */
@Injectable()
export class SchemasRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listPage(input: {
    readonly ownerId: string;
    readonly take: number;
    readonly after: SchemaListCursor | null;
  }): Promise<readonly SchemaSummaryRecord[]> {
    return this.prisma.schema.findMany({
      where: buildListWhere(input.ownerId, input.after),
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: input.take,
      select: SCHEMA_SUMMARY_SELECT,
    });
  }

  findDetail(id: string, ownerId: string): Promise<SchemaDetailRecord | null> {
    return this.prisma.schema.findFirst({
      where: { id, ownerId },
      select: SCHEMA_DETAIL_SELECT,
    });
  }

  async findRevision(id: string, ownerId: string): Promise<number | null> {
    const record = await this.prisma.schema.findFirst({
      where: { id, ownerId },
      select: SCHEMA_REVISION_SELECT,
    });
    return record?.revision ?? null;
  }

  /** Returns null when the owner is already at `maxSchemas`; a soft limit (spec section 5). */
  createWithinLimit(
    write: SchemaWrite,
    maxSchemas: number,
  ): Promise<SchemaSummaryRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const owned = await tx.schema.count({
        where: { ownerId: write.ownerId },
      });
      if (owned >= maxSchemas) {
        return null;
      }
      return tx.schema.create({
        data: {
          id: write.id,
          ownerId: write.ownerId,
          name: write.document.name,
          document: toJsonInput(write.document),
        },
        select: SCHEMA_SUMMARY_SELECT,
      });
    });
  }

  /** One conditional `UPDATE … RETURNING`, so concurrent writers cannot both win. */
  async updateIfRevision(
    write: SchemaWrite,
    expectedRevision: number,
  ): Promise<SchemaSummaryRecord | null> {
    const updated = await this.prisma.schema.updateManyAndReturn({
      where: {
        id: write.id,
        ownerId: write.ownerId,
        revision: expectedRevision,
      },
      data: {
        document: toJsonInput(write.document),
        name: write.document.name,
        revision: { increment: 1 },
      },
      select: SCHEMA_SUMMARY_SELECT,
    });
    return updated[0] ?? null;
  }

  async deleteOwned(id: string, ownerId: string): Promise<boolean> {
    const deleted = await this.prisma.schema.deleteMany({
      where: { id, ownerId },
    });
    return deleted.count > 0;
  }
}
