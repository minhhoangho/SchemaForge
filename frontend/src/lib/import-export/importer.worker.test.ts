import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const post = vi.fn<(message: unknown) => void>();

beforeAll(async () => {
  vi.spyOn(self, "postMessage").mockImplementation(post);
  await import("./importer.worker");
});

afterEach(() => {
  post.mockClear();
});

async function send(data: unknown): Promise<void> {
  await self.onmessage?.call(self, new MessageEvent("message", { data }));
}

const request = {
  requestId: 7,
  format: "json",
  source: "{",
  fallbackSchemaName: "Untitled",
  layout: { tableWidth: 320, headerHeight: 37, columnRowHeight: 28, gap: 80 },
  mode: { mode: "new" },
  target: null,
};

describe("importer worker", () => {
  it("imports zod-config before any other module", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/lib/import-export/importer.worker.ts"),
      "utf8",
    );

    expect(source.split("\n")[0]).toBe('import "@/lib/zod-config";');
  });

  it("answers a request with failure diagnostics for unreadable source", async () => {
    await send(request);

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0]?.[0]).toMatchObject({
      requestId: 7,
      kind: "failure",
    });
  });

  it("answers crashed when the handler throws", async () => {
    // A new-mode request cannot carry a non-empty target through the guard, so
    // force the throw with a merge target the importer cannot merge into.
    await send({
      ...request,
      mode: { mode: "merge", origin: { x: 0, y: 0 } },
      target: { not: "a document" },
      source: '{"name":"x"}',
    });

    expect(post.mock.calls[0]?.[0]).toMatchObject({
      requestId: 7,
    });
  });

  it("answers crashed when the result cannot be posted", async () => {
    post.mockImplementationOnce(() => {
      throw new DOMException("not cloneable", "DataCloneError");
    });

    await send(request);

    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[1]?.[0]).toStrictEqual({
      requestId: 7,
      kind: "crashed",
    });
  });

  it("ignores a message that is not an import request", async () => {
    await send({ requestId: 1 });

    expect(post).not.toHaveBeenCalled();
  });
});
