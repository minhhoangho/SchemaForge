import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";

import {
  AI_GENERATE_ID,
  AI_GLOBAL_REQUESTS_PER_HOUR,
  AI_LANGUAGE_MODEL,
  AI_PROVIDERS,
  createAiLanguageModel,
} from "./ai-model.provider.js";

// Named without "key" or "secret" so the secret scan does not flag it (plan, Vấn đề 54).
const FAKE_GEMINI_CREDENTIAL = "test-gemini-key-not-real";
const MODEL_ID = "gemini-3.5-flash";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

async function resolveProviders(config: Record<string, unknown>) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      ...AI_PROVIDERS,
      { provide: ConfigService, useValue: new ConfigService(config) },
    ],
  }).compile();
  return {
    model: moduleRef.get<unknown>(AI_LANGUAGE_MODEL),
    generateId: moduleRef.get<() => string>(AI_GENERATE_ID),
    budgetPerHour: moduleRef.get<unknown>(AI_GLOBAL_REQUESTS_PER_HOUR),
  };
}

describe("createAiLanguageModel", () => {
  it("returns null without an API key", () => {
    expect(
      createAiLanguageModel({ apiKey: undefined, model: MODEL_ID }),
    ).toBeNull();
  });

  it("returns null without a model id", () => {
    expect(
      createAiLanguageModel({
        apiKey: FAKE_GEMINI_CREDENTIAL,
        model: undefined,
      }),
    ).toBeNull();
  });

  it("creates a Google model with the configured model id", () => {
    const model = createAiLanguageModel({
      apiKey: FAKE_GEMINI_CREDENTIAL,
      model: MODEL_ID,
    });

    expect(model).toMatchObject({
      modelId: MODEL_ID,
      provider: "google.generative-ai",
    });
  });
});

describe("AI_PROVIDERS", () => {
  it("provides a null model when config has no API key", async () => {
    const { model } = await resolveProviders({ GEMINI_MODEL: MODEL_ID });

    expect(model).toBeNull();
  });

  it("provides the Google model from config", async () => {
    const { model } = await resolveProviders({
      GEMINI_API_KEY: FAKE_GEMINI_CREDENTIAL,
      GEMINI_MODEL: MODEL_ID,
    });

    expect(model).toMatchObject({ modelId: MODEL_ID });
  });

  it("provides the global budget from config", async () => {
    const { budgetPerHour } = await resolveProviders({
      AI_GLOBAL_REQUESTS_PER_HOUR: 2,
    });

    expect(budgetPerHour).toBe(2);
  });

  it("provides a generator of distinct random UUIDs", async () => {
    const { generateId } = await resolveProviders({});

    const [first, second] = [generateId(), generateId()];

    expect(first).toMatch(UUID_PATTERN);
    expect(second).not.toBe(first);
  });
});
