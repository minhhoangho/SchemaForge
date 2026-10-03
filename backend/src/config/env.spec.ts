import { describe, expect, it } from "vitest";

import { JWT_ACCESS_SECRET_EXAMPLE, validate } from "./env.js";

const VALID_SECRET = "a".repeat(32);
const SHORT_JWT_VALUE = "leak-probe-31";
const DATABASE_URL = "postgresql://localhost:5432/schemaforge";
const FAKE_GEMINI_CREDENTIAL = "test-gemini-key-not-real";
const GEMINI_MODEL_ID = "gemini-3.5-flash";

function validConfig(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    NODE_ENV: "development",
    PORT: "3001",
    DATABASE_URL,
    JWT_ACCESS_SECRET: VALID_SECRET,
    CORS_ORIGINS: "http://localhost:3000",
    AUTH_COOKIE_SECURE: "true",
    TRUST_PROXY_HOPS: "0",
    ...overrides,
  };
}

describe("validate", () => {
  it("returns the parsed values when the environment is valid", () => {
    expect(validate(validConfig())).toEqual({
      NODE_ENV: "development",
      PORT: 3001,
      DATABASE_URL,
      JWT_ACCESS_SECRET: VALID_SECRET,
      CORS_ORIGINS: ["http://localhost:3000"],
      AUTH_COOKIE_SECURE: true,
      TRUST_PROXY_HOPS: 0,
      AI_GLOBAL_REQUESTS_PER_HOUR: 1000,
    });
  });

  it("applies defaults to optional variables", () => {
    const result = validate(
      validConfig({
        NODE_ENV: undefined,
        PORT: undefined,
        AUTH_COOKIE_SECURE: undefined,
        TRUST_PROXY_HOPS: undefined,
      }),
    );
    expect(result.NODE_ENV).toBe("development");
    expect(result.PORT).toBe(3001);
    expect(result.AUTH_COOKIE_SECURE).toBe(true);
    expect(result.TRUST_PROXY_HOPS).toBe(0);
  });

  it("throws when PORT is not a number", () => {
    expect(() => validate(validConfig({ PORT: "abc" }))).toThrow(/PORT/);
  });

  it("rejects a missing DATABASE_URL", () => {
    expect(() => validate(validConfig({ DATABASE_URL: undefined }))).toThrow(
      /DATABASE_URL/,
    );
  });

  it("rejects a DATABASE_URL whose protocol is not postgres", () => {
    expect(() =>
      validate(validConfig({ DATABASE_URL: "mysql://localhost/schemaforge" })),
    ).toThrow(/DATABASE_URL/);
  });

  it("rejects a JWT_ACCESS_SECRET shorter than 32 characters", () => {
    expect(() =>
      validate(validConfig({ JWT_ACCESS_SECRET: "a".repeat(31) })),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });

  it.each([
    ["*"],
    ["http://localhost:3000/app"],
    ["http://localhost:3000/"],
    [""],
  ])("rejects an invalid CORS_ORIGINS value (%s)", (value) => {
    expect(() => validate(validConfig({ CORS_ORIGINS: value }))).toThrow(
      /CORS_ORIGINS/,
    );
  });

  it("parses CORS_ORIGINS into a list of trimmed origins", () => {
    const result = validate(
      validConfig({
        CORS_ORIGINS: " http://localhost:3000 , https://schemaforge.app ",
      }),
    );
    expect(result.CORS_ORIGINS).toEqual([
      "http://localhost:3000",
      "https://schemaforge.app",
    ]);
  });

  it("reads AUTH_COOKIE_SECURE false as false", () => {
    const result = validate(validConfig({ AUTH_COOKIE_SECURE: "false" }));
    expect(result.AUTH_COOKIE_SECURE).toBe(false);
  });

  it("rejects AUTH_COOKIE_SECURE values other than true or false", () => {
    expect(() => validate(validConfig({ AUTH_COOKIE_SECURE: "yes" }))).toThrow(
      /AUTH_COOKIE_SECURE/,
    );
  });

  it("rejects a negative TRUST_PROXY_HOPS", () => {
    expect(() => validate(validConfig({ TRUST_PROXY_HOPS: "-1" }))).toThrow(
      /TRUST_PROXY_HOPS/,
    );
  });

  it("rejects AUTH_COOKIE_SECURE false in production", () => {
    expect(() =>
      validate(
        validConfig({
          NODE_ENV: "production",
          CORS_ORIGINS: "https://schemaforge.app",
          AUTH_COOKIE_SECURE: "false",
        }),
      ),
    ).toThrow(/AUTH_COOKIE_SECURE/);
  });

  it("rejects an http origin in production", () => {
    expect(() =>
      validate(
        validConfig({
          NODE_ENV: "production",
          CORS_ORIGINS: "http://schemaforge.app",
        }),
      ),
    ).toThrow(/CORS_ORIGINS/);
  });

  it("rejects the example JWT secret in production", () => {
    expect(() =>
      validate(
        validConfig({
          NODE_ENV: "production",
          CORS_ORIGINS: "https://schemaforge.app",
          JWT_ACCESS_SECRET: JWT_ACCESS_SECRET_EXAMPLE,
        }),
      ),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });

  it("never includes the secret value in the error message", () => {
    const config = validConfig({ JWT_ACCESS_SECRET: SHORT_JWT_VALUE });

    expect(() => validate(config)).toThrow(/JWT_ACCESS_SECRET/);
    expect(() => validate(config)).not.toThrow(SHORT_JWT_VALUE);
  });

  it("accepts a config without GEMINI_API_KEY", () => {
    const result = validate(validConfig());

    expect(result.GEMINI_API_KEY).toBeUndefined();
    expect(result.GEMINI_MODEL).toBeUndefined();
  });

  it("treats an empty GEMINI_API_KEY as absent", () => {
    const result = validate(
      validConfig({ GEMINI_API_KEY: "  ", GEMINI_MODEL: "" }),
    );

    expect(result.GEMINI_API_KEY).toBeUndefined();
    expect(result.GEMINI_MODEL).toBeUndefined();
  });

  it.each([
    ["development", "http://localhost:3000"],
    ["production", "https://schemaforge.app"],
  ])(
    "rejects GEMINI_API_KEY without GEMINI_MODEL in %s",
    (nodeEnv, corsOrigins) => {
      const config = validConfig({
        NODE_ENV: nodeEnv,
        CORS_ORIGINS: corsOrigins,
        GEMINI_API_KEY: FAKE_GEMINI_CREDENTIAL,
        GEMINI_MODEL: " ",
      });

      expect(() => validate(config)).toThrow(
        /GEMINI_MODEL is required when GEMINI_API_KEY is set/,
      );
    },
  );

  it("accepts GEMINI_API_KEY with GEMINI_MODEL", () => {
    const result = validate(
      validConfig({
        GEMINI_API_KEY: FAKE_GEMINI_CREDENTIAL,
        GEMINI_MODEL: GEMINI_MODEL_ID,
      }),
    );

    expect(result.GEMINI_API_KEY).toBe(FAKE_GEMINI_CREDENTIAL);
    expect(result.GEMINI_MODEL).toBe(GEMINI_MODEL_ID);
  });

  it("defaults AI_GLOBAL_REQUESTS_PER_HOUR to 1000", () => {
    const result = validate(
      validConfig({ AI_GLOBAL_REQUESTS_PER_HOUR: undefined }),
    );

    expect(result.AI_GLOBAL_REQUESTS_PER_HOUR).toBe(1000);
  });

  it.each([["0"], ["-5"], ["1.5"]])(
    "rejects a non-positive AI_GLOBAL_REQUESTS_PER_HOUR (%s)",
    (value) => {
      expect(() =>
        validate(validConfig({ AI_GLOBAL_REQUESTS_PER_HOUR: value })),
      ).toThrow(/AI_GLOBAL_REQUESTS_PER_HOUR/);
    },
  );

  it("never puts the key value in the error message", () => {
    const config = validConfig({ GEMINI_API_KEY: FAKE_GEMINI_CREDENTIAL });

    expect(() => validate(config)).toThrow(/GEMINI_MODEL/);
    expect(() => validate(config)).not.toThrow(FAKE_GEMINI_CREDENTIAL);
  });
});
