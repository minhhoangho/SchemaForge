import { afterEach, describe, expect, it } from "vitest";

import { AiModule } from "./ai.module.js";

afterEach(() => {
  globalThis.AI_SDK_LOG_WARNINGS = undefined;
});

describe("AiModule", () => {
  it("turns off the AI SDK warning logger on init", () => {
    new AiModule().onModuleInit();

    expect(globalThis.AI_SDK_LOG_WARNINGS).toBe(false);
  });
});
