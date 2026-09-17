import { Injectable } from "@nestjs/common";
import { hash, verify } from "@node-rs/argon2";

export abstract class PasswordHasher {
  /** Expects a password already normalized to NFKC by the caller. */
  abstract hash(password: string): Promise<string>;
  abstract verify(passwordHash: string, password: string): Promise<boolean>;
}

// OWASP minimum argon2id parameters (spec section 2). `algorithm` is omitted on purpose:
// the library's `Algorithm` is an ambient const enum unusable under `isolatedModules`,
// and its default is argon2id, which the spec pins through the PHC prefix.
export const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class Argon2PasswordHasher extends PasswordHasher {
  override hash(password: string): Promise<string> {
    return hash(password, ARGON2_OPTIONS);
  }

  override verify(passwordHash: string, password: string): Promise<boolean> {
    return verify(passwordHash, password);
  }
}
