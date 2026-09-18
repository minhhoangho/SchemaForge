import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_PIPE } from "@nestjs/core";

import { ApiExceptionFilter } from "./common/api-exception.filter.js";
import { ClockModule } from "./common/clock.module.js";
import { OriginGuard } from "./common/origin.guard.js";
import { createValidationPipe } from "./common/validation.pipe.js";
import { validate } from "./config/env.js";
import { HealthModule } from "./modules/health/health.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    ClockModule,
    PrismaModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_PIPE, useFactory: createValidationPipe },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    // Guards run in registration order: OriginGuard first (spec section 8).
    { provide: APP_GUARD, useClass: OriginGuard },
  ],
})
export class AppModule {}
