import { MAX_REQUEST_BODY_BYTES } from "@schemaforge/api-contract";
import type { SchemaDocument } from "@schemaforge/core";

import type { ApiClient } from "@/lib/api/api-client";
import { isApiErrorCode } from "@/lib/api/api-failure";
import type { ApiFailure } from "@/lib/api/api-failure";
import type { SchemaLockManager } from "@/lib/storage/schema-lock-manager";
import type { SchemaRepository } from "@/lib/storage/schema-repository";

import { documentsEqual } from "./documents-equal";

export type UploadSkipReason =
  "locked" | "unreadable" | "too-large" | "rejected";

// unavailable: network, timeout, 5xx, 429, invalid-response, 401.
export type UploadStopReason = "schema-limit-reached" | "unavailable";

export type UploadReport = {
  readonly uploadedIds: readonly string[];
  readonly skipped: readonly {
    readonly schemaId: string;
    readonly reason: UploadSkipReason;
  }[];
  readonly stoppedBy: UploadStopReason | null;
  readonly notAttemptedIds: readonly string[];
  // Old id -> new id, recorded as soon as changeSchemaId commits, regardless
  // of whether the create that follows succeeds, is rejected, or stops the
  // run: the local record has already moved, so this reflects local storage,
  // not whether the schema also reached the cloud (see uploadedIds/skipped/
  // stoppedBy for that).
  readonly movedIds: ReadonlyMap<string, string>;
};

export type UploadLocalSchemasInput = {
  readonly api: ApiClient;
  readonly repository: SchemaRepository;
  readonly lockManager: SchemaLockManager;
  readonly userId: string;
  readonly schemaIds: readonly string[];
  readonly heldLockSchemaId?: string;
  readonly generateId: () => string;
};

type UploadContext = {
  readonly api: ApiClient;
  readonly repository: SchemaRepository;
  readonly userId: string;
  readonly generateId: () => string;
};

type StepResult =
  // The record is gone or already has an owner; nothing is reported for it.
  | { readonly kind: "not-guest" }
  | {
      readonly kind: "uploaded";
      readonly id: string;
      readonly movedFrom?: string;
    }
  | {
      readonly kind: "skip";
      readonly reason: UploadSkipReason;
      readonly movedFrom?: string;
      readonly movedTo?: string;
    }
  | {
      readonly kind: "stop";
      readonly reason: UploadStopReason;
      readonly movedFrom?: string;
      readonly movedTo?: string;
    };

type CreateFailureCategory =
  "schema-limit-reached" | "rejected" | "id-unavailable" | "unavailable";

function isOversized(document: SchemaDocument): boolean {
  const byteLength = new TextEncoder().encode(
    JSON.stringify(document),
  ).byteLength;
  return byteLength > MAX_REQUEST_BODY_BYTES;
}

function classifyCreateFailure(failure: ApiFailure): CreateFailureCategory {
  if (isApiErrorCode(failure, "schema-limit-reached")) {
    return "schema-limit-reached";
  }
  if (
    isApiErrorCode(failure, "payload-too-large") ||
    isApiErrorCode(failure, "document-invalid") ||
    isApiErrorCode(failure, "validation-failed")
  ) {
    // A retry never fixes these: the document itself is rejected, unlike
    // origin-not-allowed or a schema limit, which are not about this
    // document and so fall through to "unavailable" below.
    return "rejected";
  }
  if (isApiErrorCode(failure, "schema-id-unavailable")) {
    return "id-unavailable";
  }
  return "unavailable";
}

// canResolveId is false on the retry after a move, so a second
// schema-id-unavailable is treated as rejected instead of moving again.
async function sendCreate(
  context: UploadContext,
  schemaId: string,
  document: SchemaDocument,
  canResolveId: boolean,
): Promise<StepResult> {
  const result = await context.api.schemas.create({ id: schemaId, document });
  if (result.isOk) {
    await context.repository.assignOwner(schemaId, {
      ownerId: context.userId,
      cloudRevision: result.value.revision,
      syncStatus: "synced",
    });
    return { kind: "uploaded", id: schemaId };
  }
  return handleCreateFailure(
    context,
    schemaId,
    document,
    result.error,
    canResolveId,
  );
}

async function handleCreateFailure(
  context: UploadContext,
  schemaId: string,
  document: SchemaDocument,
  failure: ApiFailure,
  canResolveId: boolean,
): Promise<StepResult> {
  const category = classifyCreateFailure(failure);
  switch (category) {
    case "schema-limit-reached":
      return { kind: "stop", reason: "schema-limit-reached" };
    case "rejected":
      return { kind: "skip", reason: "rejected" };
    case "unavailable":
      return { kind: "stop", reason: "unavailable" };
    case "id-unavailable":
      return canResolveId
        ? resolveTakenId(context, schemaId, document)
        : { kind: "skip", reason: "rejected" };
    default: {
      const unhandledCategory: never = category;
      return unhandledCategory;
    }
  }
}

// A 409 on create means the id already exists in the cloud: either the
// retry of a lost response (same document) or another account's id.
async function resolveTakenId(
  context: UploadContext,
  schemaId: string,
  document: SchemaDocument,
): Promise<StepResult> {
  const cloud = await context.api.schemas.get(schemaId);
  if (cloud.isOk) {
    const syncStatus = documentsEqual(cloud.value.document, document)
      ? "synced"
      : "conflict";
    await context.repository.assignOwner(schemaId, {
      ownerId: context.userId,
      cloudRevision: cloud.value.revision,
      syncStatus,
    });
    return { kind: "uploaded", id: schemaId };
  }
  if (!isApiErrorCode(cloud.error, "not-found")) {
    return { kind: "stop", reason: "unavailable" };
  }
  return moveAndRecreate(context, schemaId, document);
}

// Attaches the move to every outcome of the retry, not only a successful
// one: changeSchemaId already committed before this call, so the record
// really lives at newSchemaId in storage regardless of whether the retry
// succeeds, is rejected, or stops the whole run.
function attachMove(
  outcome: StepResult,
  oldSchemaId: string,
  newSchemaId: string,
): StepResult {
  switch (outcome.kind) {
    case "uploaded":
      return { ...outcome, movedFrom: oldSchemaId };
    case "skip":
    case "stop":
      return { ...outcome, movedFrom: oldSchemaId, movedTo: newSchemaId };
    case "not-guest":
      return outcome;
    default: {
      const unhandledKind: never = outcome;
      return unhandledKind;
    }
  }
}

async function moveAndRecreate(
  context: UploadContext,
  schemaId: string,
  document: SchemaDocument,
): Promise<StepResult> {
  const newSchemaId = context.generateId();
  const moveStatus = await context.repository.changeSchemaId(
    schemaId,
    newSchemaId,
  );
  if (moveStatus !== "moved") {
    return { kind: "skip", reason: "rejected" };
  }
  const outcome = await sendCreate(context, newSchemaId, document, false);
  return attachMove(outcome, schemaId, newSchemaId);
}

async function uploadGuestSchema(
  context: UploadContext,
  schemaId: string,
): Promise<StepResult> {
  const record = await context.repository.readSchemaRecord(schemaId);
  // A missing record reads as undefined here, which is also not null, so a
  // deleted or already-owned schema is treated the same way.
  if (record?.ownerId !== null) {
    return { kind: "not-guest" };
  }
  const opened = await context.repository.openSchema(schemaId);
  if (opened.kind !== "opened") {
    return { kind: "skip", reason: "unreadable" };
  }
  if (isOversized(opened.document)) {
    return { kind: "skip", reason: "too-large" };
  }
  return sendCreate(context, schemaId, opened.document, true);
}

async function processSchema(
  context: UploadContext,
  lockManager: SchemaLockManager,
  heldLockSchemaId: string | undefined,
  schemaId: string,
): Promise<StepResult> {
  if (schemaId === heldLockSchemaId) {
    return uploadGuestSchema(context, schemaId);
  }
  const lock = await lockManager.tryAcquire(schemaId);
  if (lock === null) {
    return { kind: "skip", reason: "locked" };
  }
  try {
    return await uploadGuestSchema(context, schemaId);
  } finally {
    lock.release();
  }
}

function recordMove(
  movedIds: Map<string, string>,
  movedFrom: string | undefined,
  movedTo: string | undefined,
): void {
  if (movedFrom !== undefined && movedTo !== undefined) {
    movedIds.set(movedFrom, movedTo);
  }
}

/**
 * Uploads each guest schema in order: create it in the cloud, then assign it
 * to the signed-in user in the same step that confirmed the create. A schema
 * whose lock cannot be acquired, whose document cannot be read, or that is
 * over the size limit is skipped; the rest of the run continues. A schema
 * limit or an unavailable backend stops the whole run: notAttemptedIds then
 * holds the schema that triggered the stop and every id after it, and the
 * rest are left untouched.
 */
export async function uploadLocalSchemas(
  input: UploadLocalSchemasInput,
): Promise<UploadReport> {
  const context: UploadContext = {
    api: input.api,
    repository: input.repository,
    userId: input.userId,
    generateId: input.generateId,
  };
  const uploadedIds: string[] = [];
  const skipped: {
    readonly schemaId: string;
    readonly reason: UploadSkipReason;
  }[] = [];
  const movedIds = new Map<string, string>();
  let stoppedBy: UploadStopReason | null = null;
  let stoppedAtIndex = -1;

  for (const [index, schemaId] of input.schemaIds.entries()) {
    const result = await processSchema(
      context,
      input.lockManager,
      input.heldLockSchemaId,
      schemaId,
    );
    if (result.kind === "not-guest") {
      continue;
    }
    if (result.kind === "uploaded") {
      uploadedIds.push(result.id);
      recordMove(movedIds, result.movedFrom, result.id);
      continue;
    }
    recordMove(movedIds, result.movedFrom, result.movedTo);
    if (result.kind === "skip") {
      skipped.push({ schemaId, reason: result.reason });
      continue;
    }
    stoppedBy = result.reason;
    stoppedAtIndex = index;
    break;
  }

  // The schema that caused the stop was attempted, but landed in neither
  // uploadedIds nor skipped, so it belongs in notAttemptedIds too: every id
  // then falls into exactly one bucket.
  const notAttemptedIds =
    stoppedAtIndex === -1 ? [] : input.schemaIds.slice(stoppedAtIndex);

  return { uploadedIds, skipped, stoppedBy, notAttemptedIds, movedIds };
}
