import { createEmptySchema } from "@schemaforge/core";
import { createCounterIdGenerator } from "@schemaforge/core/testing";
import { act, screen, waitFor } from "@testing-library/react";
import type { JSX } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "@/lib/logger";
import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";
import { renderWithProviders } from "@/testing/render-with-providers";

import { captureCanvasImage } from "../import-export/capture-canvas-image";
import { DEFAULT_ZIP_SELECTION } from "../import-export/zip-selection";
import { CanvasNodeControlsProvider } from "../lib/viewport-controls";
import type { CanvasNodeControls } from "../lib/viewport-controls";
import { createEditorStore } from "../state/create-editor-store";
import { EditorStoreProvider } from "../state/editor-store-provider";
import type { BuiltZip } from "./use-build-zip";
import { BuildCancelledError, useBuildZip } from "./use-build-zip";
import { isBuildZipRequest } from "./worker-protocol";
import type { BuildZipRequest, BuildZipResponse } from "./worker-protocol";

vi.mock("../import-export/capture-canvas-image", () => ({
  captureCanvasImage: vi.fn<typeof captureCanvasImage>(),
}));
const capture = vi.mocked(captureCanvasImage);

class FakeWorker extends EventTarget implements Worker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly terminate = vi.fn();
  readonly requests: BuildZipRequest[] = [];
  // null: the worker errors; "hang": it never answers.
  reply: (request: BuildZipRequest) => BuildZipResponse | null | "hang" = (
    request,
  ) => ({
    requestId: request.requestId,
    kind: "zip",
    bytes: new Uint8Array([9]),
    diagnosticCount: 3,
  });

  transferredCount = 0;
  readonly postMessage = vi.fn<
    (
      message: unknown,
      options?: StructuredSerializeOptions | Transferable[],
    ) => void
  >((message, options) => {
    if (!isBuildZipRequest(message)) return;
    this.transferredCount = Array.isArray(options)
      ? options.length
      : (options?.transfer?.length ?? 0);
    this.requests.push(message);
    const response = this.reply(message);
    if (response === "hang") return;
    if (response === null) {
      this.onerror?.(new ErrorEvent("error"));
    } else {
      this.onmessage?.(new MessageEvent("message", { data: response }));
    }
  });
}

type Result = {
  built: BuiltZip | null;
  hasFailed: boolean;
  isCancelled: boolean;
};

function Probe({
  createWorker,
  result,
}: {
  readonly createWorker: () => FakeWorker;
  readonly result: Result;
}): JSX.Element {
  const { build, isBuilding, cancel } = useBuildZip({ createWorker });
  return (
    <>
      <button
        type="button"
        onClick={() => {
          build().then(
            (built) => {
              result.built = built;
            },
            (error: unknown) => {
              if (error instanceof BuildCancelledError) {
                result.isCancelled = true;
              } else {
                result.hasFailed = true;
              }
            },
          );
        }}
      >
        {isBuilding ? "busy" : "build"}
      </button>
      <button type="button" onClick={cancel}>
        cancel
      </button>
    </>
  );
}

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

function setup(zipSelection = DEFAULT_ZIP_SELECTION, hasCanvas = true) {
  const store = createEditorStore({
    schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    document: createEmptySchema("Shop Orders"),
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
  store.getState().setZipSelection(zipSelection);
  const workers: FakeWorker[] = [new FakeWorker()];
  const createWorker = vi.fn((): FakeWorker => {
    const next = workers.at(-1);
    if (next === undefined) throw new Error("no worker");
    return next;
  });
  const worker = workers[0] ?? new FakeWorker();
  const result: Result = { built: null, hasFailed: false, isCancelled: false };
  const controls: CanvasNodeControls = {
    getMeasuredNodes: () => [],
    fitNodes: vi.fn<CanvasNodeControls["fitNodes"]>(),
  };
  const view = renderWithProviders(
    <EditorStoreProvider store={store}>
      <CanvasNodeControlsProvider controls={controls}>
        {hasCanvas && <div data-export-root="" />}
        <Probe createWorker={createWorker} result={result} />
      </CanvasNodeControlsProvider>
    </EditorStoreProvider>,
    { locale: "en" },
  );
  return { ...view, worker, workers, createWorker, result };
}

beforeEach(() => {
  capture.mockReset();
  vi.mocked(logger.error).mockReset();
});

describe("useBuildZip", () => {
  it("sends the selection to the worker and returns the zip", async () => {
    const { user, worker, result } = setup({
      ...DEFAULT_ZIP_SELECTION,
      sql: ["mysql"],
    });
    await user.click(screen.getByRole("button", { name: "build" }));

    await waitFor(() => {
      expect(result.built).toStrictEqual({
        bytes: new Uint8Array([9]),
        diagnosticCount: 3,
        baseName: "shop-orders",
      });
    });
    expect(worker.requests[0]).toMatchObject({
      kind: "build-zip",
      baseName: "shop-orders",
      includeJson: true,
      generators: [{ target: "mysql", options: {} }],
      images: [],
    });
  });

  it("captures the selected images on the main thread and transfers their bytes", async () => {
    capture.mockImplementation(({ format }) =>
      Promise.resolve({
        blob: new Blob([format]),
        isScaledDown: false,
      }),
    );
    const { user, worker, result } = setup({
      ...DEFAULT_ZIP_SELECTION,
      json: false,
      png: true,
      svg: true,
    });
    await user.click(screen.getByRole("button", { name: "build" }));

    await waitFor(() => {
      expect(result.built).not.toBeNull();
    });
    expect(
      worker.requests[0]?.images.map((image) => image.fileName),
    ).toStrictEqual(["shop-orders.png", "shop-orders.svg"]);
    expect(worker.transferredCount).toBe(2);
  });

  it("rejects when the worker answers zip-failed", async () => {
    const { user, worker, result } = setup();
    worker.reply = (request) => ({
      requestId: request.requestId,
      kind: "zip-failed",
    });
    await user.click(screen.getByRole("button", { name: "build" }));

    await waitFor(() => {
      expect(result.hasFailed).toBe(true);
    });
  });

  it("rejects when the worker fails to load, then builds with a new worker", async () => {
    const { user, worker, workers, createWorker, result } = setup();
    worker.reply = () => null;
    await user.click(screen.getByRole("button", { name: "build" }));

    await waitFor(() => {
      expect(result.hasFailed).toBe(true);
    });
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledWith("export.zip-failed", {
      errorName: "Error",
    });

    workers.push(new FakeWorker());
    await user.click(screen.getByRole("button", { name: "build" }));
    await waitFor(() => {
      expect(result.built).not.toBeNull();
    });
    expect(createWorker).toHaveBeenCalledTimes(2);
  });

  it("cancels a build in flight and builds again afterwards", async () => {
    const { user, worker, workers, result } = setup();
    worker.reply = () => "hang";
    await user.click(screen.getByRole("button", { name: "build" }));
    expect(screen.getByRole("button", { name: "busy" })).toBeDefined();

    await user.click(screen.getByRole("button", { name: "cancel" }));

    await waitFor(() => {
      expect(result.isCancelled).toBe(true);
    });
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(result.hasFailed).toBe(false);
    expect(logger.error).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "build" })).toBeDefined();

    workers.push(new FakeWorker());
    await user.click(screen.getByRole("button", { name: "build" }));
    await waitFor(() => {
      expect(result.built).not.toBeNull();
    });
  });

  it("does not post to the worker when cancelled during image capture", async () => {
    let finish: (value: { blob: Blob; isScaledDown: boolean }) => void = () =>
      undefined;
    capture.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { user, worker, result } = setup({
      ...DEFAULT_ZIP_SELECTION,
      png: true,
    });
    await user.click(screen.getByRole("button", { name: "build" }));
    await user.click(screen.getByRole("button", { name: "cancel" }));
    await act(async () => {
      finish({ blob: new Blob(["x"]), isScaledDown: false });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.isCancelled).toBe(true);
    });
    expect(worker.postMessage).not.toHaveBeenCalled();
  });

  it("rejects when the canvas is not mounted for an image", async () => {
    const { user, result } = setup(
      { ...DEFAULT_ZIP_SELECTION, png: true },
      false,
    );
    await user.click(screen.getByRole("button", { name: "build" }));

    await waitFor(() => {
      expect(result.hasFailed).toBe(true);
    });
  });

  it("terminates the worker on unmount", async () => {
    const { user, worker, unmount } = setup();
    await user.click(screen.getByRole("button", { name: "build" }));
    await waitFor(() => {
      expect(worker.postMessage).toHaveBeenCalled();
    });
    unmount();

    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});
