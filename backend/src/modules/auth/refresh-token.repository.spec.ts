import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../prisma/prisma.service.js";
import {
  type NewRefreshToken,
  type RefreshTokenRecord,
  RefreshTokenRepository,
} from "./refresh-token.repository.js";

const NOW = new Date("2026-09-18T10:00:00.000Z");
const LATER = new Date("2026-10-18T10:00:00.000Z");
const USER_ID = "0190f3a0-0000-7000-8000-000000000001";
const FAMILY_ID = "0190f3a0-0000-7000-8000-0000000000f1";

function createFakeDelegate(): {
  readonly create: ReturnType<typeof vi.fn>;
  readonly deleteMany: ReturnType<typeof vi.fn>;
  readonly updateMany: ReturnType<typeof vi.fn>;
  readonly findUnique: ReturnType<typeof vi.fn>;
} {
  return {
    create: vi.fn().mockReturnValue("create-operation"),
    deleteMany: vi.fn().mockReturnValue("delete-operation"),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    findUnique: vi.fn().mockResolvedValue(null),
  };
}

type FakeTransactionClient = {
  readonly refreshToken: ReturnType<typeof createFakeDelegate>;
};

function isTransactionCallback(
  value: unknown,
): value is (client: FakeTransactionClient) => Promise<unknown> {
  return typeof value === "function";
}

function createFakePrisma(): {
  readonly refreshToken: ReturnType<typeof createFakeDelegate>;
  readonly transactionClient: FakeTransactionClient;
  readonly $transaction: ReturnType<typeof vi.fn>;
} {
  const transactionClient: FakeTransactionClient = {
    refreshToken: createFakeDelegate(),
  };
  return {
    refreshToken: createFakeDelegate(),
    transactionClient,
    $transaction: vi.fn((argument: unknown) =>
      isTransactionCallback(argument)
        ? argument(transactionClient)
        : Promise.resolve(argument),
    ),
  };
}

function makeRecord(
  overrides: Partial<RefreshTokenRecord> = {},
): RefreshTokenRecord {
  return {
    id: "0190f3a0-0000-7000-8000-0000000000a1",
    userId: USER_ID,
    familyId: FAMILY_ID,
    expiresAt: LATER,
    rotatedAt: null,
    revokedAt: null,
    ...overrides,
  };
}

function makeNewToken(
  overrides: Partial<NewRefreshToken> = {},
): NewRefreshToken {
  return {
    userId: USER_ID,
    familyId: FAMILY_ID,
    tokenHash: "a".repeat(64),
    expiresAt: LATER,
    ...overrides,
  };
}

describe("RefreshTokenRepository", () => {
  let prisma: ReturnType<typeof createFakePrisma>;
  let repository: RefreshTokenRepository;

  beforeEach(async () => {
    prisma = createFakePrisma();
    const moduleRef = await Test.createTestingModule({
      providers: [
        RefreshTokenRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    repository = moduleRef.get(RefreshTokenRepository);
  });

  it("creates a token and deletes expired tokens of the same user in one transaction", async () => {
    const token = makeNewToken();

    await repository.createForNewFamily(token, NOW);

    expect(prisma.refreshToken.create).toHaveBeenCalledWith({ data: token });
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, expiresAt: { lte: NOW } },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith([
      "create-operation",
      "delete-operation",
    ]);
  });

  it("marks the current token rotated only when it is neither rotated nor revoked", async () => {
    const current = makeRecord();

    await repository.rotate(current, makeNewToken(), NOW);

    expect(
      prisma.transactionClient.refreshToken.updateMany,
    ).toHaveBeenCalledWith({
      where: { id: current.id, rotatedAt: null, revokedAt: null },
      data: { rotatedAt: NOW },
    });
  });

  it("returns false and creates nothing when the conditional update changes no row", async () => {
    const tx = prisma.transactionClient.refreshToken;
    tx.updateMany.mockResolvedValueOnce({ count: 0 });

    const isRotated = await repository.rotate(
      makeRecord(),
      makeNewToken(),
      NOW,
    );

    expect(isRotated).toBe(false);
    expect(tx.create).not.toHaveBeenCalled();
    expect(tx.deleteMany).not.toHaveBeenCalled();
  });

  it("creates the next token and deletes expired tokens when rotation succeeds", async () => {
    const tx = prisma.transactionClient.refreshToken;
    const next = makeNewToken({ tokenHash: "b".repeat(64) });

    const isRotated = await repository.rotate(makeRecord(), next, NOW);

    expect(isRotated).toBe(true);
    expect(tx.create).toHaveBeenCalledWith({ data: next });
    expect(tx.deleteMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, expiresAt: { lte: NOW } },
    });
  });

  it("revokes every unrevoked token of a family", async () => {
    await repository.revokeFamily(FAMILY_ID, NOW);

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId: FAMILY_ID, revokedAt: null },
      data: { revokedAt: NOW },
    });
  });
});
