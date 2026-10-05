import {
  createEmptySchema,
  type GeneratorOptions,
  type GeneratorTarget,
  type SchemaDocument,
} from "@schemaforge/core";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useGeneratedCode } from "./use-generated-code";
import type {
  GenerateCodeRequest,
  GenerateCodeResponse,
} from "./worker-protocol";

class FakeWorker extends EventTarget implements Worker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly postMessage = vi.fn<(request: GenerateCodeRequest) => void>();
  readonly terminate = vi.fn();

  fail(): void {
    act(() => {
      this.onerror?.(new ErrorEvent("error"));
    });
  }

  reply(response: GenerateCodeResponse): void {
    act(() => {
      this.onmessage?.(new MessageEvent("message", { data: response }));
    });
  }
}

function ok(requestId: number, content: string): GenerateCodeResponse {
  return {
    requestId,
    kind: "ok",
    file: { fileName: "a.sql", language: "sql", content },
    diagnostics: [],
    tokens: null,
  };
}

const docA = createEmptySchema("A");
const docB = createEmptySchema("B");
const options = {};

type Props = {
  isEnabled: boolean;
  document: SchemaDocument;
  target: GeneratorTarget;
  options: GeneratorOptions[GeneratorTarget];
};

function setup(isEnabled = true) {
  const worker = new FakeWorker();
  const createWorker = vi.fn((): Worker => worker);
  const hook = renderHook(
    (props: Props) =>
      // createWorker is passed inline on purpose: it must not drive the effect.
      useGeneratedCode({ ...props, createWorker: () => createWorker() }),
    {
      initialProps: {
        isEnabled,
        document: docA,
        target: "postgresql",
        options,
      },
    },
  );
  return { worker, createWorker, ...hook };
}

const base: Props = {
  isEnabled: true,
  document: docA,
  target: "postgresql",
  options,
};

describe("useGeneratedCode", () => {
  it("stays idle and creates no worker while disabled", () => {
    const { result, createWorker } = setup(false);
    expect(result.current).toEqual({ status: "idle" });
    expect(createWorker).not.toHaveBeenCalled();
  });

  it("sends a request when enabled and becomes ready", () => {
    const { result, worker } = setup();
    expect(result.current).toEqual({ status: "loading", previous: null });
    expect(worker.postMessage.mock.calls[0]?.[0]).toMatchObject({
      requestId: 1,
      target: "postgresql",
    });
    worker.reply(ok(1, "x\n"));
    expect(result.current.status).toBe("ready");
  });

  it("sends a new request when the document or target changes and keeps the previous result", () => {
    const { result, worker, rerender } = setup();
    worker.reply(ok(1, "x\n"));
    rerender({ ...base, document: docB });
    expect(result.current).toMatchObject({
      status: "loading",
      previous: { requestId: 1 },
    });
    rerender({ ...base, document: docB, target: "mysql" });
    expect(worker.postMessage).toHaveBeenCalledTimes(3);
    expect(worker.postMessage.mock.calls[2]?.[0]).toMatchObject({
      requestId: 3,
      target: "mysql",
    });
  });

  it("sends a new request when only the options change and reuses the worker", () => {
    const { worker, createWorker, rerender } = setup();
    rerender({ ...base, options: { provider: "mysql" } });
    expect(worker.postMessage).toHaveBeenCalledTimes(2);
    expect(worker.postMessage.mock.calls[1]?.[0]).toMatchObject({
      requestId: 2,
      options: { provider: "mysql" },
    });
    expect(createWorker).toHaveBeenCalledTimes(1);
  });

  it("ignores a response that arrives after disabling", () => {
    const { result, worker, rerender } = setup();
    const lateHandler = worker.onmessage;
    rerender({ ...base, isEnabled: false });
    act(() => {
      lateHandler?.(new MessageEvent("message", { data: ok(1, "late\n") }));
    });
    expect(result.current).toEqual({ status: "idle" });
    expect(worker.onmessage).toBeNull();
  });

  it("reports failed when the worker errors", () => {
    const { result, worker } = setup();
    worker.fail();
    expect(result.current).toEqual({ status: "failed" });
  });

  it("terminates a worker that failed and uses a new one for the next request", () => {
    const { worker, createWorker, rerender } = setup();
    worker.fail();
    expect(worker.terminate).toHaveBeenCalledOnce();

    rerender({ ...base, document: docB });
    expect(createWorker).toHaveBeenCalledTimes(2);
  });

  it("reports failed when a message cannot be deserialized", () => {
    const { result, worker } = setup();
    act(() => {
      worker.onmessageerror?.(new MessageEvent("messageerror"));
    });
    expect(result.current).toEqual({ status: "failed" });
  });

  it("ignores a stale response", () => {
    const { result, worker, rerender } = setup();
    rerender({ ...base, document: docB });
    worker.reply(ok(1, "old\n"));
    expect(result.current.status).toBe("loading");
    worker.reply(ok(2, "new\n"));
    expect(result.current.status).toBe("ready");
  });

  it("reports failed for a failed response", () => {
    const { result, worker } = setup();
    worker.reply({ requestId: 1, kind: "failed" });
    expect(result.current).toEqual({ status: "failed" });
  });

  it("returns to idle when disabled again", () => {
    const { result, rerender } = setup();
    rerender({ ...base, isEnabled: false });
    expect(result.current).toEqual({ status: "idle" });
  });

  it("terminates the worker on unmount", () => {
    const { worker, unmount } = setup();
    unmount();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});
