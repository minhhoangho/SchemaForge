"use client";

import type { JSX } from "react";
import { useEffect, useState } from "react";

import { useApiClient, useAuth } from "@/components/auth-provider";
import type { AuthState } from "@/lib/auth/auth-store";
import { buildAuthHref } from "@/lib/auth/sanitize-return-to";
import type { StorageBundle } from "@/lib/storage/create-browser-storage";
import { useStorage } from "@/lib/storage/storage-context";
import type { OpenAuthContext } from "@/lib/sync/decide-open-action";

import { useLeaveOnSignOut } from "../hooks/use-leave-on-sign-out";
import { useOpenSchema } from "../hooks/use-open-schema";
import { useSchemaLock } from "../hooks/use-schema-lock";
import { EditorSkeleton } from "./editor-skeleton";
import { EditorStatusScreen } from "./editor-status-screen";
import { EditorWorkspace } from "./editor-workspace";

export type EditorScreenProps = {
  readonly schemaId: string;
  /** Tells the loader whether the schema is still opening, for its status. */
  readonly onOpeningChange: (isOpening: boolean) => void;
};

type LockedEditorProps = EditorScreenProps & {
  readonly storage: StorageBundle;
};

const SIGNED_OUT: OpenAuthContext = { status: "signed-out" };

// Unknown auth has no open decision yet; the caller waits instead.
function toOpenAuthContext(auth: AuthState): OpenAuthContext | null {
  switch (auth.status) {
    case "unknown":
      return null;
    case "signed-out":
      return SIGNED_OUT;
    case "signed-in":
      return { status: "signed-in", userId: auth.user.id };
    case "expired":
      return { status: "expired", lastUserId: auth.lastUser?.id ?? null };
    default: {
      const unhandled: never = auth;
      return unhandled;
    }
  }
}

// Holds the tab lock first, then reads the schema; nothing is read while
// another tab may still be writing it (spec section 7).
function LockedEditor({
  schemaId,
  storage,
  onOpeningChange,
}: LockedEditorProps): JSX.Element {
  const { repository, lockManager } = storage;
  const api = useApiClient();
  const openAuth = toOpenAuthContext(useAuth((state) => state.auth));
  const [attempt, setAttempt] = useState(0);
  const lockState = useSchemaLock({ schemaId, lockManager });
  const grantId = lockState.kind === "held" ? lockState.grantId : null;
  const openState = useOpenSchema({
    repository,
    api,
    auth: openAuth ?? SIGNED_OUT,
    schemaId,
    // No read starts before auth is known.
    grantId: openAuth === null ? null : grantId,
    attempt,
  });
  const cloud = openState.kind === "opened" ? openState.cloud : null;
  useLeaveOnSignOut({ cloud });
  const isOpening =
    lockState.kind !== "blocked" && openState.kind === "opening";

  useEffect(() => {
    onOpeningChange(isOpening);
  }, [isOpening, onOpeningChange]);

  if (lockState.kind === "blocked") {
    return <EditorStatusScreen variant="locked" />;
  }

  switch (openState.kind) {
    case "opening":
      return <EditorSkeleton />;
    case "not-found":
      return (
        <EditorStatusScreen
          variant="not-found"
          signInHref={
            openState.shouldOfferSignIn
              ? buildAuthHref("/sign-in", `/schemas/${schemaId}`)
              : undefined
          }
        />
      );
    case "needs-network":
      return (
        <EditorStatusScreen
          variant="needs-network"
          onRetry={() => {
            setAttempt((current) => current + 1);
          }}
        />
      );
    case "deleted-elsewhere":
      return <EditorStatusScreen variant="deleted-elsewhere" />;
    case "unreadable":
      return (
        <EditorStatusScreen
          variant={
            openState.isVersionUnsupported
              ? "unsupported-version"
              : "unreadable"
          }
        />
      );
    case "storage-error":
      return (
        <EditorStatusScreen
          variant="storage-unavailable"
          storageErrorCode={openState.errorCode}
        />
      );
    case "opened":
      return (
        <EditorWorkspace
          key={schemaId}
          schemaId={schemaId}
          document={openState.document}
          viewport={openState.viewport}
          repository={repository}
          ownerId={
            openState.cloud.kind === "owned" ? openState.cloud.userId : null
          }
          apiClient={api}
        />
      );
    default: {
      const unhandledState: never = openState;
      return unhandledState;
    }
  }
}

/**
 * Opens one schema by id and shows the state of each step (spec section 1):
 * browser storage, the tab lock, then reading and parsing the document.
 */
export function EditorScreen({
  schemaId,
  onOpeningChange,
}: EditorScreenProps): JSX.Element {
  const storageState = useStorage();
  const storageKind = storageState.kind;

  // Once storage is ready, LockedEditor reports instead. Child effects run
  // first, so reporting here as well would overwrite its answer.
  useEffect(() => {
    if (storageKind !== "ready") {
      onOpeningChange(storageKind === "pending");
    }
  }, [storageKind, onOpeningChange]);

  switch (storageState.kind) {
    case "pending":
      return <EditorSkeleton />;
    case "unavailable":
      return (
        <EditorStatusScreen
          variant="storage-unavailable"
          storageErrorCode={storageState.errorCode}
        />
      );
    case "ready":
      return (
        <LockedEditor
          schemaId={schemaId}
          storage={storageState.storage}
          onOpeningChange={onOpeningChange}
        />
      );
    default: {
      const unhandledState: never = storageState;
      return unhandledState;
    }
  }
}
