import { Test } from "@nestjs/testing";
import { beforeAll, describe, expect, it } from "vitest";

import { Argon2PasswordHasher, PasswordHasher } from "./password-hasher.js";

const PASSWORD = "correct horse battery staple";
// "mật khẩu an toàn" with precomposed letters; NFD splits them into base letter plus marks.
const PRECOMPOSED_PASSWORD = "mật khẩu an toàn";
const COMBINING_PASSWORD = PRECOMPOSED_PASSWORD.normalize("NFD");

describe("Argon2PasswordHasher", () => {
  let hasher: PasswordHasher;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [{ provide: PasswordHasher, useClass: Argon2PasswordHasher }],
    }).compile();
    hasher = moduleRef.get(PasswordHasher);
  });

  it("hashes with argon2id and the parameters of spec section 2", async () => {
    const passwordHash = await hasher.hash(PASSWORD);

    expect(passwordHash.startsWith("$argon2id$v=19$m=19456,t=2,p=1$")).toBe(
      true,
    );
  });

  it("produces different hashes for the same password", async () => {
    const [first, second] = await Promise.all([
      hasher.hash(PASSWORD),
      hasher.hash(PASSWORD),
    ]);

    expect(first).not.toBe(second);
  });

  it("verifies the correct password", async () => {
    const passwordHash = await hasher.hash(PASSWORD);

    await expect(hasher.verify(passwordHash, PASSWORD)).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const passwordHash = await hasher.hash(PASSWORD);

    await expect(hasher.verify(passwordHash, `${PASSWORD}!`)).resolves.toBe(
      false,
    );
  });

  it("rejects a password that differs only in normalization form", async () => {
    const passwordHash = await hasher.hash(PRECOMPOSED_PASSWORD);

    await expect(hasher.verify(passwordHash, COMBINING_PASSWORD)).resolves.toBe(
      false,
    );
  });

  it("rethrows the library error when the stored hash is malformed", async () => {
    await expect(hasher.verify("not-a-phc-string", PASSWORD)).rejects.toThrow();
  });
});
