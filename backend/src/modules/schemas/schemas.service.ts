import { Injectable, Logger } from "@nestjs/common";
import {
  API_ERROR_STATUS,
  type CreateSchemaRequest,
  MAX_SCHEMAS_PER_USER,
  type SchemaDetail,
  type SchemaList,
  type SchemaSummary,
  type UpdateSchemaRequest,
} from "@schemaforge/api-contract";
import { parseSchemaDocument, type SchemaDocument } from "@schemaforge/core";

import { ApiException } from "../../common/api.exception.js";
import type { ListSchemasQueryDto } from "./dto/list-schemas-query.dto.js";
import {
  decodeSchemaListCursor,
  encodeSchemaListCursor,
  type SchemaListCursor,
} from "./schema-list-cursor.js";
import { toSchemaDetail, toSchemaSummary } from "./schemas.mapper.js";
import { SchemasRepository } from "./schemas.repository.js";

/** Keeps an error response bounded whatever the size of a broken document. */
export const MAX_DOCUMENT_ERRORS = 100;

function notFound(): ApiException {
  return new ApiException({
    statusCode: API_ERROR_STATUS["not-found"],
    code: "not-found",
  });
}

/**
 * `ownerId` always comes from the access token and is passed to every
 * repository call, so a schema of another user answers `404`, never `403`.
 */
@Injectable()
export class SchemasService {
  private readonly logger = new Logger(SchemasService.name);

  constructor(private readonly repository: SchemasRepository) {}

  async list(ownerId: string, query: ListSchemasQueryDto): Promise<SchemaList> {
    const rows = await this.repository.listPage({
      ownerId,
      take: query.limit + 1,
      after: this.toCursor(query.cursor),
    });
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    const hasMore = rows.length > query.limit;
    return {
      items: page.map(toSchemaSummary),
      nextCursor:
        hasMore && last !== undefined
          ? encodeSchemaListCursor({ updatedAt: last.updatedAt, id: last.id })
          : null,
    };
  }

  async get(ownerId: string, id: string): Promise<SchemaDetail> {
    const record = await this.repository.findDetail(id, ownerId);
    if (record === null) {
      throw notFound();
    }
    const parsed = parseSchemaDocument(record.document);
    if (!parsed.isOk) {
      const codes = parsed.error.map((error) => error.code).join(",");
      this.logger.error(
        `Stored schema document failed to parse schemaId=${id} codes=${codes}`,
      );
      throw new ApiException({
        statusCode: API_ERROR_STATUS["internal-error"],
        code: "internal-error",
      });
    }
    return toSchemaDetail(record, parsed.value);
  }

  async create(
    ownerId: string,
    request: CreateSchemaRequest,
  ): Promise<SchemaSummary> {
    const document = this.parseOrReject(request.document);
    const created = await this.repository.createWithinLimit(
      { id: request.id, ownerId, document },
      MAX_SCHEMAS_PER_USER,
    );
    if (created === null) {
      throw new ApiException({
        statusCode: API_ERROR_STATUS["schema-limit-reached"],
        code: "schema-limit-reached",
      });
    }
    return toSchemaSummary(created);
  }

  async update(
    ownerId: string,
    id: string,
    request: UpdateSchemaRequest,
  ): Promise<SchemaSummary> {
    const document = this.parseOrReject(request.document);
    const updated = await this.repository.updateIfRevision(
      { id, ownerId, document },
      request.expectedRevision,
    );
    if (updated !== null) {
      return toSchemaSummary(updated);
    }
    const currentRevision = await this.repository.findRevision(id, ownerId);
    if (currentRevision === null) {
      throw notFound();
    }
    throw new ApiException({
      statusCode: API_ERROR_STATUS["revision-conflict"],
      code: "revision-conflict",
      currentRevision,
    });
  }

  async remove(ownerId: string, id: string): Promise<void> {
    const isDeleted = await this.repository.deleteOwned(id, ownerId);
    if (!isDeleted) {
      throw notFound();
    }
  }

  /** Semantic issues never block a write, so `validateSchema` is not called. */
  private parseOrReject(document: unknown): SchemaDocument {
    const parsed = parseSchemaDocument(document);
    if (!parsed.isOk) {
      throw new ApiException({
        statusCode: API_ERROR_STATUS["document-invalid"],
        code: "document-invalid",
        documentErrors: parsed.error.slice(0, MAX_DOCUMENT_ERRORS),
      });
    }
    return parsed.value;
  }

  private toCursor(value: string | undefined): SchemaListCursor | null {
    if (value === undefined) {
      return null;
    }
    const decoded = decodeSchemaListCursor(value);
    if (!decoded.isOk) {
      throw new ApiException({
        statusCode: API_ERROR_STATUS["validation-failed"],
        code: "validation-failed",
        fields: [{ path: "cursor", constraint: "isSchemaListCursor" }],
      });
    }
    return decoded.value;
  }
}
