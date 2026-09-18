import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { API_ERROR_STATUS } from "@schemaforge/api-contract";
import type { Request } from "express";

import type { Env } from "../config/env.js";
import { ApiException } from "./api.exception.js";

const SAFE_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defense next to `SameSite=Strict` cookies (spec section 1): every
 * state-changing request, public routes included, must come from a configured origin.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowedOrigins: readonly string[];

  constructor(config: ConfigService<Env, true>) {
    this.allowedOrigins = config.get("CORS_ORIGINS", { infer: true });
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) {
      return true;
    }
    const origin = request.headers.origin;
    if (origin !== undefined && this.allowedOrigins.includes(origin)) {
      return true;
    }
    throw new ApiException({
      statusCode: API_ERROR_STATUS["origin-not-allowed"],
      code: "origin-not-allowed",
    });
  }
}
