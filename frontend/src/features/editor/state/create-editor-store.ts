import type {
  DocumentPath,
  GenerateId,
  History,
  HistoryEntry,
  Operation,
  OperationError,
  Position,
  Result,
  SchemaDocument,
  TableId,
} from "@schemaforge/core";
import {
  applyOperation,
  createEmptyHistory,
  mergeLastEntry,
  recordEntry,
  redo,
  undo,
} from "@schemaforge/core";
import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";

import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";
import type { StorageErrorCode } from "@/lib/storage/storage-error";

import { EMPTY_SELECTION, filterSelection } from "../lib/selection";
import type { Selection } from "../lib/selection";

export const HISTORY_LIMIT = 200;

const KEYBOARD_MOVE_KEY_PREFIX = "keyboardMove:";

export type SaveStatus =
  | { readonly kind: "saved" }
  | { readonly kind: "saving" }
  | { readonly kind: "failed"; readonly errorCode: StorageErrorCode };

export type LeftPanelTab = "tables" | "enums" | "issues";

export type DispatchOptions = { readonly coalesce?: "keyboardMove" };

export type DragPositions = Readonly<Partial<Record<TableId, Position>>>;

export type EditorState = {
  readonly schemaId: string;
  readonly document: SchemaDocument;
  readonly history: History;
  readonly selection: Selection;
  readonly dragPositions: DragPositions;
  readonly leftPanelTab: LeftPanelTab | null;
  readonly focusRequest: DocumentPath | null;
  readonly saveStatus: SaveStatus;
  readonly coalesceKey: string | null;
};

export type EditorActions = {
  readonly dispatch: (
    operation: Operation,
    options?: DispatchOptions,
  ) => Result<void, OperationError>;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly setSelection: (selection: Selection) => void;
  readonly setDragPositions: (dragPositions: DragPositions) => void;
  readonly setLeftPanelTab: (tab: LeftPanelTab | null) => void;
  readonly requestFocus: (path: DocumentPath | null) => void;
  readonly setSaveStatus: (status: SaveStatus) => void;
  readonly replaceDocument: (document: SchemaDocument) => void;
};

export type EditorStore = StoreApi<EditorState & EditorActions>;

export type CreateEditorStoreInput = {
  readonly schemaId: string;
  readonly document: SchemaDocument;
  readonly generateId: GenerateId;
  readonly notify: Notify;
  readonly logger: Logger;
};

type SetState = EditorStore["setState"];
type GetState = EditorStore["getState"];

/**
 * Returns the key that lets consecutive keyboard moves of the same set of
 * elements merge into one history entry, or `null` for any other operation.
 */
export function getMoveCoalesceKey(operation: Operation): string | null {
  if (operation.type !== "moveElements") {
    return null;
  }
  const elementIds = operation.moves
    .map((elementMove) => elementMove.elementId)
    .toSorted();
  return `${KEYBOARD_MOVE_KEY_PREFIX}${elementIds.join(",")}`;
}

function createDispatch(
  set: SetState,
  get: GetState,
  input: CreateEditorStoreInput,
): EditorActions["dispatch"] {
  return (operation, options) => {
    const state = get();
    const applied = applyOperation(state.document, operation);
    if (!applied.isOk) {
      const { code, path } = applied.error;
      input.logger.error("editor.operation-rejected", {
        operationType: operation.type,
        code,
        path,
      });
      input.notify({
        tone: "error",
        titleKey: "errors:operationNotApplied",
        descriptionKey: `errors:codes.${code}`,
      });
      return { isOk: false, error: applied.error };
    }

    const { schema, inverse } = applied.value;
    if (schema === state.document) {
      return { isOk: true, value: undefined };
    }

    const entry: HistoryEntry = { operation, inverse };
    const key =
      options?.coalesce === "keyboardMove"
        ? getMoveCoalesceKey(operation)
        : null;
    const history =
      key !== null && key === state.coalesceKey
        ? mergeLastEntry(state.history, entry)
        : recordEntry(state.history, entry, HISTORY_LIMIT);
    set({
      document: schema,
      history,
      selection: filterSelection(state.selection, schema),
      coalesceKey: key,
    });
    return { isOk: true, value: undefined };
  };
}

// Core throws when an inverse no longer applies; the store lets it propagate
// so the route error boundary shows it.
function createHistoryStep(
  set: SetState,
  get: GetState,
  step: typeof undo,
): () => void {
  return () => {
    const state = get();
    const result = step(state.history, state.document);
    if (result === null) {
      return;
    }
    set({
      document: result.schema,
      history: result.history,
      selection: filterSelection(state.selection, result.schema),
      coalesceKey: null,
    });
  };
}

/**
 * Creates the store of one open schema. `dispatch` is the only way to change
 * the document. `input.generateId` stays out of the state: new ids come from
 * the operation builders, not from the store.
 */
export function createEditorStore(input: CreateEditorStoreInput): EditorStore {
  return createStore<EditorState & EditorActions>()((set, get) => ({
    schemaId: input.schemaId,
    document: input.document,
    history: createEmptyHistory(),
    selection: EMPTY_SELECTION,
    dragPositions: {},
    leftPanelTab: "tables",
    focusRequest: null,
    saveStatus: { kind: "saved" },
    coalesceKey: null,
    dispatch: createDispatch(set, get, input),
    undo: createHistoryStep(set, get, undo),
    redo: createHistoryStep(set, get, redo),
    setSelection: (selection) => {
      set({ selection });
    },
    setDragPositions: (dragPositions) => {
      set({ dragPositions });
    },
    setLeftPanelTab: (leftPanelTab) => {
      set({ leftPanelTab });
    },
    requestFocus: (focusRequest) => {
      set({ focusRequest });
    },
    setSaveStatus: (saveStatus) => {
      set({ saveStatus });
    },
    replaceDocument: (document) => {
      set({
        document,
        history: createEmptyHistory(),
        selection: EMPTY_SELECTION,
        dragPositions: {},
        coalesceKey: null,
      });
    },
  }));
}
