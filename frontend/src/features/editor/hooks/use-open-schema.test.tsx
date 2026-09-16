import { createEmptySchema } from "@schemaforge/core";
import type { SchemaDocument } from "@schemaforge/core";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  OpenSchemaResult,
  SchemaRepository,
} from "@/lib/storage/schema-repository";
import type { ViewportRecord } from "@/lib/storage/records";

import { useOpenSchema } from "./use-open-schema";
import type { OpenSchemaState } from "./use-open-schema";

const SCHEMA_ID = "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4";
const VIEWPORT: ViewportRecord = { schemaId: SCHEMA_ID, x: 10, y: 20, zoom: 1 };

type Deferred<Value> = {
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value) => void;
};

function createDeferred<Value>(): Deferred<Value> {
  let resolve: (value: Value) => void = () => undefined;
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createRepository(
  overrides: Partial<SchemaRepository> = {},
): SchemaRepository {
  const document = createEmptySchema("Billing");
  return {
    listSchemas: vi.fn<SchemaRepository["listSchemas"]>(),
    createSchema: vi.fn<SchemaRepository["createSchema"]>(),
    openSchema: vi
      .fn<SchemaRepository["openSchema"]>()
      .mockResolvedValue({ kind: "opened", document }),
    saveDocument: vi.fn<SchemaRepository["saveDocument"]>(),
    renameSchema: vi.fn<SchemaRepository["renameSchema"]>(),
    deleteSchema: vi.fn<SchemaRepository["deleteSchema"]>(),
    readViewport: vi
      .fn<SchemaRepository["readViewport"]>()
      .mockResolvedValue(VIEWPORT),
    saveViewport: vi.fn<SchemaRepository["saveViewport"]>(),
    ...overrides,
  };
}

type HookProps = { readonly grantId: number | null };

function renderOpenSchema(
  repository: SchemaRepository,
  grantId: number | null,
) {
  return renderHook(
    ({ grantId: currentGrantId }: HookProps) =>
      useOpenSchema({
        repository,
        schemaId: SCHEMA_ID,
        grantId: currentGrantId,
      }),
    { initialProps: { grantId } },
  );
}

function createDexieError(name: string): Error {
  const error = new Error("Dexie failed.");
  error.name = name;
  return error;
}

describe("useOpenSchema", () => {
  it("stays in opening while no lock has been granted", async () => {
    const repository = createRepository();

    const { result } = renderOpenSchema(repository, null);
    await act(() => Promise.resolve());

    expect({
      state: result.current,
      readCount: vi.mocked(repository.openSchema).mock.calls.length,
    }).toEqual({ state: { kind: "opening" }, readCount: 0 });
  });

  it("reads the document and the viewport together", async () => {
    const document = createEmptySchema("Billing");
    const repository = createRepository({
      openSchema: vi
        .fn<SchemaRepository["openSchema"]>()
        .mockResolvedValue({ kind: "opened", document }),
    });

    const { result } = renderOpenSchema(repository, 1);

    await waitFor(() => {
      expect(result.current).toEqual({
        kind: "opened",
        document,
        viewport: VIEWPORT,
      });
    });
    expect({
      openedIds: vi.mocked(repository.openSchema).mock.calls,
      viewportIds: vi.mocked(repository.readViewport).mock.calls,
    }).toEqual({ openedIds: [[SCHEMA_ID]], viewportIds: [[SCHEMA_ID]] });
  });

  it("re-reads the document when a new grant arrives", async () => {
    const firstDocument = createEmptySchema("Billing");
    const secondDocument = createEmptySchema("Invoices");
    const repository = createRepository({
      openSchema: vi
        .fn<SchemaRepository["openSchema"]>()
        .mockResolvedValueOnce({ kind: "opened", document: firstDocument })
        .mockResolvedValueOnce({ kind: "opened", document: secondDocument }),
    });
    const { result, rerender } = renderOpenSchema(repository, 1);
    await waitFor(() => {
      expect(result.current.kind).toBe("opened");
    });

    rerender({ grantId: null });
    const whileWaiting: OpenSchemaState = result.current;
    rerender({ grantId: 2 });

    await waitFor(() => {
      expect(result.current).toEqual({
        kind: "opened",
        document: secondDocument,
        viewport: VIEWPORT,
      });
    });
    expect(whileWaiting).toEqual({ kind: "opening" });
  });

  // React 19 drops a state update on an unmounted component without a trace,
  // so a late result is made observable by releasing the lock (the effect is
  // cleaned up) and taking the same grant again while the new read is pending.
  it("ignores a result that arrives after its read was cleaned up", async () => {
    const lateRead = createDeferred<OpenSchemaResult>();
    const currentRead = createDeferred<OpenSchemaResult>();
    const repository = createRepository({
      openSchema: vi
        .fn<SchemaRepository["openSchema"]>()
        .mockReturnValueOnce(lateRead.promise)
        .mockReturnValueOnce(currentRead.promise),
    });
    const { result, rerender } = renderOpenSchema(repository, 1);
    rerender({ grantId: null });

    await act(async () => {
      lateRead.resolve({ kind: "not-found" });
      await lateRead.promise;
    });
    rerender({ grantId: 1 });

    expect(result.current).toEqual({ kind: "opening" });
  });

  it("ignores a result for a grant that was replaced", async () => {
    const staleRead = createDeferred<OpenSchemaResult>();
    const freshDocument: SchemaDocument = createEmptySchema("Fresh");
    const repository = createRepository({
      openSchema: vi
        .fn<SchemaRepository["openSchema"]>()
        .mockReturnValueOnce(staleRead.promise)
        .mockResolvedValueOnce({ kind: "opened", document: freshDocument }),
    });
    const { result, rerender } = renderOpenSchema(repository, 1);

    rerender({ grantId: 2 });
    await waitFor(() => {
      expect(result.current.kind).toBe("opened");
    });
    await act(async () => {
      staleRead.resolve({ kind: "not-found" });
      await staleRead.promise;
    });

    expect(result.current).toEqual({
      kind: "opened",
      document: freshDocument,
      viewport: VIEWPORT,
    });
  });

  it("reports not found for a schema that was never stored", async () => {
    const repository = createRepository({
      openSchema: vi
        .fn<SchemaRepository["openSchema"]>()
        .mockResolvedValue({ kind: "not-found" }),
    });

    const { result } = renderOpenSchema(repository, 1);

    await waitFor(() => {
      expect(result.current).toEqual({ kind: "not-found" });
    });
  });

  it.each([
    [
      "version-unsupported",
      true,
      [{ code: "version-unsupported", path: ["version"] }],
    ],
    ["invalid-shape", false, [{ code: "invalid-shape", path: ["name"] }]],
  ] as const)(
    "marks an unreadable document with %s",
    async (_code, isVersionUnsupported, errors) => {
      const repository = createRepository({
        openSchema: vi
          .fn<SchemaRepository["openSchema"]>()
          .mockResolvedValue({ kind: "unreadable", errors }),
      });

      const { result } = renderOpenSchema(repository, 1);

      await waitFor(() => {
        expect(result.current).toEqual({
          kind: "unreadable",
          isVersionUnsupported,
        });
      });
    },
  );

  it("maps a thrown dexie error to a storage error", async () => {
    const repository = createRepository({
      readViewport: vi
        .fn<SchemaRepository["readViewport"]>()
        .mockRejectedValue(createDexieError("DatabaseClosedError")),
    });

    const { result } = renderOpenSchema(repository, 1);

    await waitFor(() => {
      expect(result.current).toEqual({
        kind: "storage-error",
        errorCode: "closed",
      });
    });
  });
});
