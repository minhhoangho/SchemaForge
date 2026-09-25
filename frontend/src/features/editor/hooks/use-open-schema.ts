"use client";

import type { SchemaDetail } from "@schemaforge/api-contract";
import type { SchemaDocument } from "@schemaforge/core";
import { useEffect, useState } from "react";

import type { ApiClient } from "@/lib/api/api-client";
import { isCloudSchemaRecord } from "@/lib/storage/records";
import type {
  CloudSchemaRecord,
  SchemaRecord,
  ViewportRecord,
} from "@/lib/storage/records";
import type {
  OpenSchemaResult,
  SchemaRepository,
} from "@/lib/storage/schema-repository";
import { toStorageErrorCode } from "@/lib/storage/storage-error";
import type { StorageErrorCode } from "@/lib/storage/storage-error";
import {
  decideOpenAction,
  shouldFetchCloud,
} from "@/lib/sync/decide-open-action";
import type {
  CloudFetchResult,
  OpenAction,
  OpenActionFollowUp,
  OpenAuthContext,
} from "@/lib/sync/decide-open-action";

import { fetchCloudSchema } from "../lib/fetch-cloud-schema";

export type EditorCloudContext =
  | { readonly kind: "guest" }
  | {
      readonly kind: "owned";
      readonly userId: string;
      readonly followUp: OpenActionFollowUp;
      readonly pendingDialog:
        | null
        | { readonly kind: "conflict"; readonly cloud: SchemaDetail }
        | { readonly kind: "deleted-in-cloud" };
    };

type PendingDialog = Extract<
  EditorCloudContext,
  { kind: "owned" }
>["pendingDialog"];

export type OpenSchemaState =
  | { readonly kind: "opening" }
  | { readonly kind: "not-found"; readonly shouldOfferSignIn: boolean }
  | { readonly kind: "needs-network" }
  | { readonly kind: "deleted-elsewhere" }
  | { readonly kind: "unreadable"; readonly isVersionUnsupported: boolean }
  | { readonly kind: "storage-error"; readonly errorCode: StorageErrorCode }
  | {
      readonly kind: "opened";
      readonly document: SchemaDocument;
      readonly viewport: ViewportRecord | null;
      readonly cloud: EditorCloudContext;
    };

export type UseOpenSchemaInput = {
  readonly repository: SchemaRepository;
  readonly api: ApiClient;
  readonly auth: OpenAuthContext;
  readonly schemaId: string;
  readonly grantId: number | null;
  /** Grows each time the user asks to try again. */
  readonly attempt: number;
};

// Auth as primitives, so a new object with the same meaning starts no read.
type AuthParts = {
  readonly status: OpenAuthContext["status"];
  readonly userId: string | null;
};

// The state remembers which read it answers, so a new grant, attempt, auth,
// schema id or repository reads as opening until its own read settles.
type KeyedOpenState = Omit<UseOpenSchemaInput, "auth"> & {
  readonly auth: AuthParts;
  readonly openState: OpenSchemaState;
};

type ReadContext = {
  readonly repository: SchemaRepository;
  readonly schemaId: string;
  readonly auth: OpenAuthContext;
  readonly cached: SchemaRecord | null;
  readonly cachedDocument: OpenSchemaResult;
  readonly viewport: ViewportRecord | null;
  readonly cloud: CloudFetchResult | null;
};

const OPENING: OpenSchemaState = { kind: "opening" };

function toAuthParts(auth: OpenAuthContext): AuthParts {
  switch (auth.status) {
    case "signed-out":
      return { status: auth.status, userId: null };
    case "signed-in":
      return { status: auth.status, userId: auth.userId };
    case "expired":
      return { status: auth.status, userId: auth.lastUserId };
    default: {
      const unhandled: never = auth;
      return unhandled;
    }
  }
}

function fromAuthParts(parts: AuthParts): OpenAuthContext {
  switch (parts.status) {
    case "signed-out":
      return { status: "signed-out" };
    // toAuthParts always gives a signed-in user an id.
    case "signed-in":
      return parts.userId === null
        ? { status: "signed-out" }
        : { status: "signed-in", userId: parts.userId };
    case "expired":
      return { status: "expired", lastUserId: parts.userId };
    default: {
      const unhandled: never = parts.status;
      return unhandled;
    }
  }
}

function toCachedState(
  context: ReadContext,
  cloud: EditorCloudContext,
): OpenSchemaState {
  const result = context.cachedDocument;
  switch (result.kind) {
    case "opened":
      return {
        kind: "opened",
        document: result.document,
        viewport: context.viewport,
        cloud,
      };
    case "not-found":
      return { kind: "not-found", shouldOfferSignIn: false };
    case "unreadable":
      return {
        kind: "unreadable",
        isVersionUnsupported: result.errors.some(
          (error) => error.code === "version-unsupported",
        ),
      };
    default: {
      const unhandledResult: never = result;
      return unhandledResult;
    }
  }
}

function toOwnedContext(
  userId: string,
  followUp: OpenActionFollowUp,
  pendingDialog: PendingDialog,
): EditorCloudContext {
  return { kind: "owned", userId, followUp, pendingDialog };
}

function openCached(
  context: ReadContext,
  followUp: OpenActionFollowUp,
): OpenSchemaState {
  const { cached } = context;
  const cloud =
    cached !== null && isCloudSchemaRecord(cached)
      ? toOwnedContext(cached.ownerId, followUp, null)
      : { kind: "guest" as const };
  return toCachedState(context, cloud);
}

// The two dialog actions only follow an owned cache (decideOpenAction).
function requireOwnedCache(context: ReadContext): CloudSchemaRecord {
  const { cached } = context;
  if (cached === null || !isCloudSchemaRecord(cached)) {
    throw new Error("A cloud dialog needs an owned cache record.");
  }
  return cached;
}

async function openWithDialog(
  context: ReadContext,
  syncStatus: "conflict" | "deleted-in-cloud",
  pendingDialog: PendingDialog,
): Promise<OpenSchemaState> {
  const cached = requireOwnedCache(context);
  await context.repository.setSyncState(context.schemaId, {
    cloudRevision: cached.cloudRevision,
    syncStatus,
  });
  return toCachedState(
    context,
    toOwnedContext(cached.ownerId, "none", pendingDialog),
  );
}

async function storeCloudAndOpen(
  context: ReadContext,
  document: SchemaDocument,
  revision: number,
): Promise<OpenSchemaState> {
  const { auth, cloud } = context;
  // Only a signed-in fetch that found the schema leads here.
  if (auth.status !== "signed-in" || cloud?.kind !== "found") {
    throw new Error("Storing a cloud copy needs a signed-in cloud answer.");
  }
  await context.repository.writeCloudCopy({
    id: context.schemaId,
    ownerId: auth.userId,
    document,
    revision,
    createdAt: Date.parse(cloud.detail.createdAt),
    updatedAt: Date.parse(cloud.detail.updatedAt),
  });
  return {
    kind: "opened",
    document,
    viewport: context.viewport,
    cloud: toOwnedContext(auth.userId, "none", null),
  };
}

async function performAction(
  context: ReadContext,
  action: OpenAction,
): Promise<OpenSchemaState> {
  switch (action.kind) {
    case "open-cached":
      return openCached(context, action.followUp);
    case "store-cloud-and-open":
      return storeCloudAndOpen(context, action.document, action.revision);
    case "open-cached-with-conflict":
      return openWithDialog(context, "conflict", {
        kind: "conflict",
        cloud: action.cloud,
      });
    case "open-cached-deleted-in-cloud":
      return openWithDialog(context, "deleted-in-cloud", {
        kind: "deleted-in-cloud",
      });
    case "delete-cache-deleted-elsewhere":
      await context.repository.deleteSchema(context.schemaId);
      return { kind: "deleted-elsewhere" };
    case "not-found":
      return { kind: "not-found", shouldOfferSignIn: action.shouldOfferSignIn };
    case "needs-network":
      return { kind: "needs-network" };
    // Never written to the cache: this release cannot read it.
    case "cloud-version-unsupported":
      return { kind: "unreadable", isVersionUnsupported: true };
    default: {
      const unhandledAction: never = action;
      return unhandledAction;
    }
  }
}

type ReadInput = Pick<
  UseOpenSchemaInput,
  "repository" | "api" | "auth" | "schemaId"
> & { readonly signal: AbortSignal };

// A cancelled read writes nothing: after a sign-out elsewhere, a late cloud
// answer must not put the account's schema back into this browser.
function performUnlessCancelled(
  context: ReadContext,
  signal: AbortSignal,
): Promise<OpenSchemaState> {
  return signal.aborted
    ? Promise.resolve(OPENING)
    : performAction(context, decideOpenAction(context));
}

async function readSchema({
  repository,
  api,
  auth,
  schemaId,
  signal,
}: ReadInput): Promise<OpenSchemaState> {
  try {
    const [cached, cachedDocument, viewport] = await Promise.all([
      repository.readSchemaRecord(schemaId),
      repository.openSchema(schemaId),
      repository.readViewport(schemaId),
    ]);
    // The document is there but its record does not parse: damaged, as in
    // phase 3, rather than missing.
    if (cached === null && cachedDocument.kind !== "not-found") {
      return { kind: "unreadable", isVersionUnsupported: false };
    }
    const base = { repository, schemaId, cached, cachedDocument, viewport };
    if (auth.status !== "signed-in" || !shouldFetchCloud({ auth, cached })) {
      return await performUnlessCancelled(
        { ...base, auth, cloud: null },
        signal,
      );
    }
    const attempt = await fetchCloudSchema(api, schemaId, { signal });
    // The API client has marked the session expired; the cache is decided
    // for the user who was signed in a moment ago.
    const context: ReadContext =
      attempt.kind === "session-expired"
        ? {
            ...base,
            auth: { status: "expired", lastUserId: auth.userId },
            cloud: null,
          }
        : { ...base, auth, cloud: attempt.result };
    return await performUnlessCancelled(context, signal);
  } catch (error: unknown) {
    return { kind: "storage-error", errorCode: toStorageErrorCode(error) };
  }
}

/**
 * Reads one schema once this tab holds its lock (`grantId` is not null),
 * asks the cloud when decideOpenAction needs it, and carries out the decided
 * action under that lock. A new grant or attempt reads again; a change of auth
 * reads again only until the schema has opened. A document that cannot be
 * parsed is never written back.
 */
export function useOpenSchema({
  repository,
  api,
  auth,
  schemaId,
  grantId,
  attempt,
}: UseOpenSchemaInput): OpenSchemaState {
  const [keyedState, setKeyedState] = useState<KeyedOpenState | null>(null);
  const isSameTarget =
    grantId !== null &&
    keyedState !== null &&
    keyedState.repository === repository &&
    keyedState.api === api &&
    keyedState.schemaId === schemaId &&
    keyedState.grantId === grantId &&
    keyedState.attempt === attempt;
  // Once open, a change of auth is handled by the editor (push, dialogs,
  // leaving on sign-out), never by reading the schema again.
  const readAuth =
    isSameTarget && keyedState.openState.kind === "opened"
      ? keyedState.auth
      : toAuthParts(auth);
  const { status: authStatus, userId: authUserId } = readAuth;

  useEffect(() => {
    if (grantId === null) {
      return;
    }
    const controller = new AbortController();
    const parts: AuthParts = { status: authStatus, userId: authUserId };
    // Fire and forget: readSchema never rejects, it maps every error.
    void readSchema({
      repository,
      api,
      auth: fromAuthParts(parts),
      schemaId,
      signal: controller.signal,
    }).then((openState) => {
      if (!controller.signal.aborted) {
        setKeyedState({
          repository,
          api,
          schemaId,
          grantId,
          attempt,
          auth: parts,
          openState,
        });
      }
    });
    return () => {
      controller.abort();
    };
  }, [repository, api, schemaId, grantId, attempt, authStatus, authUserId]);

  const isCurrent =
    isSameTarget &&
    keyedState.auth.status === authStatus &&
    keyedState.auth.userId === authUserId;
  return isCurrent ? keyedState.openState : OPENING;
}
