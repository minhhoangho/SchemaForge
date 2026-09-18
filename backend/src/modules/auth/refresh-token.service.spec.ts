import { createHash } from "node:crypto";

import { Logger } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Clock } from "../../common/clock.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { RefreshTokenRepository } from "./refresh-token.repository.js";
import { RefreshTokenService } from "./refresh-token.service.js";
import { TokenGenerator } from "./token-generator.js";

const NOW = new Date("2026-09-18T10:00:00.000Z");
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const USER_ID = "0190f3a0-0000-7000-8000-000000000001";
const FAMILY_ID = "0190f3a0-0000-7000-8000-0000000000f1";
// Stand-ins for random refresh token values, obviously not real ones.
const FIRST_RAW = "raw-value-1";
const SECOND_RAW = "raw-value-2";

type StoredRow = {
  readonly id: string;
  readonly userId: string;
  readonly familyId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
};

type WhereValue = string | Date | null | { readonly lte: Date };

function matchesValue(actual: unknown, expected: WhereValue): boolean {
  if (expected instanceof Date) {
    return actual instanceof Date && actual.getTime() === expected.getTime();
  }
  if (expected !== null && typeof expected === "object") {
    return actual instanceof Date && actual <= expected.lte;
  }
  return actual === expected;
}

function matchesWhere(
  row: StoredRow,
  where: Readonly<Record<string, WhereValue>>,
): boolean {
  return Object.entries(where).every(([key, expected]) =>
    matchesValue(
      Object.entries(row).find(([name]) => name === key)?.[1],
      expected,
    ),
  );
}

/** In-memory stand-in for `prisma.refreshToken`, enough for the repository's queries. */
class InMemoryRefreshTokens {
  readonly rows: StoredRow[] = [];

  readonly findUnique = vi.fn(({ where }: { where: { tokenHash: string } }) => {
    const row = this.rows.find(
      (stored) => stored.tokenHash === where.tokenHash,
    );
    return Promise.resolve(row === undefined ? null : { ...row });
  });

  readonly create = vi.fn(
    ({ data }: { data: Omit<StoredRow, "id" | "rotatedAt" | "revokedAt"> }) => {
      const row = {
        ...data,
        id: `row-${String(this.rows.length + 1)}`,
        rotatedAt: null,
        revokedAt: null,
      };
      this.rows.push(row);
      return Promise.resolve(row);
    },
  );

  readonly updateMany = vi.fn(
    ({
      where,
      data,
    }: {
      where: Record<string, WhereValue>;
      data: Partial<Pick<StoredRow, "rotatedAt" | "revokedAt">>;
    }) => {
      const matching = this.rows.filter((row) => matchesWhere(row, where));
      for (const row of matching) {
        Object.assign(row, data);
      }
      return Promise.resolve({ count: matching.length });
    },
  );

  readonly deleteMany = vi.fn(
    ({ where }: { where: Record<string, WhereValue> }) => {
      const kept = this.rows.filter((row) => !matchesWhere(row, where));
      const count = this.rows.length - kept.length;
      this.rows.splice(0, this.rows.length, ...kept);
      return Promise.resolve({ count });
    },
  );
}

type FakeClient = {
  readonly refreshToken: InMemoryRefreshTokens;
  readonly $transaction: (argument: unknown) => Promise<unknown>;
};

function isTransactionCallback(
  value: unknown,
): value is (client: FakeClient) => Promise<unknown> {
  return typeof value === "function";
}

function createFakePrisma(): {
  readonly refreshToken: InMemoryRefreshTokens;
  readonly $transaction: (argument: unknown) => Promise<unknown>;
} {
  const refreshToken = new InMemoryRefreshTokens();
  const client: FakeClient = {
    refreshToken,
    $transaction: (argument: unknown): Promise<unknown> =>
      isTransactionCallback(argument)
        ? argument(client)
        : Promise.all(Array.isArray(argument) ? argument : []),
  };
  return client;
}

class MutableClock extends Clock {
  current = NOW;

  override now(): Date {
    return this.current;
  }
}

class SequenceTokenGenerator extends TokenGenerator {
  readonly refreshTokens = [FIRST_RAW, SECOND_RAW];

  override generateRefreshToken(): string {
    return this.refreshTokens.shift() ?? "raw-exhausted";
  }

  override generateFamilyId(): string {
    return FAMILY_ID;
  }
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

describe("RefreshTokenService", () => {
  let prisma: ReturnType<typeof createFakePrisma>;
  let clock: MutableClock;
  let service: RefreshTokenService;

  beforeEach(async () => {
    prisma = createFakePrisma();
    clock = new MutableClock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        RefreshTokenService,
        RefreshTokenRepository,
        { provide: PrismaService, useValue: prisma },
        { provide: Clock, useValue: clock },
        { provide: TokenGenerator, useClass: SequenceTokenGenerator },
      ],
    }).compile();
    service = moduleRef.get(RefreshTokenService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("issues a token in a new family that expires in 30 days", async () => {
    const issued = await service.issueForNewSession(USER_ID);

    const expiresAt = new Date(NOW.getTime() + THIRTY_DAYS_MS);
    expect(issued).toEqual({ token: FIRST_RAW, expiresAt });
    expect(prisma.refreshToken.rows).toEqual([
      expect.objectContaining({
        userId: USER_ID,
        familyId: FAMILY_ID,
        expiresAt,
      }),
    ]);
  });

  it("stores only the sha256 hash of the token", async () => {
    await service.issueForNewSession(USER_ID);

    expect(prisma.refreshToken.rows[0]?.tokenHash).toBe(sha256Hex(FIRST_RAW));
    expect(Object.values(prisma.refreshToken.rows[0] ?? {})).not.toContain(
      FIRST_RAW,
    );
  });

  it("rotates a valid token into the same family", async () => {
    await service.issueForNewSession(USER_ID);
    clock.current = new Date(NOW.getTime() + 60_000);

    const rotation = await service.rotate(FIRST_RAW);

    expect(rotation).toEqual({
      kind: "rotated",
      userId: USER_ID,
      refreshToken: {
        token: SECOND_RAW,
        expiresAt: new Date(clock.current.getTime() + THIRTY_DAYS_MS),
      },
    });
    expect(prisma.refreshToken.rows).toEqual([
      expect.objectContaining({
        familyId: FAMILY_ID,
        rotatedAt: clock.current,
      }),
      expect.objectContaining({
        familyId: FAMILY_ID,
        tokenHash: sha256Hex(SECOND_RAW),
        rotatedAt: null,
      }),
    ]);
  });

  it("rejects an unknown token", async () => {
    await expect(service.rotate("raw-unknown")).resolves.toEqual({
      kind: "rejected",
    });
  });

  it("rejects a revoked token", async () => {
    await service.issueForNewSession(USER_ID);
    await service.revokeFamilyOf(FIRST_RAW);

    await expect(service.rotate(FIRST_RAW)).resolves.toEqual({
      kind: "rejected",
    });
  });

  it("rejects an expired token", async () => {
    await service.issueForNewSession(USER_ID);
    clock.current = new Date(NOW.getTime() + THIRTY_DAYS_MS);

    await expect(service.rotate(FIRST_RAW)).resolves.toEqual({
      kind: "rejected",
    });
  });

  it("revokes the family when a rotated token is reused", async () => {
    await service.issueForNewSession(USER_ID);
    await service.rotate(FIRST_RAW);

    const reuse = await service.rotate(FIRST_RAW);

    expect(reuse).toEqual({ kind: "rejected" });
    expect(prisma.refreshToken.rows).toEqual([
      expect.objectContaining({ revokedAt: NOW }),
      expect.objectContaining({ revokedAt: NOW }),
    ]);
  });

  it("logs the user id and family id but not the token when reuse is detected", async () => {
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {
      // Silenced: the test only inspects the message.
    });
    await service.issueForNewSession(USER_ID);
    await service.rotate(FIRST_RAW);

    await service.rotate(FIRST_RAW);

    const message = String(warn.mock.calls[0]?.[0]);
    expect(message).toContain(USER_ID);
    expect(message).toContain(FAMILY_ID);
    expect(message).not.toContain(FIRST_RAW);
    expect(message).not.toContain(sha256Hex(FIRST_RAW));
  });

  it("revokes the family when a concurrent rotation already won", async () => {
    await service.issueForNewSession(USER_ID);
    prisma.refreshToken.updateMany.mockResolvedValueOnce({ count: 0 });

    const rotation = await service.rotate(FIRST_RAW);

    expect(rotation).toEqual({ kind: "rejected" });
    expect(prisma.refreshToken.rows).toEqual([
      expect.objectContaining({ revokedAt: NOW }),
    ]);
  });

  it("revokes the family of a known token on sign-out", async () => {
    await service.issueForNewSession(USER_ID);

    await service.revokeFamilyOf(FIRST_RAW);

    expect(prisma.refreshToken.rows).toEqual([
      expect.objectContaining({ revokedAt: NOW }),
    ]);
  });

  it("does nothing on sign-out for an unknown token", async () => {
    await service.revokeFamilyOf("raw-unknown");

    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });
});
