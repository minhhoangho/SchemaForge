import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../prisma/prisma.service.js";

export const REFRESH_TOKEN_SELECT = {
  id: true,
  userId: true,
  familyId: true,
  expiresAt: true,
  rotatedAt: true,
  revokedAt: true,
} as const satisfies Prisma.RefreshTokenSelect;

export type RefreshTokenRecord = Prisma.RefreshTokenGetPayload<{
  select: typeof REFRESH_TOKEN_SELECT;
}>;

export type NewRefreshToken = {
  readonly userId: string;
  readonly familyId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
};

function expiredTokensOf(
  userId: string,
  now: Date,
): Prisma.RefreshTokenWhereInput {
  return { userId, expiresAt: { lte: now } };
}

/** The only place that touches `prisma.refreshToken`; stores token hashes, never raw tokens. */
@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: REFRESH_TOKEN_SELECT,
    });
  }

  async createForNewFamily(token: NewRefreshToken, now: Date): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.refreshToken.create({ data: token }),
      this.prisma.refreshToken.deleteMany({
        where: expiredTokensOf(token.userId, now),
      }),
    ]);
  }

  /** Returns `false` when another request rotated or revoked `current` first. */
  rotate(
    current: RefreshTokenRecord,
    next: NewRefreshToken,
    now: Date,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.refreshToken.updateMany({
        where: { id: current.id, rotatedAt: null, revokedAt: null },
        data: { rotatedAt: now },
      });
      if (count === 0) {
        return false;
      }
      await tx.refreshToken.create({ data: next });
      await tx.refreshToken.deleteMany({
        where: expiredTokensOf(current.userId, now),
      });
      return true;
    });
  }

  async revokeFamily(familyId: string, now: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: now },
    });
  }
}
