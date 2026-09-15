import { describe, expect, it, vi } from "vitest";

// Zod must not be loaded before this file runs, so nothing here imports zod,
// ./zod-config, or a module that uses Zod statically.
const ZOD_GLOBAL_CONFIG_KEY = "__zod_globalConfig";

if (ZOD_GLOBAL_CONFIG_KEY in globalThis) {
  throw new Error(
    "Zod was loaded before zod-config.test.ts, so first-import behavior cannot be checked. Remove the earlier Zod import (for example from a setup file).",
  );
}

const firstImportSpy = vi.spyOn(globalThis, "Function");
await import("./zod-config");
const functionCallCountOnFirstImport = firstImportSpy.mock.calls.length;
firstImportSpy.mockRestore();

const { z } = await import("zod");

describe("zod-config", () => {
  it("does not construct Function when zod is first imported", () => {
    expect(functionCallCountOnFirstImport).toBe(0);
  });

  it("enables zod jitless mode", () => {
    expect(z.config().jitless).toBe(true);
  });

  it("parses an object schema without constructing Function", () => {
    const functionSpy = vi.spyOn(globalThis, "Function");

    const schema = z.object({ name: z.string(), count: z.number() });
    const parsed = schema.parse({ name: "users", count: 2 });
    const constructionCount = functionSpy.mock.calls.length;
    functionSpy.mockRestore();

    expect({ parsed, constructionCount }).toStrictEqual({
      parsed: { name: "users", count: 2 },
      constructionCount: 0,
    });
  });
});
