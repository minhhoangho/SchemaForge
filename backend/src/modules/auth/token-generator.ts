import { randomBytes, randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";

const REFRESH_TOKEN_BYTES = 32;

/** Abstract class so it doubles as the DI token; tests provide fixed values. */
export abstract class TokenGenerator {
  /** 256 random bits, base64url encoded (spec section 1). */
  abstract generateRefreshToken(): string;
  abstract generateFamilyId(): string;
}

@Injectable()
export class CryptoTokenGenerator extends TokenGenerator {
  override generateRefreshToken(): string {
    return randomBytes(REFRESH_TOKEN_BYTES).toString("base64url");
  }

  override generateFamilyId(): string {
    return randomUUID();
  }
}
