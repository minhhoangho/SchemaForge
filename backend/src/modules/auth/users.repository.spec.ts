import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../prisma/prisma.service.js";
import { UsersRepository } from "./users.repository.js";

const USER_ID = "0190f3a0-0000-7000-8000-000000000001";
const EMAIL = "alice@example.com";
const CREATED_AT = new Date("2026-09-18T10:00:00.000Z");
// Stand-in for an argon2id PHC string, obviously not a real one.
const PASSWORD_HASH = "fake-hash";

function createFakePrisma(): {
  readonly user: {
    readonly create: ReturnType<typeof vi.fn>;
    readonly findUnique: ReturnType<typeof vi.fn>;
  };
} {
  return {
    user: {
      create: vi.fn().mockResolvedValue({
        id: USER_ID,
        email: EMAIL,
        createdAt: CREATED_AT,
      }),
      findUnique: vi.fn().mockResolvedValue(null),
    },
  };
}

describe("UsersRepository", () => {
  let prisma: ReturnType<typeof createFakePrisma>;
  let repository: UsersRepository;

  beforeEach(async () => {
    prisma = createFakePrisma();
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    repository = moduleRef.get(UsersRepository);
  });

  it("selects only id, email and createdAt when finding by id", async () => {
    await repository.findById(USER_ID);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: USER_ID },
      select: { id: true, email: true, createdAt: true },
    });
  });

  it("selects the password hash only when finding credentials by email", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: USER_ID,
      email: EMAIL,
      createdAt: CREATED_AT,
      passwordHash: PASSWORD_HASH,
    });

    const credentials = await repository.findCredentialsByEmail(EMAIL);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: EMAIL },
      select: { id: true, email: true, createdAt: true, passwordHash: true },
    });
    expect(credentials).toEqual({
      id: USER_ID,
      email: EMAIL,
      createdAt: CREATED_AT,
      passwordHash: PASSWORD_HASH,
    });
  });

  it("creates a user and selects only the public fields", async () => {
    const user = await repository.create({
      email: EMAIL,
      passwordHash: PASSWORD_HASH,
    });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { email: EMAIL, passwordHash: PASSWORD_HASH },
      select: { id: true, email: true, createdAt: true },
    });
    expect(user).toEqual({ id: USER_ID, email: EMAIL, createdAt: CREATED_AT });
  });
});
