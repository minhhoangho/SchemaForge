import { describe, expect, it, vi } from "vitest";

import { createImporterClient, IMPORT_TIMEOUT_MS } from "./importer-client";
import type { ImportRequest, ImportResponse } from "./import-protocol";

class FakeWorker extends EventTarget implements Worker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly posted: unknown[] = [];
  isTerminated = false;

  postMessage(message: unknown): void {
    this.posted.push(message);
  }

  terminate(): void {
    this.isTerminated = true;
  }

  reply(response: ImportResponse): void {
    this.onmessage?.(new MessageEvent("message", { data: response }));
  }
}

const request: Omit<ImportRequest, "requestId"> = {
  format: "dbml",
  source: "Table a { id int }",
  fallbackSchemaName: "Untitled",
  layout: { tableWidth: 320, headerHeight: 37, columnRowHeight: 28, gap: 80 },
  mode: { mode: "new" },
  target: null,
};

function setup(): {
  workers: FakeWorker[];
  fireTimers: () => void;
  client: ReturnType<typeof createImporterClient>;
  scheduled: number[];
  cancelled: number[];
} {
  const workers: FakeWorker[] = [];
  const timers = new Map<number, () => void>();
  const scheduled: number[] = [];
  const cancelled: number[] = [];
  let nextTimer = 0;
  const client = createImporterClient({
    createWorker: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
    schedule: (callback, delay) => {
      scheduled.push(delay);
      nextTimer += 1;
      const handle = nextTimer;
      timers.set(handle, callback);
      return () => {
        cancelled.push(handle);
        timers.delete(handle);
      };
    },
  });
  return {
    workers,
    client,
    scheduled,
    cancelled,
    fireTimers: () => {
      for (const callback of [...timers.values()]) callback();
    },
  };
}

const crashed = (requestId: number): ImportResponse => ({
  requestId,
  kind: "crashed",
});

describe("createImporterClient", () => {
  it("creates the worker lazily on the first run", () => {
    const { client, workers } = setup();
    expect(workers).toHaveLength(0);

    void client.run(request);

    expect(workers).toHaveLength(1);
    expect(workers[0]?.posted[0]).toMatchObject({
      requestId: 1,
      format: "dbml",
    });
  });

  it("reuses the worker for the next run after a response", async () => {
    const { client, workers } = setup();
    const first = client.run(request);
    workers[0]?.reply(crashed(1));
    await first;

    void client.run(request);

    expect(workers).toHaveLength(1);
  });

  it("resolves with the response of the matching request", async () => {
    const { client, workers } = setup();
    const promise = client.run(request);

    workers[0]?.reply({ requestId: 1, kind: "failure", diagnostics: [] });

    expect(await promise).toStrictEqual({
      requestId: 1,
      kind: "failure",
      diagnostics: [],
    });
  });

  it("terminates the worker and resolves timeout after thirty seconds", async () => {
    const { client, workers, scheduled, fireTimers } = setup();
    const promise = client.run(request);
    expect(scheduled).toStrictEqual([IMPORT_TIMEOUT_MS]);
    expect(IMPORT_TIMEOUT_MS).toBe(30_000);

    fireTimers();

    expect(await promise).toStrictEqual({ kind: "timeout" });
    expect(workers[0]?.isTerminated).toBe(true);
  });

  it("terminates the worker on cancel and starts a new one on the next run", async () => {
    const { client, workers, cancelled } = setup();
    const promise = client.run(request);

    client.cancel();

    expect(await promise).toStrictEqual({ kind: "cancelled" });
    expect(workers[0]?.isTerminated).toBe(true);
    expect(cancelled).toHaveLength(1);
    void client.run(request);
    expect(workers).toHaveLength(2);
  });

  it("does nothing on cancel without a run", () => {
    const { client, workers } = setup();

    client.cancel();

    expect(workers).toHaveLength(0);
  });

  it("ignores a response for an older request", async () => {
    const { client, workers } = setup();
    const promise = client.run(request);
    let isSettled = false;
    void promise.then(() => {
      isSettled = true;
    });

    workers[0]?.reply(crashed(99));
    await Promise.resolve();
    expect(isSettled).toBe(false);
    workers[0]?.reply(crashed(1));

    expect(await promise).toStrictEqual(crashed(1));
  });

  it("ignores a message that is not a response", async () => {
    const { client, workers } = setup();
    const promise = client.run(request);

    workers[0]?.onmessage?.(new MessageEvent("message", { data: "noise" }));
    workers[0]?.reply(crashed(1));

    expect(await promise).toStrictEqual(crashed(1));
  });

  it("resolves crashed and drops a dead worker on error", async () => {
    const { client, workers } = setup();
    const promise = client.run(request);

    workers[0]?.onerror?.(new ErrorEvent("error"));

    expect(await promise).toStrictEqual({ requestId: 1, kind: "crashed" });
    expect(workers[0]?.isTerminated).toBe(true);
    void client.run(request);
    expect(workers).toHaveLength(2);
  });

  it("cancels a run in flight when a new one starts", async () => {
    const { client, workers } = setup();
    const first = client.run(request);

    void client.run(request);

    expect(await first).toStrictEqual({ kind: "cancelled" });
    expect(workers).toHaveLength(2);
  });

  it("disposes the worker", async () => {
    const { client, workers } = setup();
    const promise = client.run(request);

    client.dispose();

    expect(workers[0]?.isTerminated).toBe(true);
    expect(await promise).toStrictEqual({ kind: "cancelled" });
  });

  it("uses real timers by default", async () => {
    vi.useFakeTimers();
    const client = createImporterClient({
      timeoutMs: 50,
      createWorker: () => {
        return new FakeWorker();
      },
    });
    const promise = client.run(request);

    await vi.advanceTimersByTimeAsync(50);

    expect(await promise).toStrictEqual({ kind: "timeout" });
    vi.useRealTimers();
  });
});
