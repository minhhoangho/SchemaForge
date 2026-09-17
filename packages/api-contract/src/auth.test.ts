import { describe, expect, it } from "vitest";

import { authUserResponseSchema, userResponseSchema } from "./auth.js";

const USER = {
  id: "0b6c7c3e-5d0a-4b8e-9f1a-2c3d4e5f6a7b",
  email: "ada@example.com",
  createdAt: "2026-09-17T10:18:00.000Z",
};

describe("userResponseSchema", () => {
  it("parses a user response and drops unknown fields", () => {
    const result = userResponseSchema.safeParse({ ...USER, passwordHash: "x" });

    expect(result.data).toStrictEqual(USER);
  });

  it("rejects a user id that is not a uuid", () => {
    const result = userResponseSchema.safeParse({ ...USER, id: "user-1" });

    expect(result.success).toBe(false);
  });

  it("rejects a createdAt that is not an ISO datetime", () => {
    const result = userResponseSchema.safeParse({
      ...USER,
      createdAt: "17/09/2026",
    });

    expect(result.success).toBe(false);
  });
});

describe("authUserResponseSchema", () => {
  it("parses the user envelope returned by register, login and me", () => {
    const result = authUserResponseSchema.safeParse({ user: USER });

    expect(result.data).toStrictEqual({ user: USER });
  });
});
