"use client";

import type { SchemaDocument } from "@schemaforge/core";
import { useEffect, useState } from "react";

import type { ViewportRecord } from "@/lib/storage/records";
import type {
  OpenSchemaResult,
  SchemaRepository,
} from "@/lib/storage/schema-repository";
import { toStorageErrorCode } from "@/lib/storage/storage-error";
import type { StorageErrorCode } from "@/lib/storage/storage-error";

export type OpenSchemaState =
  | { readonly kind: "opening" }
  | { readonly kind: "not-found" }
  | { readonly kind: "unreadable"; readonly isVersionUnsupported: boolean }
  | { readonly kind: "storage-error"; readonly errorCode: StorageErrorCode }
  | {
      readonly kind: "opened";
      readonly document: SchemaDocument;
      readonly viewport: ViewportRecord | null;
    };

export type UseOpenSchemaInput = {
  readonly repository: SchemaRepository;
  readonly schemaId: string;
  readonly grantId: number | null;
};

// The state remembers which read it answers, so a new grant, schema id or
// repository reads as opening until its own read settles.
type KeyedOpenState = UseOpenSchemaInput & {
  readonly openState: OpenSchemaState;
};

const OPENING: OpenSchemaState = { kind: "opening" };

function toOpenState(
  result: OpenSchemaResult,
  viewport: ViewportRecord | null,
): OpenSchemaState {
  switch (result.kind) {
    case "opened":
      return { kind: "opened", document: result.document, viewport };
    case "not-found":
      return { kind: "not-found" };
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

async function readSchema(
  repository: SchemaRepository,
  schemaId: string,
): Promise<OpenSchemaState> {
  try {
    const [result, viewport] = await Promise.all([
      repository.openSchema(schemaId),
      repository.readViewport(schemaId),
    ]);
    return toOpenState(result, viewport);
  } catch (error: unknown) {
    return { kind: "storage-error", errorCode: toStorageErrorCode(error) };
  }
}

/**
 * Reads and parses one schema once this tab holds its lock (`grantId` is not
 * null). A new grant, after waiting for another tab, reads the document
 * again, because that tab may have changed it. Only reads: a document that
 * cannot be parsed is never written back.
 */
export function useOpenSchema({
  repository,
  schemaId,
  grantId,
}: UseOpenSchemaInput): OpenSchemaState {
  const [keyedState, setKeyedState] = useState<KeyedOpenState | null>(null);

  useEffect(() => {
    if (grantId === null) {
      return;
    }
    let isActive = true;
    // Fire and forget: readSchema never rejects, it maps every error.
    void readSchema(repository, schemaId).then((openState) => {
      if (isActive) {
        setKeyedState({ repository, schemaId, grantId, openState });
      }
    });
    return () => {
      isActive = false;
    };
  }, [repository, schemaId, grantId]);

  const isCurrent =
    grantId !== null &&
    keyedState !== null &&
    keyedState.repository === repository &&
    keyedState.schemaId === schemaId &&
    keyedState.grantId === grantId;
  return isCurrent ? keyedState.openState : OPENING;
}
