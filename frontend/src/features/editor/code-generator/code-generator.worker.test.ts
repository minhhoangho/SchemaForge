import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createEmptySchema } from "@schemaforge/core";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const post = vi.fn<(message: unknown) => void>();

beforeAll(async () => {
  vi.spyOn(self, "postMessage").mockImplementation(post);
  await import("./code-generator.worker");
});

afterEach(() => {
  post.mockClear();
});

async function send(data: unknown): Promise<void> {
  await self.onmessage?.call(self, new MessageEvent("message", { data }));
}

const document = createEmptySchema("Empty");

describe("code generator worker", () => {
  it("imports zod-config before any other module", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "src/features/editor/code-generator/code-generator.worker.ts",
      ),
      "utf8",
    );
    expect(source.split("\n")[0]).toBe('import "@/lib/zod-config";');
  });

  it("answers a request with the file, diagnostics and tokens", async () => {
    await send({ requestId: 7, target: "postgresql", options: {}, document });
    const response = post.mock.calls[0]?.[0];
    expect(response).toMatchObject({
      requestId: 7,
      kind: "ok",
      file: { language: "sql" },
      diagnostics: [],
    });
    expect(response).not.toMatchObject({ tokens: null });
  });

  it("answers null tokens for dbml", async () => {
    await send({ requestId: 8, target: "dbml", options: {}, document });
    expect(post.mock.calls[0]?.[0]).toMatchObject({
      kind: "ok",
      tokens: null,
    });
  });

  it("answers failed when the generator throws", async () => {
    await send({
      requestId: 9,
      target: "seed",
      options: { format: "json", rowsPerTable: -1, seed: 1 },
      document,
    });
    expect(post).toHaveBeenCalledWith({ requestId: 9, kind: "failed" });
  });

  it("ignores a malformed message", async () => {
    await send({ requestId: "x" });
    expect(post).not.toHaveBeenCalled();
  });
});
