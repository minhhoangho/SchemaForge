"use client";

import type { SchemaDocument } from "@schemaforge/core";
import type { Viewport } from "@xyflow/react";
import type { JSX } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { logger } from "@/lib/logger";
import type { ViewportRecord } from "@/lib/storage/records";
import type { SchemaRepository } from "@/lib/storage/schema-repository";
import { getStorageErrorName } from "@/lib/storage/storage-error";
import { useNotify } from "@/lib/use-notify";

import { useAutosave } from "../hooks/use-autosave";
import { useSchemaCommands } from "../hooks/use-schema-commands";
import { createEditorStore } from "../state/create-editor-store";
import { EditorStoreProvider } from "../state/editor-store-provider";
import { EditorCanvas } from "./canvas/editor-canvas";
import { EditorFlowProvider } from "./canvas/editor-flow-provider";
import { EditorToolbar } from "./toolbar/editor-toolbar";

export type EditorWorkspaceProps = {
  readonly schemaId: string;
  readonly document: SchemaDocument;
  readonly viewport: ViewportRecord | null;
  readonly repository: SchemaRepository;
};

function generateId(): string {
  return crypto.randomUUID();
}

// Relations are created through the dialog of plan Task 28; until then a
// connection dragged on the canvas changes nothing.
function ignoreConnection(): void {
  // Intentionally empty.
}

/**
 * Writes the viewport after each pan or zoom. A lost viewport is not worth
 * interrupting the user, so a failure is only logged. Nothing is written after
 * unmount, because the schema lock is released then (as in useAutosave).
 */
function useSaveViewport(
  repository: SchemaRepository,
  schemaId: string,
): (viewport: Viewport) => void {
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return useCallback(
    ({ x, y, zoom }: Viewport) => {
      if (!isMountedRef.current) {
        return;
      }
      // Fire and forget: the catch handles every failure.
      void repository
        .saveViewport({ schemaId, x, y, zoom })
        .catch((error: unknown) => {
          logger.warn("editor.viewport-save-failed", {
            errorName: getStorageErrorName(error),
          });
        });
    },
    [repository, schemaId],
  );
}

type WorkspaceLayoutProps = {
  readonly viewport: ViewportRecord | null;
  readonly onMoveEnd: (viewport: Viewport) => void;
  readonly onRetrySave: () => void;
};

// Rendered inside both providers, which useSchemaCommands needs.
function WorkspaceLayout({
  viewport,
  onMoveEnd,
  onRetrySave,
}: WorkspaceLayoutProps): JSX.Element {
  const { addTable } = useSchemaCommands();
  const defaultViewport =
    viewport === null
      ? null
      : { x: viewport.x, y: viewport.y, zoom: viewport.zoom };

  return (
    <div className="flex h-dvh flex-col">
      <EditorToolbar onRetrySave={onRetrySave} />
      <div className="min-h-0 flex-1">
        <EditorCanvas
          defaultViewport={defaultViewport}
          onMoveEnd={onMoveEnd}
          onAddTable={addTable}
          onConnect={ignoreConnection}
        />
      </div>
    </div>
  );
}

/**
 * The editor of one opened schema. Its store is created once, from the
 * document read when the schema opened; another schema mounts a new
 * workspace (the screen keys it by schema id).
 */
export function EditorWorkspace({
  schemaId,
  document,
  viewport,
  repository,
}: EditorWorkspaceProps): JSX.Element {
  const notify = useNotify();
  const [store] = useState(() =>
    createEditorStore({ schemaId, document, generateId, notify, logger }),
  );
  const autosave = useAutosave({ store, repository });
  const saveViewport = useSaveViewport(repository, schemaId);

  return (
    <EditorStoreProvider store={store}>
      <EditorFlowProvider>
        <WorkspaceLayout
          viewport={viewport}
          onMoveEnd={saveViewport}
          onRetrySave={autosave.retry}
        />
      </EditorFlowProvider>
    </EditorStoreProvider>
  );
}
