"use client";

import type { JSX } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useApiClient, useAuth } from "@/components/auth-provider";
import { UploadSchemasDialog } from "@/components/upload-schemas-dialog";
import type { UploadCandidate } from "@/components/upload-schemas-dialog";
import { logger } from "@/lib/logger";
import type { SchemaListEntry } from "@/lib/storage/schema-repository";
import { useStorage } from "@/lib/storage/storage-context";
import { uploadLocalSchemas } from "@/lib/sync/upload-local-schemas";
import type { UploadReport } from "@/lib/sync/upload-local-schemas";
import type { Notify } from "@/lib/notify";
import { useNotify } from "@/lib/use-notify";

function toGuestCandidates(
  entries: readonly SchemaListEntry[],
): readonly UploadCandidate[] {
  return entries.flatMap((entry) =>
    entry.kind === "readable" && entry.schema.ownerId === null
      ? [{ id: entry.schema.id, name: entry.schema.name }]
      : [],
  );
}

function errorName(cause: unknown): string {
  return cause instanceof Error ? cause.name : "unknown";
}

// Every selected id lands in exactly one of uploadedIds, skipped or
// notAttemptedIds, so the two toasts together cover the whole selection.
function notifyReport(notify: Notify, report: UploadReport): void {
  const uploadedCount = report.uploadedIds.length;
  const notUploadedCount =
    report.skipped.length + report.notAttemptedIds.length;
  if (uploadedCount > 0) {
    notify({
      tone: "success",
      titleKey: "sync:uploadDialog.uploaded",
      values: { count: uploadedCount },
    });
  }
  if (notUploadedCount > 0) {
    notify({
      tone: "error",
      titleKey: "sync:uploadDialog.notUploaded",
      values: { count: notUploadedCount },
    });
  }
}

type GuestCandidates = {
  readonly candidates: readonly UploadCandidate[] | null;
  readonly close: () => void;
};

type GuestUpload = {
  readonly isUploading: boolean;
  readonly upload: (schemaIds: readonly string[]) => void;
};

function useGuestUploadCandidates(userId: string | null): GuestCandidates {
  const activeSignInCount = useAuth((state) => state.activeSignInCount);
  const storage = useStorage();
  const [candidates, setCandidates] = useState<
    readonly UploadCandidate[] | null
  >(null);
  const [lastUserId, setLastUserId] = useState(userId);
  // The count at mount is not a new sign-in, so only a later increase opens
  // the dialog.
  const seenSignInCountRef = useRef(activeSignInCount);

  // Any change of user drops what was listed before it: leaving signed-in
  // closes the dialog, and a listing that finished after the session ended
  // must not open on a later sign-in that followed another tab.
  if (lastUserId !== userId) {
    setLastUserId(userId);
    setCandidates(null);
  }

  useEffect(() => {
    const hasNewSignIn = activeSignInCount > seenSignInCountRef.current;
    seenSignInCountRef.current = activeSignInCount;
    if (!hasNewSignIn || storage.kind !== "ready") {
      return;
    }
    let isCurrent = true;
    storage.storage.repository.listSchemas().then(
      (entries) => {
        const guests = toGuestCandidates(entries);
        if (isCurrent && guests.length > 0) {
          setCandidates(guests);
        }
      },
      (cause: unknown) => {
        logger.error("sync.upload-prompt-list-failed", {
          name: errorName(cause),
        });
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [activeSignInCount, storage]);

  const close = useCallback(() => {
    setCandidates(null);
  }, []);

  return { candidates, close };
}

async function uploadAndNotify(
  input: Omit<Parameters<typeof uploadLocalSchemas>[0], "generateId">,
  notify: Notify,
): Promise<void> {
  try {
    const report = await uploadLocalSchemas({
      ...input,
      generateId: () => crypto.randomUUID(),
    });
    notifyReport(notify, report);
  } catch (cause) {
    logger.error("sync.upload-failed", { name: errorName(cause) });
  }
}

function useGuestUpload(
  userId: string | null,
  onFinished: () => void,
): GuestUpload {
  const storage = useStorage();
  const api = useApiClient();
  const notify = useNotify();
  const [isUploading, setIsUploading] = useState(false);

  function upload(schemaIds: readonly string[]): void {
    if (userId === null || storage.kind !== "ready") {
      return;
    }
    const { repository, lockManager } = storage.storage;
    setIsUploading(true);
    // Fire-and-forget: the dialog shows progress, and uploadAndNotify never
    // rejects.
    void uploadAndNotify(
      { api, repository, lockManager, userId, schemaIds },
      notify,
    ).finally(() => {
      setIsUploading(false);
      onFinished();
    });
  }

  return { isUploading, upload };
}

export function UploadPromptHost(): JSX.Element | null {
  const userId = useAuth((state) =>
    state.auth.status === "signed-in" ? state.auth.user.id : null,
  );
  const { candidates, close } = useGuestUploadCandidates(userId);
  const { isUploading, upload } = useGuestUpload(userId, close);

  if (candidates === null || userId === null) {
    return null;
  }

  return (
    <UploadSchemasDialog
      isOpen
      candidates={candidates}
      isUploading={isUploading}
      onUpload={upload}
      onLater={close}
    />
  );
}
