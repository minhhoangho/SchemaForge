import type { OutputLanguage } from "@schemaforge/core";
import {
  createCssVariablesTheme,
  createHighlighterCore,
  type HighlighterCore,
  type LanguageInput,
} from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

import type { CodeToken } from "./worker-protocol";

export type HighlightLanguage =
  "sql" | "prisma" | "typescript" | "json" | "markdown";

export function toHighlightLanguage(
  language: OutputLanguage,
): HighlightLanguage | null {
  return language === "dbml" ? null : language;
}

// Never import "shiki" or "shiki/bundle/*": they pull in every grammar.
const grammars: Readonly<
  Record<HighlightLanguage, () => Promise<{ default: LanguageInput }>>
> = {
  sql: () => import("shiki/langs/sql.mjs"),
  prisma: () => import("shiki/langs/prisma.mjs"),
  typescript: () => import("shiki/langs/typescript.mjs"),
  json: () => import("shiki/langs/json.mjs"),
  markdown: () => import("shiki/langs/markdown.mjs"),
};

let highlighter: Promise<HighlighterCore> | null = null;
const loadedLanguages = new Set<HighlightLanguage>();

function getHighlighter(): Promise<HighlighterCore> {
  highlighter ??= createHighlighterCore({
    themes: [
      createCssVariablesTheme({
        name: "schemaforge",
        variablePrefix: "--code-",
        variableDefaults: {},
        fontStyle: true,
      }),
    ],
    langs: [],
    engine: createJavaScriptRegexEngine(),
  });
  return highlighter;
}

export async function highlightCode(
  code: string,
  language: HighlightLanguage,
): Promise<readonly (readonly CodeToken[])[]> {
  const instance = await getHighlighter();
  if (!loadedLanguages.has(language)) {
    await instance.loadLanguage((await grammars[language]()).default);
    loadedLanguages.add(language);
  }
  const { tokens } = instance.codeToTokens(code, {
    lang: language,
    theme: "schemaforge",
  });
  return tokens.map((line) =>
    line.map((token) => ({
      content: token.content,
      color: token.color ?? null,
    })),
  );
}
