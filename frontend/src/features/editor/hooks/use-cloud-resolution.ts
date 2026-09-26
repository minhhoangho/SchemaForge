"use client";

import { parseSchemaDocument } from "@schemaforge/core";
import type { SchemaDocument } from "@schemaforge/core";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";

import type { ApiClient } from "@/lib/api/api-client";
import type { ApiFailure } from "@/lib/api/api-failure";
import { logger } from "@/lib/logger";
import { isCloudSchemaRecord } from "@/lib/storage/records";
import type { SchemaRepository } from "@/lib/storage/schema-repository";
import {
  getStorageErrorName,
  toStorageErrorCode,
} from "@/lib/storage/storage-error";
import { useNotify } from "@/lib/use-notify";

import { summarizeSchemaVersion } from "../lib/summarize-schema-version";
import type { SchemaVersionSummary } from "../lib/summarize-schema-version";
import type { CloudPusherControls } from "./use-cloud-pusher";

export type CloudVersionState =
  | { readonly kind: "loading" }
  | {
      readonly kind: "loaded";
      readonly revision: number;
      readonly document: SchemaDocument;
      readonly summary: SchemaVersionSummary;
    }
  | { readonly kind: "version-unsupported" }
  | { readonly kind: "failed"; readonly failure: ApiFailure };

export type CloudResolution = {
  readonly cloudVersion: CloudVersionState;
  readonly isBusy: boolean;
  readonly reloadCloudVersion: () => void;
  readonly keepLocal: () => Promise<void>;
  readonly adoptCloudVersion: () => Promise<void>;
  readonly recreateInCloud: () => Promise<void>;
  readonly removeFromBrowser: () => Promise<void>;
};

export type UseCloudResolutionInput = {
  readonly schemaId: string;
  readonly isConflictOpen: boolean;
  readonly repository: SchemaRepository;
  readonly apiClient: ApiClient;
  readonly pusher: CloudPusherControls;
  readonly onReplaceDocument: (document: SchemaDocument) => void;
  readonly navigate: (href: string) => void;
};

type LoadInput = Pick<
  UseCloudResolutionInput,
  "schemaId" | "repository" | "apiClient"
>;

// The cloud's creation time is only needed to cache the copy, so it travels
// next to the version instead of in it.
type CloudAnswer = {
  readonly version: CloudVersionState;
  readonly createdAt: number;
};

// Remembers which request it answers, so a reopened or reloaded dialog reads
// as loading until its own request settles.
type KeyedCloudAnswer = CloudAnswer & { readonly request: number };

type LoadedCloud = {
  readonly revision: number;
  readonly document: SchemaDocument;
  readonly createdAt: number;
  readonly updatedAt: number;
};

const LOADING: CloudVersionState = { kind: "loading" };
const NOT_FOUND_STATUS = 404;
const LIST_HREF = "/";
const UNKNOWN_CREATED_AT = 0;

// The cloud copy is gone. The cache keeps the revision it had, and the
// deleted-in-cloud dialog takes over from the conflict dialog.
async function markDeletedInCloud(
  { schemaId, repository }: LoadInput,
  failure: ApiFailure,
): Promise<CloudVersionState> {
  try {
    const record = await repository.readSchemaRecord(schemaId);
    await repository.setSyncState(schemaId, {
      cloudRevision: record?.cloudRevision ?? null,
      syncStatus: "deleted-in-cloud",
    });
    return LOADING;
  } catch (error: unknown) {
    logger.error("editor.cloud-deleted-mark-failed", {
      errorName: getStorageErrorName(error),
    });
    return { kind: "failed", failure };
  }
}

// Nothing is written to the cache for a document this release cannot read
// (spec section 7, "Mở schema").
async function fetchCloudVersion(
  input: LoadInput,
  signal: AbortSignal,
): Promise<CloudAnswer> {
  const response = await input.apiClient.schemas.get(input.schemaId, {
    signal,
  });
  if (!response.isOk) {
    const failure = response.error;
    const version =
      failure.kind === "http" && failure.status === NOT_FOUND_STATUS
        ? await markDeletedInCloud(input, failure)
        : { kind: "failed" as const, failure };
    return { version, createdAt: UNKNOWN_CREATED_AT };
  }
  const detail = response.value;
  const createdAt = Date.parse(detail.createdAt);
  const parsed = parseSchemaDocument(detail.document);
  if (!parsed.isOk) {
    const isUnsupported = parsed.error.some(
      (error) => error.code === "version-unsupported",
    );
    const version: CloudVersionState = isUnsupported
      ? { kind: "version-unsupported" }
      : { kind: "failed", failure: { kind: "invalid-response" } };
    return { version, createdAt };
  }
  const summary = summarizeSchemaVersion(
    parsed.value,
    Date.parse(detail.updatedAt),
  );
  return {
    version: {
      kind: "loaded",
      revision: detail.revision,
      document: parsed.value,
      summary,
    },
    createdAt,
  };
}

function useCloudAnswer(
  input: LoadInput & { readonly isConflictOpen: boolean },
): { readonly answer: CloudAnswer | null; readonly reload: () => void } {
  const { schemaId, repository, apiClient, isConflictOpen } = input;
  const [request, setRequest] = useState(0);
  const [isSeenOpen, setIsSeenOpen] = useState(false);
  const [answer, setAnswer] = useState<KeyedCloudAnswer | null>(null);
  // Each opening asks the cloud again (state adjusted while rendering).
  if (isConflictOpen !== isSeenOpen) {
    setIsSeenOpen(isConflictOpen);
    if (isConflictOpen) {
      setRequest((current) => current + 1);
    }
  }

  useEffect(() => {
    if (!isConflictOpen || request === 0) {
      return;
    }
    const controller = new AbortController();
    fetchCloudVersion({ schemaId, repository, apiClient }, controller.signal)
      .then((loaded) => {
        if (!controller.signal.aborted) {
          setAnswer({ ...loaded, request });
        }
      })
      .catch((error: unknown) => {
        // An aborted request rejects; only a live one is worth reporting.
        if (!controller.signal.aborted) {
          logger.error("editor.cloud-version-load-failed", {
            errorName: getStorageErrorName(error),
          });
        }
      });
    return () => {
      controller.abort();
    };
  }, [isConflictOpen, request, schemaId, repository, apiClient]);

  return {
    answer: answer?.request === request ? answer : null,
    reload: () => {
      setRequest((current) => current + 1);
    },
  };
}

function toLoadedCloud(answer: CloudAnswer | null): LoadedCloud | null {
  if (answer?.version.kind !== "loaded") {
    return null;
  }
  const { revision, document, summary } = answer.version;
  return {
    revision,
    document,
    createdAt: answer.createdAt,
    updatedAt: summary.updatedAt,
  };
}

// Written while the editor still holds the schema lock; the record keeps its
// owner and becomes synced.
async function writeCloudCopy(
  { schemaId, repository }: LoadInput,
  cloud: LoadedCloud,
): Promise<void> {
  const record = await repository.readSchemaRecord(schemaId);
  if (record === null || !isCloudSchemaRecord(record)) {
    throw new Error("Only an owned schema can take the cloud version.");
  }
  await repository.writeCloudCopy({
    id: schemaId,
    ownerId: record.ownerId,
    ...cloud,
  });
}

/**
 * The choices of the conflict and deleted-in-cloud dialogs (spec section 7,
 * "Xung đột"). The pusher stopped at the conflict and resumes after each
 * choice has been written to the cache.
 */
export function useCloudResolution(
  input: UseCloudResolutionInput,
): CloudResolution {
  const { schemaId, repository, pusher, onReplaceDocument, navigate } = input;
  const notify = useNotify();
  const [isBusy, setIsBusy] = useState(false);
  const { answer, reload } = useCloudAnswer(input);
  const loaded = toLoadedCloud(answer);

  async function run(action: () => Promise<void>): Promise<void> {
    setIsBusy(true);
    try {
      await action();
    } catch (error: unknown) {
      logger.error("editor.cloud-resolution-failed", {
        errorName: getStorageErrorName(error),
      });
      notify({
        tone: "error",
        titleKey: `storage:${toStorageErrorCode(error)}`,
      });
    } finally {
      setIsBusy(false);
    }
  }

  function runWithCloud(
    action: (cloud: LoadedCloud) => Promise<void>,
  ): Promise<void> {
    return loaded === null ? Promise.resolve() : run(() => action(loaded));
  }

  async function resumeWith(cloudRevision: number | null): Promise<void> {
    await repository.setSyncState(schemaId, {
      cloudRevision,
      syncStatus: "pending",
    });
    pusher.resume();
  }

  return {
    cloudVersion: answer?.version ?? LOADING,
    isBusy,
    reloadCloudVersion: reload,
    // The latest local document goes out against the revision just seen.
    keepLocal: () => runWithCloud((cloud) => resumeWith(cloud.revision)),
    adoptCloudVersion: () =>
      runWithCloud(async (cloud) => {
        await writeCloudCopy(input, cloud);
        pusher.resume();
        onReplaceDocument(cloud.document);
        notify({
          tone: "success",
          titleKey: "sync:conflictDialog.switchedToCloud",
        });
      }),
    // A null revision makes the next push a create with the same id.
    recreateInCloud: () => run(() => resumeWith(null)),
    removeFromBrowser: () =>
      run(async () => {
        await repository.deleteSchema(schemaId);
        navigate(LIST_HREF);
      }),
  };
}

async function readLocalVersion(
  repository: SchemaRepository,
  schemaId: string,
): Promise<SchemaVersionSummary | null> {
  try {
    const [record, opened] = await Promise.all([
      repository.readSchemaRecord(schemaId),
      repository.openSchema(schemaId),
    ]);
    return record !== null && opened.kind === "opened"
      ? summarizeSchemaVersion(opened.document, record.updatedAt)
      : null;
  } catch (error: unknown) {
    // useLiveQuery rethrows a rejected query during render.
    logger.error("editor.local-version-read-failed", {
      errorName: getStorageErrorName(error),
    });
    return null;
  }
}

/**
 * The cached version the conflict dialog compares against, read only while
 * the dialog is open so saves elsewhere do not parse the document again.
 */
export function useLocalVersionSummary(input: {
  readonly repository: SchemaRepository;
  readonly schemaId: string;
  readonly isConflictOpen: boolean;
}): SchemaVersionSummary | null {
  const { repository, schemaId, isConflictOpen } = input;
  return (
    useLiveQuery(
      () =>
        isConflictOpen
          ? readLocalVersion(repository, schemaId)
          : Promise.resolve(null),
      [repository, schemaId, isConflictOpen],
    ) ?? null
  );
}
