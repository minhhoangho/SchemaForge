import { type ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { API_ERROR_STATUS } from "@schemaforge/api-contract";
import type { Observable } from "rxjs";

import { ApiException } from "./api.exception.js";
import {
  type AuthenticatedUser,
  isAuthenticatedUser,
} from "./current-user.decorator.js";
import { IS_PUBLIC_KEY } from "./public.decorator.js";

/** Global guard: every route is private unless marked `@Public()` (spec section 1). */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic === true) {
      return true;
    }
    return super.canActivate(context);
  }

  // `IAuthGuard.handleRequest` returns a caller-chosen `TUser`. The overload keeps
  // that public signature; the implementation only ever returns a checked
  // `AuthenticatedUser`, which Passport stores as `request.user`.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- mirrors the base signature, which a subclass must keep
  override handleRequest<TUser = AuthenticatedUser>(
    error: unknown,
    user: unknown,
  ): TUser;
  override handleRequest(error: unknown, user: unknown): AuthenticatedUser {
    if (error !== null && error !== undefined) {
      throw unauthenticated();
    }
    if (!isAuthenticatedUser(user)) {
      throw unauthenticated();
    }
    return user;
  }
}

function unauthenticated(): ApiException {
  return new ApiException({
    statusCode: API_ERROR_STATUS.unauthenticated,
    code: "unauthenticated",
  });
}
