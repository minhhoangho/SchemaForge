import { randomUUID } from "node:crypto";

import { createGoogle } from "@ai-sdk/google";
import type { Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { GenerateId } from "@schemaforge/core";
import type { LanguageModel } from "ai";

import type { Env } from "../../config/env.js";

/** `LanguageModel | null`: null when the server has no `GEMINI_API_KEY`. */
export const AI_LANGUAGE_MODEL = Symbol("AI_LANGUAGE_MODEL");
/** `GenerateId`; tests provide `createCounterIdGenerator` of core. */
export const AI_GENERATE_ID = Symbol("AI_GENERATE_ID");
/** `number`: a token so e2e tests can override the budget (plan, Vấn đề 5). */
export const AI_GLOBAL_REQUESTS_PER_HOUR = Symbol(
  "AI_GLOBAL_REQUESTS_PER_HOUR",
);

/**
 * The only place the Gemini key goes (AI-R27): passed straight to the provider,
 * so the SDK never reads `process.env`, and never stored anywhere else.
 */
export function createAiLanguageModel(config: {
  readonly apiKey: string | undefined;
  readonly model: string | undefined;
}): LanguageModel | null {
  if (config.apiKey === undefined || config.model === undefined) {
    return null;
  }
  return createGoogle({ apiKey: config.apiKey })(config.model);
}

const generateId: GenerateId = () => randomUUID();

export const AI_PROVIDERS: readonly Provider[] = [
  {
    provide: AI_LANGUAGE_MODEL,
    inject: [ConfigService],
    useFactory: (config: ConfigService<Env, true>): LanguageModel | null =>
      createAiLanguageModel({
        apiKey: config.get("GEMINI_API_KEY", { infer: true }),
        model: config.get("GEMINI_MODEL", { infer: true }),
      }),
  },
  { provide: AI_GENERATE_ID, useValue: generateId },
  {
    provide: AI_GLOBAL_REQUESTS_PER_HOUR,
    inject: [ConfigService],
    useFactory: (config: ConfigService<Env, true>): number =>
      config.get("AI_GLOBAL_REQUESTS_PER_HOUR", { infer: true }),
  },
];
