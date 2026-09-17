"use client";

import type { SchemaDocument, TableId } from "@schemaforge/core";
import type { Connection, Viewport } from "@xyflow/react";
import type { JSX } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/class-names";
import { logger } from "@/lib/logger";
import type { ViewportRecord } from "@/lib/storage/records";
import type { SchemaRepository } from "@/lib/storage/schema-repository";
import { getStorageErrorName } from "@/lib/storage/storage-error";
import { useNotify } from "@/lib/use-notify";

import { useAutosave } from "../hooks/use-autosave";
import { useSchemaCommands } from "../hooks/use-schema-commands";
import { useWorkspaceKeyboard } from "../hooks/use-workspace-keyboard";
import {
  createRelationDraftFromConnection,
  createRelationDraftFromTable,
} from "../lib/to-relation-draft";
import type { RelationDraft } from "../lib/to-relation-draft";
import { createEditorStore } from "../state/create-editor-store";
import { EditorStoreProvider } from "../state/editor-store-provider";
import { useEditorStoreApi } from "../state/use-editor-store";
import { EditorCanvas } from "./canvas/editor-canvas";
import { EditorFlowProvider } from "./canvas/editor-flow-provider";
import { CreateRelationDialog } from "./dialogs/create-relation-dialog";
import { LeftPanel } from "./panels/left-panel";
import { PropertiesPanel } from "./panels/properties-panel";
import { SkipToPanelLink } from "./skip-to-panel-link";
import { EditorToolbar } from "./toolbar/editor-toolbar";

export type EditorWorkspaceProps = {
  readonly schemaId: string;
  readonly document: SchemaDocument;
  readonly viewport: ViewportRecord | null;
  readonly repository: SchemaRepository;
};

// Regions that take focus from the skip link or after a delete show a ring
// for keyboard users (WCAG 2.4.7). Their children paint opaque backgrounds
// over an inset box-shadow, so the ring is an overlay above them that lets
// pointer events through to the canvas.
const FOCUS_TARGET_CLASS_NAME =
  "relative outline-none focus-visible:after:pointer-events-none focus-visible:after:absolute focus-visible:after:inset-0 focus-visible:after:z-10 focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset";

function generateId(): string {
  return crypto.randomUUID();
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

type RelationDialogState = {
  readonly draft: RelationDraft | null;
  readonly closeDialog: () => void;
  readonly openFromConnection: (connection: Connection) => void;
  readonly openFromTable: (tableId: TableId) => void;
};

// The draft behind the create relation dialog; `null` keeps it closed. A
// connection or table the document cannot prefill a draft from opens nothing.
function useRelationDialog(): RelationDialogState {
  const store = useEditorStoreApi();
  const [draft, setDraft] = useState<RelationDraft | null>(null);

  const closeDialog = useCallback(() => {
    setDraft(null);
  }, []);
  const openFromConnection = useCallback(
    (connection: Connection) => {
      setDraft(
        createRelationDraftFromConnection(
          store.getState().document,
          connection,
        ),
      );
    },
    [store],
  );
  const openFromTable = useCallback(
    (tableId: TableId) => {
      setDraft(
        createRelationDraftFromTable(store.getState().document, tableId),
      );
    },
    [store],
  );

  return { draft, closeDialog, openFromConnection, openFromTable };
}

type WorkspaceLayoutProps = {
  readonly viewport: ViewportRecord | null;
  readonly onMoveEnd: (viewport: Viewport) => void;
  readonly onRetrySave: () => void;
};

/**
 * The landmarks of spec section 12, in the tab order toolbar, left panel,
 * canvas, properties panel, which comes from the DOM order alone. Rendered
 * inside both providers: the toolbar, the left panel and the dialog use the
 * viewport controls.
 */
function WorkspaceLayout({
  viewport,
  onMoveEnd,
  onRetrySave,
}: WorkspaceLayoutProps): JSX.Element {
  const { t } = useTranslation("editor");
  const { addTable } = useSchemaCommands();
  const dialog = useRelationDialog();
  const keyboard = useWorkspaceKeyboard(dialog.draft !== null);
  const leftPanelId = useId();
  const propertiesPanelId = useId();
  const defaultViewport =
    viewport === null
      ? null
      : { x: viewport.x, y: viewport.y, zoom: viewport.zoom };

  return (
    <div className="flex h-dvh flex-col">
      <header>
        <EditorToolbar onRetrySave={onRetrySave} />
      </header>
      <div className="flex min-h-0 flex-1">
        {/* The skip link's target while nothing is selected. */}
        <div
          id={leftPanelId}
          tabIndex={-1}
          className={cn("flex min-h-0", FOCUS_TARGET_CLASS_NAME)}
        >
          <LeftPanel />
        </div>
        {/* The focusable canvas region (plan issue 73). */}
        <main
          ref={keyboard.setCanvasRegion}
          tabIndex={-1}
          aria-label={t("layout.canvasLabel")}
          className={cn("min-w-0 flex-1", FOCUS_TARGET_CLASS_NAME)}
        >
          <SkipToPanelLink
            propertiesPanelId={propertiesPanelId}
            leftPanelId={leftPanelId}
          />
          <EditorCanvas
            defaultViewport={defaultViewport}
            onMoveEnd={onMoveEnd}
            onAddTable={addTable}
            onConnect={dialog.openFromConnection}
          />
        </main>
        <PropertiesPanel
          id={propertiesPanelId}
          onCreateRelation={dialog.openFromTable}
          onDelete={keyboard.deleteSelection}
        />
      </div>
      <CreateRelationDialog draft={dialog.draft} onClose={dialog.closeDialog} />
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
