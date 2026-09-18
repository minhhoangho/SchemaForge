import { describe, expect, it } from "vitest";

import { CryptoTokenGenerator } from "./token-generator.js";

const BASE64URL_43 = /^[A-Za-z0-9_-]{43}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("CryptoTokenGenerator", () => {
  const generator = new CryptoTokenGenerator();

  it("generates a 43 character base64url refresh token", () => {
    expect(generator.generateRefreshToken()).toMatch(BASE64URL_43);
  });

  it("generates different refresh tokens on each call", () => {
    expect(generator.generateRefreshToken()).not.toBe(
      generator.generateRefreshToken(),
    );
  });

  it("generates a uuid family id", () => {
    expect(generator.generateFamilyId()).toMatch(UUID);
  });
});
