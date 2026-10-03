import type * as ShikiCore from "shiki/core";
import { describe, expect, it, vi } from "vitest";

const loadLanguage = vi.hoisted(() => vi.fn());

vi.mock("shiki/core", async (importActual) => {
  const actual = await importActual<typeof ShikiCore>();
  return {
    ...actual,
    createHighlighterCore: async (
      ...args: Parameters<typeof actual.createHighlighterCore>
    ) => {
      const highlighter = await actual.createHighlighterCore(...args);
      const original = highlighter.loadLanguage.bind(highlighter);
      highlighter.loadLanguage = (...languages) => {
        loadLanguage(...languages);
        return original(...languages);
      };
      return highlighter;
    },
  };
});

import {
  highlightCode,
  toHighlightLanguage,
  type HighlightLanguage,
} from "./highlight-code";

describe("toHighlightLanguage", () => {
  it("maps output languages to highlight languages and dbml to null", () => {
    expect(toHighlightLanguage("sql")).toBe("sql");
    expect(toHighlightLanguage("json")).toBe("json");
    expect(toHighlightLanguage("dbml")).toBeNull();
  });
});

describe("highlightCode", () => {
  it("tokenizes sql into lines of colored tokens", async () => {
    const lines = await highlightCode("SELECT 1;\nSELECT 2;", "sql");
    expect(lines).toHaveLength(2);
    const colors = lines.flat().map((token) => token.color);
    expect(colors.some((c) => c?.startsWith("var(--code-"))).toBe(true);
    expect(lines[0]?.map((token) => token.content).join("")).toBe("SELECT 1;");
  });

  it.each<[HighlightLanguage, string]>([
    ["prisma", "model User {\n  id Int @id\n}"],
    ["typescript", "export type A = { a: string };"],
    ["json", '{ "a": 1 }'],
    ["markdown", "# Title\n\n- item"],
  ])("tokenizes %s", async (language, code) => {
    const lines = await highlightCode(code, language);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.flat().length).toBeGreaterThan(0);
  });

  it("loads each grammar once", async () => {
    vi.resetModules();
    loadLanguage.mockClear();
    const fresh = await import("./highlight-code");
    await fresh.highlightCode("a = 1", "json");
    await fresh.highlightCode("b = 2", "json");
    expect(loadLanguage).toHaveBeenCalledTimes(1);
  });
});
