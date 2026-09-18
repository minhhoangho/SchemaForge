import { MAX_REQUEST_BODY_BYTES } from "@schemaforge/api-contract";
import type { SchemaDetail } from "@schemaforge/api-contract";
import type { Result, SchemaDocument } from "@schemaforge/core";

import type { ApiClient } from "@/lib/api/api-client";
import { isApiErrorCode } from "@/lib/api/api-failure";
import type { ApiFailure } from "@/lib/api/api-failure";
import type { CloudSchemaRecord } from "@/lib/storage/records";
import type { SchemaRepository } from "@/lib/storage/schema-repository";

import { documentsEqual } from "./documents-equal";

export type PushFailureCode =
  | "payload-too-large"
  | "schema-limit-reached"
  | "document-invalid"
  | "version-unsupported"
  | "schema-id-unavailable";

export type PushOutcome =
  | { readonly kind: "synced"; readonly revision: number }
  | { readonly kind: "changed-while-sending"; readonly revision: number }
  | { readonly kind: "conflict"; readonly cloud: SchemaDetail | null }
  | { readonly kind: "deleted-in-cloud" }
  | { readonly kind: "failed"; readonly code: PushFailureCode }
  | { readonly kind: "session-expired" }
  | {
      readonly kind: "retryable";
      readonly retryAfterSeconds: number | null;
      // Lets the pusher tell "offline" from "server" without a second probe.
      readonly failure: ApiFailure["kind"];
    }
  // The record is gone, belongs to a guest or another account, or is not
  // pending.
  | { readonly kind: "not-pushable" };

export type PushSchemaOnceInput = {
  readonly api: ApiClient;
  readonly repository: SchemaRepository;
  readonly schemaId: string;
  readonly userId: string;
};

type PushContext = PushSchemaOnceInput & {
  readonly record: CloudSchemaRecord;
  readonly document: SchemaDocument;
};

const UNAUTHORIZED_STATUS = 401;
const NOT_PUSHABLE: PushOutcome = { kind: "not-pushable" };

function isOversized(document: SchemaDocument): boolean {
  const byteLength = new TextEncoder().encode(
    JSON.stringify(document),
  ).byteLength;
  return byteLength > MAX_REQUEST_BODY_BYTES;
}

async function readPushable(
  input: PushSchemaOnceInput,
): Promise<PushContext | null> {
  const record = await input.repository.readSchemaRecord(input.schemaId);
  if (record?.ownerId !== input.userId || record.syncStatus !== "pending") {
    return null;
  }
  const opened = await input.repository.openSchema(input.schemaId);
  return opened.kind === "opened"
    ? { ...input, record, document: opened.document }
    : null;
}

async function completePush(
  context: PushContext,
  revision: number,
): Promise<PushOutcome> {
  const status = await context.repository.completePush(context.schemaId, {
    revision,
    sentUpdatedAt: context.record.updatedAt,
  });
  switch (status) {
    case "synced":
      return { kind: "synced", revision };
    case "pending":
      return { kind: "changed-while-sending", revision };
    case "not-found":
      return NOT_PUSHABLE;
    default: {
      const unhandledStatus: never = status;
      return unhandledStatus;
    }
  }
}

async function markSyncStatus(
  context: PushContext,
  syncStatus: "conflict" | "deleted-in-cloud",
): Promise<void> {
  await context.repository.setSyncState(context.schemaId, {
    cloudRevision: context.record.cloudRevision,
    syncStatus,
  });
}

async function markConflict(
  context: PushContext,
  cloud: SchemaDetail | null,
): Promise<PushOutcome> {
  await markSyncStatus(context, "conflict");
  return { kind: "conflict", cloud };
}

function toTransientOutcome(failure: ApiFailure): PushOutcome {
  if (failure.kind === "http" && failure.status === UNAUTHORIZED_STATUS) {
    return { kind: "session-expired" };
  }
  return {
    kind: "retryable",
    retryAfterSeconds:
      failure.kind === "http" ? failure.retryAfterSeconds : null,
    failure: failure.kind,
  };
}

async function loadConflict(context: PushContext): Promise<PushOutcome> {
  const cloud = await context.api.schemas.get(context.schemaId);
  return markConflict(context, cloud.isOk ? cloud.value : null);
}

// A create whose response was lost leaves the row in the cloud, so the retry
// gets schema-id-unavailable; an equal cloud document means it already landed.
async function resolveTakenId(context: PushContext): Promise<PushOutcome> {
  const cloud = await context.api.schemas.get(context.schemaId);
  if (cloud.isOk) {
    return documentsEqual(cloud.value.document, context.document)
      ? completePush(context, cloud.value.revision)
      : markConflict(context, cloud.value);
  }
  if (isApiErrorCode(cloud.error, "not-found")) {
    return { kind: "failed", code: "schema-id-unavailable" };
  }
  return toTransientOutcome(cloud.error);
}

function toRejectionCode(failure: ApiFailure): PushFailureCode | null {
  if (failure.kind !== "http") {
    return null;
  }
  const { body } = failure;
  if (body.code === "document-invalid") {
    return body.documentErrors.some(
      (error) => error.code === "version-unsupported",
    )
      ? "version-unsupported"
      : "document-invalid";
  }
  return body.code === "schema-limit-reached" ||
    body.code === "payload-too-large"
    ? body.code
    : null;
}

async function handleFailure(
  context: PushContext,
  failure: ApiFailure,
): Promise<PushOutcome> {
  if (isApiErrorCode(failure, "revision-conflict")) {
    return loadConflict(context);
  }
  if (isApiErrorCode(failure, "schema-id-unavailable")) {
    return resolveTakenId(context);
  }
  const isUpdate = context.record.cloudRevision !== null;
  if (isUpdate && isApiErrorCode(failure, "not-found")) {
    await markSyncStatus(context, "deleted-in-cloud");
    return { kind: "deleted-in-cloud" };
  }
  const code = toRejectionCode(failure);
  if (code !== null) {
    return { kind: "failed", code };
  }
  // 429, 5xx, network, timeout and invalid-response retry with backoff. Codes
  // outside the push table (a 400, or 403 origin-not-allowed) are not fixed
  // by editing the document either, so they back off the same way.
  return toTransientOutcome(failure);
}

function sendDocument(
  context: PushContext,
): Promise<Result<{ readonly revision: number }, ApiFailure>> {
  const { api, schemaId, document, record } = context;
  return record.cloudRevision === null
    ? api.schemas.create({ id: schemaId, document })
    : api.schemas.update(schemaId, {
        document,
        expectedRevision: record.cloudRevision,
      });
}

/**
 * Sends the whole cached document of one owned, pending schema to the cloud
 * once and records the result in the cache. The caller already holds the
 * schema's Web Lock; this function takes no lock.
 */
export async function pushSchemaOnce(
  input: PushSchemaOnceInput,
): Promise<PushOutcome> {
  const context = await readPushable(input);
  if (context === null) {
    return NOT_PUSHABLE;
  }
  if (isOversized(context.document)) {
    return { kind: "failed", code: "payload-too-large" };
  }
  const result = await sendDocument(context);
  return result.isOk
    ? completePush(context, result.value.revision)
    : handleFailure(context, result.error);
}
