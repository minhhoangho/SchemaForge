import { createHash } from "node:crypto";

import { Injectable, Logger } from "@nestjs/common";

import { Clock } from "../../common/clock.js";
import {
  type NewRefreshToken,
  type RefreshTokenRecord,
  RefreshTokenRepository,
} from "./refresh-token.repository.js";
import { TokenGenerator } from "./token-generator.js";

/** 30 days, counted from the latest issue (spec section 1). */
export const REFRESH_TOKEN_TTL_SECONDS = 2_592_000;

const MILLISECONDS_PER_SECOND = 1000;

export type IssuedRefreshToken = {
  readonly token: string;
  readonly expiresAt: Date;
};

export type RefreshRotation =
  | {
      readonly kind: "rotated";
      readonly userId: string;
      readonly refreshToken: IssuedRefreshToken;
    }
  | { readonly kind: "rejected" };

const REJECTED: RefreshRotation = { kind: "rejected" };

/** A 256-bit random token needs no slow hash; SHA-256 keeps it indexable. */
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

type PreparedToken = {
  readonly issued: IssuedRefreshToken;
  readonly record: NewRefreshToken;
};

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    private readonly repository: RefreshTokenRepository,
    private readonly tokenGenerator: TokenGenerator,
    private readonly clock: Clock,
  ) {}

  async issueForNewSession(userId: string): Promise<IssuedRefreshToken> {
    const now = this.clock.now();
    const familyId = this.tokenGenerator.generateFamilyId();
    const prepared = this.prepare(userId, familyId, now);
    await this.repository.createForNewFamily(prepared.record, now);
    return prepared.issued;
  }

  async rotate(rawToken: string): Promise<RefreshRotation> {
    const now = this.clock.now();
    const current = await this.repository.findByHash(
      hashRefreshToken(rawToken),
    );
    if (current === null) {
      return REJECTED;
    }
    if (current.revokedAt !== null) {
      return REJECTED;
    }
    if (current.rotatedAt !== null) {
      return this.rejectReuse(current, now);
    }
    if (current.expiresAt.getTime() <= now.getTime()) {
      return REJECTED;
    }
    const next = this.prepare(current.userId, current.familyId, now);
    const isRotated = await this.repository.rotate(current, next.record, now);
    if (!isRotated) {
      // A concurrent request rotated this token first: treated as reuse (plan issue 24).
      return this.rejectReuse(current, now);
    }
    return {
      kind: "rotated",
      userId: current.userId,
      refreshToken: next.issued,
    };
  }

  async revokeFamilyOf(rawToken: string): Promise<void> {
    const current = await this.repository.findByHash(
      hashRefreshToken(rawToken),
    );
    if (current !== null) {
      await this.repository.revokeFamily(current.familyId, this.clock.now());
    }
  }

  private prepare(userId: string, familyId: string, now: Date): PreparedToken {
    const token = this.tokenGenerator.generateRefreshToken();
    const expiresAt = new Date(
      now.getTime() + REFRESH_TOKEN_TTL_SECONDS * MILLISECONDS_PER_SECOND,
    );
    return {
      issued: { token, expiresAt },
      record: {
        userId,
        familyId,
        tokenHash: hashRefreshToken(token),
        expiresAt,
      },
    };
  }

  private async rejectReuse(
    current: RefreshTokenRecord,
    now: Date,
  ): Promise<RefreshRotation> {
    await this.repository.revokeFamily(current.familyId, now);
    this.logger.warn(
      `Refresh token reuse detected for user ${current.userId}, revoked family ${current.familyId}`,
    );
    return REJECTED;
  }
}
