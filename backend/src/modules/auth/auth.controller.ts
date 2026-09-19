import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import {
  API_ERROR_STATUS,
  type AuthUserResponse,
} from "@schemaforge/api-contract";
import type { Request, Response } from "express";

import { ApiException } from "../../common/api.exception.js";
import {
  type AuthenticatedUser,
  CurrentUser,
} from "../../common/current-user.decorator.js";
import { Public } from "../../common/public.decorator.js";
import { RateLimit } from "../rate-limit/rate-limit.decorator.js";
import {
  AuthCookies,
  readCookie,
  REFRESH_TOKEN_COOKIE,
} from "./auth-cookies.js";
import { AuthService } from "./auth.service.js";
import { LoginDto } from "./dto/login.dto.js";
import { RegisterDto } from "./dto/register.dto.js";

/** Each handler calls one `AuthService` method; cookies are the HTTP layer's job (nestjs.md). */
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authCookies: AuthCookies,
  ) {}

  @Public()
  @RateLimit("register")
  @Post("register")
  @HttpCode(201)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthUserResponse> {
    const session = await this.authService.register(dto);
    this.authCookies.set(response, session.tokens);
    return { user: session.user };
  }

  @Public()
  @RateLimit("login")
  @Post("login")
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthUserResponse> {
    const session = await this.authService.login(dto);
    this.authCookies.set(response, session.tokens);
    return { user: session.user };
  }

  @Public()
  @RateLimit("refresh")
  @Post("refresh")
  @HttpCode(204)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const tokens = await this.authService.refresh(
      readCookie(request, REFRESH_TOKEN_COOKIE),
    );
    if (tokens === null) {
      this.authCookies.clear(response);
      throw new ApiException({
        statusCode: API_ERROR_STATUS["session-expired"],
        code: "session-expired",
      });
    }
    this.authCookies.set(response, tokens);
  }

  @Public()
  @Post("logout")
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(readCookie(request, REFRESH_TOKEN_COOKIE));
    this.authCookies.clear(response);
  }

  @Get("me")
  async me(@CurrentUser() user: AuthenticatedUser): Promise<AuthUserResponse> {
    return { user: await this.authService.getCurrentUser(user.userId) };
  }
}
