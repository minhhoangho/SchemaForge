import { JwtModule, JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiException } from "../../common/api.exception.js";
import { Clock } from "../../common/clock.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { AccessTokenService } from "./access-token.service.js";
import { AuthService, COMMON_PASSWORDS } from "./auth.service.js";
import { PasswordHasher } from "./password-hasher.js";
import { RefreshTokenRepository } from "./refresh-token.repository.js";
import { RefreshTokenService } from "./refresh-token.service.js";
import { TokenGenerator } from "./token-generator.js";
import { UsersRepository } from "./users.repository.js";

// Obviously fake signing key, 32 characters long like the env schema requires.
const SIGNING_KEY = "k".repeat(32);
const NOW = new Date("2026-09-18T10:00:00.000Z");
const USER_ID = "0190f3a0-0000-7000-8000-000000000001";
const FAMILY_ID = "0190f3a0-0000-7000-8000-0000000000f1";
const EMAIL = "alice@example.com";
// Fixture passwords, never real credentials.
const PASSPHRASE = "fixture-passphrase";
const WRONG_PASSPHRASE = "another-passphrase";
const COMMON_ENTRY = "password123";
// The same passphrase typed with a combining accent and with a precomposed letter.
const DECOMPOSED_PASSPHRASE = "cafe\u0301-passphrase";
const COMPOSED_PASSPHRASE = "caf\u00e9-passphrase";
const DUMMY_SOURCE = "random-1";
const FAKE_HASH_PREFIX = "fake-hash:";

type StoredUser = {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly createdAt: Date;
};

type StoredToken = {
  readonly id: string;
  readonly userId: string;
  readonly familyId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
};

type UserWhere = { readonly id?: string; readonly email?: string };

function matchesUser(user: StoredUser, where: UserWhere): boolean {
  return (
    (where.id === undefined || user.id === where.id) &&
    (where.email === undefined || user.email === where.email)
  );
}

function isTransactionCallback(
  value: unknown,
): value is (client: unknown) => Promise<unknown> {
  return typeof value === "function";
}

function bodyOf(error: unknown): unknown {
  return error instanceof ApiException ? error.body : null;
}

/** In-memory stand-in for the `user` and `refreshToken` delegates the auth flow uses. */
function createFakePrisma(): {
  readonly users: StoredUser[];
  readonly tokens: StoredToken[];
  readonly user: {
    readonly create: ReturnType<typeof vi.fn>;
    readonly findUnique: ReturnType<typeof vi.fn>;
  };
  readonly refreshToken: Record<string, ReturnType<typeof vi.fn>>;
  readonly $transaction: ReturnType<typeof vi.fn>;
} {
  const users: StoredUser[] = [];
  const tokens: StoredToken[] = [];
  const refreshToken = {
    findUnique: vi.fn(({ where }: { where: { tokenHash: string } }) =>
      Promise.resolve(
        tokens.find((token) => token.tokenHash === where.tokenHash) ?? null,
      ),
    ),
    create: vi.fn(
      ({
        data,
      }: {
        data: Omit<StoredToken, "id" | "rotatedAt" | "revokedAt">;
      }) => {
        const token = {
          ...data,
          id: `token-${String(tokens.length + 1)}`,
          rotatedAt: null,
          revokedAt: null,
        };
        tokens.push(token);
        return Promise.resolve(token);
      },
    ),
    updateMany: vi.fn(
      ({
        where,
        data,
      }: {
        where: { id?: string; familyId?: string };
        data: Partial<Pick<StoredToken, "rotatedAt" | "revokedAt">>;
      }) => {
        const matching = tokens.filter(
          (token) =>
            (where.id === undefined || token.id === where.id) &&
            (where.familyId === undefined || token.familyId === where.familyId),
        );
        matching.forEach((token) => Object.assign(token, data));
        return Promise.resolve({ count: matching.length });
      },
    ),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  };
  const client = {
    users,
    tokens,
    user: {
      create: vi.fn(
        ({ data }: { data: { email: string; passwordHash: string } }) => {
          const user = { ...data, id: USER_ID, createdAt: NOW };
          users.push(user);
          return Promise.resolve({
            id: user.id,
            email: user.email,
            createdAt: user.createdAt,
          });
        },
      ),
      findUnique: vi.fn(({ where }: { where: UserWhere }) =>
        Promise.resolve(users.find((user) => matchesUser(user, where)) ?? null),
      ),
    },
    refreshToken,
    $transaction: vi.fn((argument: unknown): Promise<unknown> =>
      isTransactionCallback(argument)
        ? argument(client)
        : Promise.all(Array.isArray(argument) ? argument : []),
    ),
  };
  return client;
}

class FakePasswordHasher extends PasswordHasher {
  readonly hash = vi.fn((password: string) =>
    Promise.resolve(`${FAKE_HASH_PREFIX}${password}`),
  );

  readonly verify = vi.fn((passwordHash: string, password: string) =>
    Promise.resolve(passwordHash === `${FAKE_HASH_PREFIX}${password}`),
  );
}

class CountingTokenGenerator extends TokenGenerator {
  private count = 0;

  override generateRefreshToken(): string {
    this.count += 1;
    return `random-${String(this.count)}`;
  }

  override generateFamilyId(): string {
    return FAMILY_ID;
  }
}

class FixedClock extends Clock {
  override now(): Date {
    return NOW;
  }
}

describe("AuthService", () => {
  let prisma: ReturnType<typeof createFakePrisma>;
  let hasher: FakePasswordHasher;
  let service: AuthService;
  let jwtService: JwtService;

  beforeEach(async () => {
    prisma = createFakePrisma();
    hasher = new FakePasswordHasher();
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: SIGNING_KEY })],
      providers: [
        AuthService,
        UsersRepository,
        AccessTokenService,
        RefreshTokenService,
        RefreshTokenRepository,
        { provide: PrismaService, useValue: prisma },
        { provide: PasswordHasher, useValue: hasher },
        { provide: TokenGenerator, useClass: CountingTokenGenerator },
        { provide: Clock, useClass: FixedClock },
        { provide: COMMON_PASSWORDS, useValue: new Set([COMMON_ENTRY]) },
      ],
    }).compile();
    await moduleRef.init();
    service = moduleRef.get(AuthService);
    jwtService = moduleRef.get(JwtService);
  });

  async function subjectOf(accessToken: string): Promise<unknown> {
    const payload: unknown = await jwtService.verifyAsync(accessToken, {
      algorithms: ["HS256"],
      ignoreExpiration: true,
    });
    return typeof payload === "object" && payload !== null && "sub" in payload
      ? payload.sub
      : null;
  }

  function register(): ReturnType<AuthService["register"]> {
    return service.register({ email: EMAIL, password: PASSPHRASE });
  }

  it("creates a dummy password hash on module init", () => {
    expect(hasher.hash).toHaveBeenCalledExactlyOnceWith(DUMMY_SOURCE);
  });

  describe("register", () => {
    it("normalizes the email before creating the user", async () => {
      await service.register({
        email: "  Alice@Example.COM ",
        password: PASSPHRASE,
      });

      expect(prisma.users).toEqual([expect.objectContaining({ email: EMAIL })]);
    });

    it("hashes the NFKC-normalized password", async () => {
      await service.register({
        email: EMAIL,
        password: DECOMPOSED_PASSPHRASE,
      });

      expect(prisma.users).toEqual([
        expect.objectContaining({
          passwordHash: `${FAKE_HASH_PREFIX}${COMPOSED_PASSPHRASE}`,
        }),
      ]);
    });

    it("rejects a common password with password-too-common", async () => {
      await expect(
        service.register({ email: EMAIL, password: "Password123" }),
      ).rejects.toMatchObject({
        body: { statusCode: 400, code: "password-too-common" },
      });
      expect(prisma.users).toEqual([]);
    });

    it("rejects a password too short after normalization with a minLength field error", async () => {
      // Eight UTF-16 units that NFKC composes into four code points.
      const password = "e\u0301".repeat(4);

      await expect(
        service.register({ email: EMAIL, password }),
      ).rejects.toMatchObject({
        body: {
          statusCode: 400,
          code: "validation-failed",
          fields: [{ path: "password", constraint: "minLength" }],
        },
      });
    });

    it("rejects a password too long with a maxLength field error", async () => {
      await expect(
        service.register({ email: EMAIL, password: "p".repeat(129) }),
      ).rejects.toMatchObject({
        body: {
          statusCode: 400,
          code: "validation-failed",
          fields: [{ path: "password", constraint: "maxLength" }],
        },
      });
    });

    it("returns the user response and a token pair after registering", async () => {
      const session = await register();

      expect(session.user).toEqual({
        id: USER_ID,
        email: EMAIL,
        createdAt: NOW.toISOString(),
      });
      expect(session.tokens.refreshToken).toBe("random-2");
      await expect(subjectOf(session.tokens.accessToken)).resolves.toBe(
        USER_ID,
      );
    });
  });

  describe("login", () => {
    it("rejects an unknown email with invalid-credentials", async () => {
      await expect(
        service.login({ email: EMAIL, password: PASSPHRASE }),
      ).rejects.toMatchObject({
        body: { statusCode: 401, code: "invalid-credentials" },
      });
    });

    it("verifies against the dummy hash when the email is unknown", async () => {
      await service
        .login({ email: EMAIL, password: PASSPHRASE })
        .catch(() => undefined);

      expect(hasher.verify).toHaveBeenCalledExactlyOnceWith(
        `${FAKE_HASH_PREFIX}${DUMMY_SOURCE}`,
        PASSPHRASE,
      );
    });

    it("rejects a wrong password with the same error body as an unknown email", async () => {
      const unknownEmail = await service
        .login({ email: "bob@example.com", password: PASSPHRASE })
        .catch((error: unknown) => error);
      await register();

      const wrongPassword = await service
        .login({ email: EMAIL, password: WRONG_PASSPHRASE })
        .catch((error: unknown) => error);

      expect(bodyOf(wrongPassword)).toEqual({
        statusCode: 401,
        code: "invalid-credentials",
      });
      expect(bodyOf(wrongPassword)).toEqual(bodyOf(unknownEmail));
    });

    it("verifies the NFKC-normalized password on sign-in", async () => {
      await service.register({
        email: EMAIL,
        password: COMPOSED_PASSPHRASE,
      });

      await service.login({ email: EMAIL, password: DECOMPOSED_PASSPHRASE });

      expect(hasher.verify).toHaveBeenLastCalledWith(
        `${FAKE_HASH_PREFIX}${COMPOSED_PASSPHRASE}`,
        COMPOSED_PASSPHRASE,
      );
    });

    it("returns the user response and a token pair after signing in", async () => {
      await register();

      const session = await service.login({
        email: " ALICE@example.com",
        password: PASSPHRASE,
      });

      expect(session.user).toEqual({
        id: USER_ID,
        email: EMAIL,
        createdAt: NOW.toISOString(),
      });
      expect(session.tokens.refreshToken).toBe("random-3");
      await expect(subjectOf(session.tokens.accessToken)).resolves.toBe(
        USER_ID,
      );
    });
  });

  describe("refresh", () => {
    it("returns null when refreshing without a token", async () => {
      await expect(service.refresh(null)).resolves.toBeNull();
      expect(prisma.refreshToken.findUnique).not.toHaveBeenCalled();
    });

    it("returns null when the rotation is rejected", async () => {
      await expect(service.refresh("unknown-value")).resolves.toBeNull();
    });

    it("signs a new access token for the user of a rotated token", async () => {
      const session = await register();

      const tokens = await service.refresh(session.tokens.refreshToken);

      expect(tokens?.refreshToken).toBe("random-3");
      await expect(subjectOf(tokens?.accessToken ?? "")).resolves.toBe(USER_ID);
    });
  });

  describe("logout", () => {
    it("revokes the token family on sign-out", async () => {
      const session = await register();

      await service.logout(session.tokens.refreshToken);

      expect(prisma.tokens).toEqual([
        expect.objectContaining({ familyId: FAMILY_ID, revokedAt: NOW }),
      ]);
    });

    it("does nothing on sign-out without a token", async () => {
      await service.logout(null);

      expect(prisma.refreshToken.findUnique).not.toHaveBeenCalled();
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });
  });

  describe("getCurrentUser", () => {
    it("returns the current user", async () => {
      await register();

      await expect(service.getCurrentUser(USER_ID)).resolves.toEqual({
        id: USER_ID,
        email: EMAIL,
        createdAt: NOW.toISOString(),
      });
    });

    it("rejects a current user that no longer exists with unauthenticated", async () => {
      await expect(service.getCurrentUser(USER_ID)).rejects.toMatchObject({
        body: { statusCode: 401, code: "unauthenticated" },
      });
    });
  });
});
