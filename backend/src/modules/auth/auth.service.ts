import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import {
  API_ERROR_STATUS,
  type LoginRequest,
  type RegisterRequest,
  type UserResponse,
} from "@schemaforge/api-contract";

import { ApiException } from "../../common/api.exception.js";
import { normalizeEmail } from "../../common/normalize-email.js";
import { AccessTokenService } from "./access-token.service.js";
import type { AuthTokens } from "./auth-cookies.js";
import { PasswordHasher } from "./password-hasher.js";
import {
  checkPassword,
  normalizePassword,
  type PasswordViolation,
} from "./password.policy.js";
import { RefreshTokenService } from "./refresh-token.service.js";
import { TokenGenerator } from "./token-generator.js";
import { toUserResponse } from "./users.mapper.js";
import { type UserRecord, UsersRepository } from "./users.repository.js";

export const COMMON_PASSWORDS = Symbol("COMMON_PASSWORDS");

export type AuthSession = {
  readonly user: UserResponse;
  readonly tokens: AuthTokens;
};

const PASSWORD_FIELD = "password";

function toPasswordException(violation: PasswordViolation): ApiException {
  switch (violation) {
    case "too-short":
      return new ApiException({
        statusCode: API_ERROR_STATUS["validation-failed"],
        code: "validation-failed",
        fields: [{ path: PASSWORD_FIELD, constraint: "minLength" }],
      });
    case "too-long":
      return new ApiException({
        statusCode: API_ERROR_STATUS["validation-failed"],
        code: "validation-failed",
        fields: [{ path: PASSWORD_FIELD, constraint: "maxLength" }],
      });
    case "too-common":
      return new ApiException({
        statusCode: API_ERROR_STATUS["password-too-common"],
        code: "password-too-common",
      });
    default: {
      const unhandled: never = violation;
      throw new Error(`Unhandled password violation: ${String(unhandled)}`);
    }
  }
}

function invalidCredentials(): ApiException {
  return new ApiException({
    statusCode: API_ERROR_STATUS["invalid-credentials"],
    code: "invalid-credentials",
  });
}

@Injectable()
export class AuthService implements OnModuleInit {
  // Set in onModuleInit, before the app accepts requests.
  private dummyPasswordHash = "";

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly accessTokenService: AccessTokenService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly tokenGenerator: TokenGenerator,
    @Inject(COMMON_PASSWORDS)
    private readonly commonPasswords: ReadonlySet<string>,
  ) {}

  /** A real hash of a random value, so an unknown email costs one verify too (spec section 2). */
  async onModuleInit(): Promise<void> {
    this.dummyPasswordHash = await this.passwordHasher.hash(
      this.tokenGenerator.generateRefreshToken(),
    );
  }

  async register(request: RegisterRequest): Promise<AuthSession> {
    const email = normalizeEmail(request.email);
    const checked = checkPassword(request.password, this.commonPasswords);
    if (!checked.isOk) {
      throw toPasswordException(checked.error);
    }
    const passwordHash = await this.passwordHasher.hash(checked.value);
    const user = await this.usersRepository.create({ email, passwordHash });
    return this.createSession(user);
  }

  /** Unknown email and wrong password give the same error after the same work. */
  async login(request: LoginRequest): Promise<AuthSession> {
    const email = normalizeEmail(request.email);
    const password = normalizePassword(request.password);
    const credentials =
      await this.usersRepository.findCredentialsByEmail(email);
    if (credentials === null) {
      await this.passwordHasher.verify(this.dummyPasswordHash, password);
      throw invalidCredentials();
    }
    const isValid = await this.passwordHasher.verify(
      credentials.passwordHash,
      password,
    );
    if (!isValid) {
      throw invalidCredentials();
    }
    return this.createSession(credentials);
  }

  /** `null` means the session expired; the caller clears the cookies. */
  async refresh(refreshToken: string | null): Promise<AuthTokens | null> {
    if (refreshToken === null) {
      return null;
    }
    const rotation = await this.refreshTokenService.rotate(refreshToken);
    if (rotation.kind === "rejected") {
      return null;
    }
    const accessToken = await this.accessTokenService.sign(rotation.userId);
    return { accessToken, refreshToken: rotation.refreshToken.token };
  }

  async logout(refreshToken: string | null): Promise<void> {
    if (refreshToken !== null) {
      await this.refreshTokenService.revokeFamilyOf(refreshToken);
    }
  }

  async getCurrentUser(userId: string): Promise<UserResponse> {
    const user = await this.usersRepository.findById(userId);
    if (user === null) {
      throw new ApiException({
        statusCode: API_ERROR_STATUS.unauthenticated,
        code: "unauthenticated",
      });
    }
    return toUserResponse(user);
  }

  private async createSession(user: UserRecord): Promise<AuthSession> {
    const [accessToken, refreshToken] = await Promise.all([
      this.accessTokenService.sign(user.id),
      this.refreshTokenService.issueForNewSession(user.id),
    ]);
    return {
      user: toUserResponse(user),
      tokens: { accessToken, refreshToken: refreshToken.token },
    };
  }
}
