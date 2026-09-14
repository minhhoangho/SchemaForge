import { describe, expect, it } from "vitest";

import { validate } from "./env.js";

describe("validate", () => {
  it("returns the parsed values when the environment is valid", () => {
    expect(validate({ NODE_ENV: "production", PORT: "8080" })).toEqual({
      NODE_ENV: "production",
      PORT: 8080,
    });
  });

  it("applies defaults when variables are missing", () => {
    expect(validate({})).toEqual({ NODE_ENV: "development", PORT: 3001 });
  });

  it("throws when PORT is not a number", () => {
    expect(() => validate({ PORT: "abc" })).toThrow(/PORT/);
  });
});
