import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule, type JwtModuleOptions } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";

import type { Env } from "../../config/env.js";
import { PrismaModule } from "../../prisma/prisma.module.js";
import { AccessTokenService } from "./access-token.service.js";
import { AuthCookies } from "./auth-cookies.js";
import { AuthController } from "./auth.controller.js";
import { AuthService, COMMON_PASSWORDS } from "./auth.service.js";
import { JwtStrategy } from "./jwt.strategy.js";
import { Argon2PasswordHasher, PasswordHasher } from "./password-hasher.js";
import { loadCommonPasswords } from "./password.policy.js";
import { RefreshTokenRepository } from "./refresh-token.repository.js";
import { RefreshTokenService } from "./refresh-token.service.js";
import { CryptoTokenGenerator, TokenGenerator } from "./token-generator.js";
import { UsersRepository } from "./users.repository.js";

function createJwtOptions(config: ConfigService<Env, true>): JwtModuleOptions {
  return {
    secret: config.get("JWT_ACCESS_SECRET", { infer: true }),
    signOptions: { algorithm: "HS256" },
    verifyOptions: { algorithms: ["HS256"] },
  };
}

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: createJwtOptions,
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    UsersRepository,
    AccessTokenService,
    RefreshTokenService,
    RefreshTokenRepository,
    AuthCookies,
    JwtStrategy,
    { provide: PasswordHasher, useClass: Argon2PasswordHasher },
    { provide: TokenGenerator, useClass: CryptoTokenGenerator },
    { provide: COMMON_PASSWORDS, useFactory: loadCommonPasswords },
  ],
})
export class AuthModule {}
