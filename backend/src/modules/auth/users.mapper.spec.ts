import { describe, expect, it } from "vitest";

import { toUserResponse } from "./users.mapper.js";
import type { UserCredentials, UserRecord } from "./users.repository.js";

function makeUser(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: "0190f3a0-0000-7000-8000-000000000001",
    email: "alice@example.com",
    createdAt: new Date("2026-09-18T10:00:00.000Z"),
    ...overrides,
  };
}

describe("toUserResponse", () => {
  it("maps createdAt to an ISO 8601 string", () => {
    const response = toUserResponse(makeUser());

    expect(response.createdAt).toBe("2026-09-18T10:00:00.000Z");
  });

  it("returns only id, email and createdAt even when the record has more fields", () => {
    const credentials: UserCredentials = {
      ...makeUser(),
      // Stand-in for an argon2id PHC string, obviously not a real one.
      passwordHash: "fake-hash",
    };

    const response = toUserResponse(credentials);

    expect(response).toStrictEqual({
      id: "0190f3a0-0000-7000-8000-000000000001",
      email: "alice@example.com",
      createdAt: "2026-09-18T10:00:00.000Z",
    });
  });
});
