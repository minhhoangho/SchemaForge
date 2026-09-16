"use client";

import type { SchemaDocument } from "@schemaforge/core";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";
import type { SchemaRepository } from "@/lib/storage/schema-repository";
import {
  getStorageErrorName,
  toStorageErrorCode,
} from "@/lib/storage/storage-error";
import { useNotify } from "@/lib/use-notify";

import type { EditorStore } from "../state/create-editor-store";

export type AutosaveControls = { readonly retry: () => void };

export type UseAutosaveInput = {
  readonly store: EditorStore;
  readonly repository: SchemaRepository;
};

type Autosaver = {
  readonly requestSave: (document: SchemaDocument) => void;
  readonly retry: () => void;
  readonly dispose: () => void;
};

type AutosaverPorts = UseAutosaveInput & {
  readonly notify: Notify;
  readonly onRetry: () => void;
};

// One write at a time: a change that arrives while a write is in flight only
// replaces the pending document, and the newest one is written right after.
function createAutosaver({
  store,
  repository,
  notify,
  onRetry,
}: AutosaverPorts): Autosaver {
  const queue: {
    isSaving: boolean;
    isDisposed: boolean;
    pendingDocument: SchemaDocument | null;
  } = { isSaving: false, isDisposed: false, pendingDocument: null };

  function takePendingDocument(): SchemaDocument | null {
    const { pendingDocument } = queue;
    queue.pendingDocument = null;
    return pendingDocument;
  }

  function reportFailure(error: unknown): void {
    const code = toStorageErrorCode(error);
    store.getState().setSaveStatus({ kind: "failed", errorCode: code });
    logger.error("editor.save-failed", {
      code,
      errorName: getStorageErrorName(error),
    });
    notify({
      tone: "error",
      titleKey: `storage:${code}`,
      action: { labelKey: "common:actions.retry", onSelect: onRetry },
    });
  }

  async function save(document: SchemaDocument): Promise<void> {
    queue.isSaving = true;
    store.getState().setSaveStatus({ kind: "saving" });
    const { schemaId } = store.getState();
    let nextDocument: SchemaDocument | null = document;
    try {
      while (nextDocument !== null) {
        // Each write waits for the previous one: one write at a time.
        await repository.saveDocument(schemaId, nextDocument);
        if (queue.isDisposed) {
          return;
        }
        nextDocument = takePendingDocument();
      }
      // Same tick as the last take, so a change arriving now starts a new save
      // instead of landing in a pending slot nobody reads.
      queue.isSaving = false;
      store.getState().setSaveStatus({ kind: "saved" });
    } catch (error: unknown) {
      queue.isSaving = false;
      queue.pendingDocument = null;
      // The document and history in memory stay as they are, so editing goes
      // on and the next change or a retry writes again.
      if (!queue.isDisposed) {
        reportFailure(error);
      }
    }
  }

  function requestSave(document: SchemaDocument): void {
    if (queue.isSaving) {
      queue.pendingDocument = document;
      return;
    }
    // Fire and forget: save reports its own outcome through the save status.
    void save(document);
  }

  return {
    requestSave,
    retry: () => {
      requestSave(store.getState().document);
    },
    // After unmount the schema lock is released, so another tab or the list
    // screen may write this schema; nothing more may be written from here.
    dispose: () => {
      queue.isDisposed = true;
      queue.pendingDocument = null;
    },
  };
}

/**
 * Writes the document to IndexedDB right after every change of its
 * reference (dispatch, undo, redo), with no timer and no debounce. Nothing is
 * written after unmount, and `retry` then does nothing.
 */
export function useAutosave({
  store,
  repository,
}: UseAutosaveInput): AutosaveControls {
  const notify = useNotify();
  // Read through a ref so a new notify (after a language change) does not
  // start a second queue next to a running write.
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  const autosaverRef = useRef<Autosaver | null>(null);

  const retry = useCallback(() => {
    autosaverRef.current?.retry();
  }, []);

  useEffect(() => {
    const autosaver = createAutosaver({
      store,
      repository,
      notify: (input) => {
        notifyRef.current(input);
      },
      onRetry: retry,
    });
    autosaverRef.current = autosaver;
    const unsubscribe = store.subscribe((state, previousState) => {
      if (state.document !== previousState.document) {
        autosaver.requestSave(state.document);
      }
    });
    return () => {
      unsubscribe();
      autosaver.dispose();
      if (autosaverRef.current === autosaver) {
        autosaverRef.current = null;
      }
    };
  }, [store, repository, retry]);

  return useMemo(() => ({ retry }), [retry]);
}
