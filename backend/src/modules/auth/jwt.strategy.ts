import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { API_ERROR_STATUS } from "@schemaforge/api-contract";
import type { Request } from "express";
import { Strategy } from "passport-jwt";

import { ApiException } from "../../common/api.exception.js";
import type { AuthenticatedUser } from "../../common/current-user.decorator.js";
import type { Env } from "../../config/env.js";
import { ACCESS_TOKEN_COOKIE, readCookie } from "./auth-cookies.js";

function readSubject(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null || !("sub" in payload)) {
    return null;
  }
  const subject = payload.sub;
  return typeof subject === "string" && subject !== "" ? subject : null;
}

/**
 * Reads the access token from the `sf-access` cookie only, never from the
 * `Authorization` header, and trusts its subject without a database query (spec section 1).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(config: ConfigService<Env, true>) {
    super({
      jwtFromRequest: (request: Request) =>
        readCookie(request, ACCESS_TOKEN_COOKIE),
      secretOrKey: config.get("JWT_ACCESS_SECRET", { infer: true }),
      algorithms: ["HS256"],
      ignoreExpiration: false,
    });
  }

  validate(payload: unknown): AuthenticatedUser {
    const userId = readSubject(payload);
    if (userId === null) {
      throw new ApiException({
        statusCode: API_ERROR_STATUS.unauthenticated,
        code: "unauthenticated",
      });
    }
    return { userId };
  }
}
