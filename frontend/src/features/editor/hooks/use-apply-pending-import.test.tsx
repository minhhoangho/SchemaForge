import type { BatchOperation, Operation } from "@schemaforge/core";
import {
  createCounterIdGenerator,
  makeColumn,
  makeTable,
  buildSchema,
} from "@schemaforge/core/testing";
import { act, render } from "@testing-library/react";
import { StrictMode, useEffect } from "react";
import type { JSX } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  PendingImportProvider,
  usePendingImport,
} from "@/components/pending-import-provider";
import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";

import { createEditorStore } from "../state/create-editor-store";
import type { EditorStore } from "../state/create-editor-store";
import { useApplyPendingImport } from "./use-apply-pending-import";

const SCHEMA_ID = "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4";
const IMPORTED_NAME = "imported";
const IMPORT: BatchOperation = {
  type: "batch",
  operations: [{ type: "renameSchema", name: IMPORTED_NAME }],
};
const ADD_EMAIL: Operation = {
  type: "addColumn",
  column: makeColumn({ id: "col_email", tableId: "tbl_users", name: "email" }),
  insertAt: 0,
};

function createStore(): EditorStore {
  return createEditorStore({
    schemaId: SCHEMA_ID,
    document: buildSchema({
      name: "shop",
      tables: [makeTable({ id: "tbl_users", name: "users" })],
    }),
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
}

type EditorProbeProps = {
  readonly store: EditorStore;
  readonly pendingSchemaId: string | null;
};

// Leaves the entry the schema list would leave, then runs the hook under test.
function EditorProbe({
  store,
  pendingSchemaId,
}: EditorProbeProps): JSX.Element {
  const { setPendingImport } = usePendingImport();
  if (pendingSchemaId !== null) {
    setPendingImport({ schemaId: pendingSchemaId, operation: IMPORT });
  }
  return <TakePendingImport store={store} />;
}

function TakePendingImport({ store }: { readonly store: EditorStore }): null {
  useApplyPendingImport(store);
  return null;
}

// The hook applies the import in a microtask.
async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

async function mount(
  store: EditorStore,
  pendingSchemaId: string | null,
  isStrict = false,
): Promise<void> {
  const tree = (
    <PendingImportProvider>
      <EditorProbe store={store} pendingSchemaId={pendingSchemaId} />
    </PendingImportProvider>
  );
  render(isStrict ? <StrictMode>{tree}</StrictMode> : tree);
  await flushMicrotasks();
}

describe("useApplyPendingImport", () => {
  it("dispatches the pending operation once", async () => {
    const store = createStore();

    await mount(store, SCHEMA_ID);

    expect([
      store.getState().document.name,
      store.getState().history.past.length,
    ]).toStrictEqual([IMPORTED_NAME, 1]);
  });

  it("dispatches once under StrictMode", async () => {
    const store = createStore();

    await mount(store, SCHEMA_ID, true);

    expect(store.getState().history.past).toHaveLength(1);
  });

  it("does nothing without a pending import", async () => {
    const store = createStore();

    await mount(store, null);

    expect(store.getState().history.past).toHaveLength(0);
  });

  it("does nothing for the pending import of another schema", async () => {
    const store = createStore();

    await mount(store, "another-schema");

    expect(store.getState().history.past).toHaveLength(0);
  });

  it("disables import during an AI proposal preview", async () => {
    const store = createStore();
    store.getState().startProposalPreview("msg_1", ADD_EMAIL);

    await mount(store, SCHEMA_ID);

    expect([
      store.getState().document.name,
      store.getState().history.past.length,
    ]).toStrictEqual(["shop", 0]);
  });

  it("keeps the entry during a preview for the editor of the same schema", async () => {
    const previewing = createStore();
    previewing.getState().startProposalPreview("msg_1", ADD_EMAIL);
    const free = createStore();
    const tree = (
      <PendingImportProvider>
        <EditorProbe store={previewing} pendingSchemaId={SCHEMA_ID} />
        <TakePendingImport store={free} />
      </PendingImportProvider>
    );

    render(tree);
    await flushMicrotasks();

    expect(free.getState().document.name).toBe(IMPORTED_NAME);
  });

  it("reaches a subscriber that the same StrictMode pass registered", async () => {
    const store = createStore();
    const received: string[] = [];
    function Subscriber(): null {
      useEffect(
        () =>
          store.subscribe((state) => {
            received.push(state.document.name);
          }),
        [],
      );
      return null;
    }

    render(
      <StrictMode>
        <PendingImportProvider>
          <Subscriber />
          <EditorProbe store={store} pendingSchemaId={SCHEMA_ID} />
        </PendingImportProvider>
      </StrictMode>,
    );
    await flushMicrotasks();

    expect(received).toStrictEqual([IMPORTED_NAME]);
  });
});
