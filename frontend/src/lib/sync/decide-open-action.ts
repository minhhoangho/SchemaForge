import type { SchemaDetail } from "@schemaforge/api-contract";
import type { SchemaDocument, StructuralError } from "@schemaforge/core";
import { parseSchemaDocument } from "@schemaforge/core";

import { isCloudSchemaRecord } from "@/lib/storage/records";
import type { CloudSchemaRecord, SchemaRecord } from "@/lib/storage/records";

export type OpenAuthContext =
  | { readonly status: "signed-out" }
  | { readonly status: "signed-in"; readonly userId: string }
  | { readonly status: "expired"; readonly lastUserId: string | null };

export type CloudFetchResult =
  | { readonly kind: "found"; readonly detail: SchemaDetail }
  | { readonly kind: "not-found" }
  // Covers network failure, timeout, an invalid response shape, 5xx and 429.
  | { readonly kind: "unavailable" };

export type OpenActionFollowUp =
  | "none"
  | "push-create"
  | "push-update"
  | "retry-when-online"
  | "wait-for-sign-in";

export type OpenAction =
  | { readonly kind: "open-cached"; readonly followUp: OpenActionFollowUp }
  | {
      readonly kind: "store-cloud-and-open";
      readonly document: SchemaDocument;
      readonly revision: number;
    }
  | {
      readonly kind: "open-cached-with-conflict";
      readonly cloud: SchemaDetail;
    }
  | { readonly kind: "open-cached-deleted-in-cloud" }
  | { readonly kind: "delete-cache-deleted-elsewhere" }
  | { readonly kind: "not-found"; readonly shouldOfferSignIn: boolean }
  | { readonly kind: "needs-network" }
  | { readonly kind: "cloud-version-unsupported" };

function isPendingCreate(record: CloudSchemaRecord): boolean {
  return record.syncStatus === "pending" && record.cloudRevision === null;
}

function ownsRecord(record: CloudSchemaRecord, auth: OpenAuthContext): boolean {
  switch (auth.status) {
    case "signed-in":
      return record.ownerId === auth.userId;
    case "expired":
      return record.ownerId === auth.lastUserId;
    case "signed-out":
      return false;
    default: {
      const unhandled: never = auth;
      return unhandled;
    }
  }
}

export function shouldFetchCloud(input: {
  readonly auth: OpenAuthContext;
  readonly cached: SchemaRecord | null;
}): boolean {
  const { auth, cached } = input;
  if (auth.status !== "signed-in") {
    return false;
  }
  if (cached === null) {
    return true;
  }
  return (
    isCloudSchemaRecord(cached) &&
    cached.ownerId === auth.userId &&
    !isPendingCreate(cached)
  );
}

function isVersionUnsupported(errors: readonly StructuralError[]): boolean {
  return errors.some((error) => error.code === "version-unsupported");
}

// A structural error other than version-unsupported should not happen (the
// backend validates before storing), so it is treated the same as an
// unreachable cloud rather than given its own user-facing message.
function decideForUnparseableCloudDocument(
  errors: readonly StructuralError[],
  hasCache: boolean,
): OpenAction {
  if (isVersionUnsupported(errors)) {
    return { kind: "cloud-version-unsupported" };
  }
  return hasCache
    ? { kind: "open-cached", followUp: "retry-when-online" }
    : { kind: "needs-network" };
}

function decideForMissingCache(
  auth: OpenAuthContext,
  cloud: CloudFetchResult | null,
): OpenAction {
  if (cloud === null) {
    return { kind: "not-found", shouldOfferSignIn: true };
  }
  switch (cloud.kind) {
    case "not-found":
      return { kind: "not-found", shouldOfferSignIn: false };
    case "unavailable":
      return { kind: "needs-network" };
    case "found": {
      const parsed = parseSchemaDocument(cloud.detail.document);
      return parsed.isOk
        ? {
            kind: "store-cloud-and-open",
            document: parsed.value,
            revision: cloud.detail.revision,
          }
        : decideForUnparseableCloudDocument(parsed.error, false);
    }
    default: {
      const unhandled: never = cloud;
      return unhandled;
    }
  }
}

function decideForFoundCloudWithCache(
  record: CloudSchemaRecord,
  detail: SchemaDetail,
): OpenAction {
  const parsed = parseSchemaDocument(detail.document);
  if (!parsed.isOk) {
    return decideForUnparseableCloudDocument(parsed.error, true);
  }
  const isSameRevision = detail.revision === record.cloudRevision;
  switch (record.syncStatus) {
    case "synced":
      return isSameRevision
        ? { kind: "open-cached", followUp: "none" }
        : {
            kind: "store-cloud-and-open",
            document: parsed.value,
            revision: detail.revision,
          };
    case "pending":
      return isSameRevision
        ? { kind: "open-cached", followUp: "push-update" }
        : { kind: "open-cached-with-conflict", cloud: detail };
    // A conflict is only cleared by the conflict dialog's own two choices, and
    // a schema recreated after being deleted in the cloud is treated the same
    // way, so both reuse the conflict dialog regardless of the revision.
    case "conflict":
    case "deleted-in-cloud":
      return { kind: "open-cached-with-conflict", cloud: detail };
    default: {
      const unhandled: never = record.syncStatus;
      return unhandled;
    }
  }
}

function decideForOwnedCache(
  record: CloudSchemaRecord,
  auth: OpenAuthContext,
  cloud: CloudFetchResult | null,
): OpenAction {
  if (auth.status === "expired") {
    return { kind: "open-cached", followUp: "wait-for-sign-in" };
  }
  if (isPendingCreate(record)) {
    return { kind: "open-cached", followUp: "push-create" };
  }
  if (cloud === null || cloud.kind === "unavailable") {
    return { kind: "open-cached", followUp: "retry-when-online" };
  }
  if (cloud.kind === "not-found") {
    return record.syncStatus === "synced"
      ? { kind: "delete-cache-deleted-elsewhere" }
      : { kind: "open-cached-deleted-in-cloud" };
  }
  return decideForFoundCloudWithCache(record, cloud.detail);
}

export function decideOpenAction(input: {
  readonly auth: OpenAuthContext;
  readonly cached: SchemaRecord | null;
  readonly cloud: CloudFetchResult | null;
}): OpenAction {
  const { auth, cached, cloud } = input;
  if (cached === null) {
    return decideForMissingCache(auth, cloud);
  }
  if (!isCloudSchemaRecord(cached)) {
    return { kind: "open-cached", followUp: "none" };
  }
  if (!ownsRecord(cached, auth)) {
    return {
      kind: "not-found",
      shouldOfferSignIn: auth.status === "signed-out",
    };
  }
  return decideForOwnedCache(cached, auth, cloud);
}
