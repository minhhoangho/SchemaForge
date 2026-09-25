import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_PIPE } from "@nestjs/core";

import { ApiExceptionFilter } from "./common/api-exception.filter.js";
import { ClockModule } from "./common/clock.module.js";
import { JwtAuthGuard } from "./common/jwt-auth.guard.js";
import { OriginGuard } from "./common/origin.guard.js";
import { createValidationPipe } from "./common/validation.pipe.js";
import { validate } from "./config/env.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { RateLimitGuard } from "./modules/rate-limit/rate-limit.guard.js";
import { RateLimitModule } from "./modules/rate-limit/rate-limit.module.js";
import { SchemasModule } from "./modules/schemas/schemas.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    ClockModule,
    PrismaModule,
    HealthModule,
    RateLimitModule,
    AuthModule,
    SchemasModule,
  ],
  providers: [
    // Guards run in registration order (spec section 8): OriginGuard, then
    // JwtAuthGuard, then RateLimitGuard.
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_PIPE, useFactory: createValidationPipe },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}
