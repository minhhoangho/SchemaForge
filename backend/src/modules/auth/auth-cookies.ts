import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CookieOptions, Request, Response } from "express";

import type { Env } from "../../config/env.js";
import { ACCESS_TOKEN_TTL_SECONDS } from "./access-token.service.js";
import { REFRESH_TOKEN_TTL_SECONDS } from "./refresh-token.service.js";

export const ACCESS_TOKEN_COOKIE = "sf-access";
export const REFRESH_TOKEN_COOKIE = "sf-refresh";

export type AuthTokens = {
  readonly accessToken: string;
  readonly refreshToken: string;
};

const MILLISECONDS_PER_SECOND = 1000;
const ACCESS_TOKEN_PATH = "/";
// The refresh token only travels with requests to the auth routes (spec section 1).
const REFRESH_TOKEN_PATH = "/auth";

/** Reads a cookie parsed by `cookie-parser`; `null` when it is missing or empty. */
export function readCookie(request: Request, name: string): string | null {
  // `cookie-parser` types `request.cookies` as `any`.
  const value: unknown = request.cookies[name];
  return typeof value === "string" && value !== "" ? value : null;
}

/**
 * Sets and clears the token cookies after the auth service call (nestjs.md).
 * Never sets `Domain`, so the cookies go back only to the backend host.
 */
@Injectable()
export class AuthCookies {
  private readonly isSecure: boolean;

  constructor(config: ConfigService<Env, true>) {
    this.isSecure = config.get("AUTH_COOKIE_SECURE", { infer: true });
  }

  set(response: Response, tokens: AuthTokens): void {
    response.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
      ...this.baseOptions(ACCESS_TOKEN_PATH),
      maxAge: ACCESS_TOKEN_TTL_SECONDS * MILLISECONDS_PER_SECOND,
    });
    response.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      ...this.baseOptions(REFRESH_TOKEN_PATH),
      maxAge: REFRESH_TOKEN_TTL_SECONDS * MILLISECONDS_PER_SECOND,
    });
  }

  clear(response: Response): void {
    response.clearCookie(
      ACCESS_TOKEN_COOKIE,
      this.baseOptions(ACCESS_TOKEN_PATH),
    );
    response.clearCookie(
      REFRESH_TOKEN_COOKIE,
      this.baseOptions(REFRESH_TOKEN_PATH),
    );
  }

  private baseOptions(path: string): CookieOptions {
    return { httpOnly: true, secure: this.isSecure, sameSite: "strict", path };
  }
}
