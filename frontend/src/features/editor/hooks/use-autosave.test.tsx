import type { SchemaDocument } from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeTable,
} from "@schemaforge/core/testing";
import { act, renderHook } from "@testing-library/react";
import type { JSX, ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/components/i18n-provider";
import { logger } from "@/lib/logger";
import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";
import type { SchemaRepository } from "@/lib/storage/schema-repository";

import { createEditorStore } from "../state/create-editor-store";
import type { EditorStore } from "../state/create-editor-store";
import { useAutosave } from "./use-autosave";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const SCHEMA_ID = "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4";

type SaveDocument = SchemaRepository["saveDocument"];

function createTestStore(): EditorStore {
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

function createFakeRepository(saveDocument: SaveDocument): SchemaRepository {
  return {
    listSchemas: vi.fn<SchemaRepository["listSchemas"]>(),
    createSchema: vi.fn<SchemaRepository["createSchema"]>(),
    openSchema: vi.fn<SchemaRepository["openSchema"]>(),
    saveDocument,
    renameSchema: vi.fn<SchemaRepository["renameSchema"]>(),
    deleteSchema: vi.fn<SchemaRepository["deleteSchema"]>(),
    readViewport: vi.fn<SchemaRepository["readViewport"]>(),
    saveViewport: vi.fn<SchemaRepository["saveViewport"]>(),
    readSchemaRecord: vi.fn<SchemaRepository["readSchemaRecord"]>(),
    listOwnedSchemas: vi.fn<SchemaRepository["listOwnedSchemas"]>(),
    writeCloudCopy: vi.fn<SchemaRepository["writeCloudCopy"]>(),
    completePush: vi.fn<SchemaRepository["completePush"]>(),
    setSyncState: vi.fn<SchemaRepository["setSyncState"]>(),
    assignOwner: vi.fn<SchemaRepository["assignOwner"]>(),
    changeSchemaId: vi.fn<SchemaRepository["changeSchemaId"]>(),
    readSession: vi.fn<SchemaRepository["readSession"]>(),
    writeSession: vi.fn<SchemaRepository["writeSession"]>(),
    deleteSession: vi.fn<SchemaRepository["deleteSession"]>(),
  };
}

function I18nWrapper({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  return <I18nProvider locale="en">{children}</I18nProvider>;
}

function renameSchema(store: EditorStore, name: string): SchemaDocument {
  act(() => {
    store.getState().dispatch({ type: "renameSchema", name });
  });
  return store.getState().document;
}

function renderAutosave(store: EditorStore, saveDocument: SaveDocument) {
  const repository = createFakeRepository(saveDocument);
  return renderHook(() => useAutosave({ store, repository }), {
    wrapper: I18nWrapper,
  });
}

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("useAutosave", () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
    vi.spyOn(logger, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("saves the document after a dispatch", async () => {
    const store = createTestStore();
    const saveDocument = vi.fn<SaveDocument>().mockResolvedValue(undefined);
    renderAutosave(store, saveDocument);

    const document = renameSchema(store, "orders");
    await settle();

    expect(saveDocument).toHaveBeenCalledExactlyOnceWith(SCHEMA_ID, document);
  });

  it("does not save when nothing changed", async () => {
    const store = createTestStore();
    const saveDocument = vi.fn<SaveDocument>().mockResolvedValue(undefined);
    renderAutosave(store, saveDocument);

    act(() => {
      store.getState().setLeftPanelTab("enums");
    });
    await settle();

    expect(saveDocument).not.toHaveBeenCalled();
  });

  it("saves only once while a save is in flight", async () => {
    const store = createTestStore();
    const inFlight = Promise.withResolvers<undefined>();
    const saveDocument = vi.fn<SaveDocument>(() => inFlight.promise);
    renderAutosave(store, saveDocument);

    renameSchema(store, "orders");
    renameSchema(store, "invoices");
    await settle();

    expect(saveDocument).toHaveBeenCalledOnce();
  });

  it("saves the newest document after the in-flight save finishes", async () => {
    const store = createTestStore();
    const inFlight = Promise.withResolvers<undefined>();
    const saveDocument = vi
      .fn<SaveDocument>()
      .mockReturnValueOnce(inFlight.promise)
      .mockResolvedValue(undefined);
    renderAutosave(store, saveDocument);

    renameSchema(store, "orders");
    renameSchema(store, "invoices");
    const newestDocument = renameSchema(store, "payments");
    await act(async () => {
      inFlight.resolve(undefined);
      await inFlight.promise;
    });
    await settle();

    expect(saveDocument).toHaveBeenCalledTimes(2);
    expect(saveDocument).toHaveBeenLastCalledWith(SCHEMA_ID, newestDocument);
  });

  it("saves a change made right after the in-flight save finishes", async () => {
    const store = createTestStore();
    const inFlight = Promise.withResolvers<undefined>();
    const saveDocument = vi
      .fn<SaveDocument>()
      .mockReturnValueOnce(inFlight.promise)
      .mockResolvedValue(undefined);
    renderAutosave(store, saveDocument);
    renameSchema(store, "orders");
    // Runs right after the hook resumes from the in-flight write, before any
    // later step of the save has had a chance to run.
    const changedInGap = inFlight.promise.then(() => {
      store.getState().dispatch({ type: "renameSchema", name: "invoices" });
    });

    await act(async () => {
      inFlight.resolve(undefined);
      await changedInGap;
    });
    await settle();

    expect(saveDocument).toHaveBeenCalledTimes(2);
    expect(saveDocument).toHaveBeenLastCalledWith(
      SCHEMA_ID,
      store.getState().document,
    );
    expect(store.getState().saveStatus).toStrictEqual({ kind: "saved" });
  });

  it("sets the save status to saving and then saved", async () => {
    const store = createTestStore();
    const inFlight = Promise.withResolvers<undefined>();
    const saveDocument = vi.fn<SaveDocument>(() => inFlight.promise);
    renderAutosave(store, saveDocument);

    renameSchema(store, "orders");
    const statusWhileSaving = store.getState().saveStatus;
    await act(async () => {
      inFlight.resolve(undefined);
      await inFlight.promise;
    });
    await settle();

    expect(statusWhileSaving).toStrictEqual({ kind: "saving" });
    expect(store.getState().saveStatus).toStrictEqual({ kind: "saved" });
  });

  it("sets the save status to failed with the mapped storage code", async () => {
    const store = createTestStore();
    const saveDocument = vi
      .fn<SaveDocument>()
      .mockRejectedValue(new DOMException("full", "QuotaExceededError"));
    renderAutosave(store, saveDocument);

    renameSchema(store, "orders");
    await settle();

    expect(store.getState().saveStatus).toStrictEqual({
      kind: "failed",
      errorCode: "quota-exceeded",
    });
  });

  it("keeps the document in memory when saving fails", async () => {
    const store = createTestStore();
    const saveDocument = vi
      .fn<SaveDocument>()
      .mockRejectedValue(new DOMException("full", "QuotaExceededError"));
    renderAutosave(store, saveDocument);

    const document = renameSchema(store, "orders");
    await settle();

    expect(store.getState().document).toBe(document);
  });

  it("logs the error name without the message when saving fails", async () => {
    const logError = vi.spyOn(logger, "error");
    const store = createTestStore();
    const saveDocument = vi
      .fn<SaveDocument>()
      .mockRejectedValue(new DOMException("secret", "QuotaExceededError"));
    renderAutosave(store, saveDocument);

    renameSchema(store, "orders");
    await settle();

    expect(logError).toHaveBeenCalledWith("editor.save-failed", {
      code: "quota-exceeded",
      errorName: "QuotaExceededError",
    });
  });

  it("shows a translated toast with a retry action when saving fails", async () => {
    const store = createTestStore();
    const saveDocument = vi
      .fn<SaveDocument>()
      .mockRejectedValue(new DOMException("full", "QuotaExceededError"));
    const { result } = renderAutosave(store, saveDocument);

    renameSchema(store, "orders");
    await settle();

    expect(toast.error).toHaveBeenCalledWith(
      "Browser storage is full. Delete some schemas and try again.",
      { action: { label: "Retry", onClick: result.current.retry } },
    );
  });

  it("saves again when retry is called", async () => {
    const store = createTestStore();
    const saveDocument = vi
      .fn<SaveDocument>()
      .mockRejectedValueOnce(new Error("failed"))
      .mockResolvedValue(undefined);
    const { result } = renderAutosave(store, saveDocument);

    const document = renameSchema(store, "orders");
    await settle();
    act(() => {
      result.current.retry();
    });
    await settle();

    expect(saveDocument).toHaveBeenCalledTimes(2);
    expect(saveDocument).toHaveBeenLastCalledWith(SCHEMA_ID, document);
    expect(store.getState().saveStatus).toStrictEqual({ kind: "saved" });
  });

  it("stops saving after unmount", async () => {
    const store = createTestStore();
    const saveDocument = vi.fn<SaveDocument>().mockResolvedValue(undefined);
    const { unmount } = renderAutosave(store, saveDocument);

    unmount();
    renameSchema(store, "orders");
    await settle();

    expect(saveDocument).not.toHaveBeenCalled();
  });

  it("does not save on retry after unmount", async () => {
    const store = createTestStore();
    const saveDocument = vi
      .fn<SaveDocument>()
      .mockRejectedValueOnce(new Error("failed"))
      .mockResolvedValue(undefined);
    const { result, unmount } = renderAutosave(store, saveDocument);
    renameSchema(store, "orders");
    await settle();
    const { retry } = result.current;

    unmount();
    retry();
    await settle();

    expect(saveDocument).toHaveBeenCalledOnce();
  });

  it("does not write a pending document after unmount", async () => {
    const store = createTestStore();
    const inFlight = Promise.withResolvers<undefined>();
    const saveDocument = vi
      .fn<SaveDocument>()
      .mockReturnValueOnce(inFlight.promise)
      .mockResolvedValue(undefined);
    const { unmount } = renderAutosave(store, saveDocument);
    renameSchema(store, "orders");
    renameSchema(store, "invoices");

    unmount();
    await act(async () => {
      inFlight.resolve(undefined);
      await inFlight.promise;
    });
    await settle();

    expect(saveDocument).toHaveBeenCalledOnce();
  });

  it("does not set the save status when a write finishes after unmount", async () => {
    const store = createTestStore();
    const inFlight = Promise.withResolvers<undefined>();
    const saveDocument = vi.fn<SaveDocument>(() => inFlight.promise);
    const { unmount } = renderAutosave(store, saveDocument);
    renameSchema(store, "orders");

    unmount();
    await act(async () => {
      inFlight.resolve(undefined);
      await inFlight.promise;
    });
    await settle();

    expect(store.getState().saveStatus).toStrictEqual({ kind: "saving" });
  });

  it("does not report a write that fails after unmount", async () => {
    const store = createTestStore();
    const inFlight = Promise.withResolvers<undefined>();
    const saveDocument = vi.fn<SaveDocument>(() => inFlight.promise);
    const { unmount } = renderAutosave(store, saveDocument);
    renameSchema(store, "orders");

    unmount();
    await act(async () => {
      inFlight.reject(new DOMException("full", "QuotaExceededError"));
      await inFlight.promise.catch(() => undefined);
    });
    await settle();

    expect(toast.error).not.toHaveBeenCalled();
    expect(store.getState().saveStatus).toStrictEqual({ kind: "saving" });
  });
});
