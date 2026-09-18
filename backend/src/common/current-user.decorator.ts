import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import { API_ERROR_STATUS } from "@schemaforge/api-contract";
import type { Request } from "express";

import { ApiException } from "./api.exception.js";

export type AuthenticatedUser = { readonly userId: string };

export function isAuthenticatedUser(
  value: unknown,
): value is AuthenticatedUser {
  return (
    typeof value === "object" &&
    value !== null &&
    "userId" in value &&
    typeof value.userId === "string"
  );
}

/** Reads `request.user`, which the authentication strategy sets; unknown to express types. */
export function readRequestUser(request: Request): AuthenticatedUser | null {
  if (!("user" in request)) {
    return null;
  }
  const user: unknown = request.user;
  return isAuthenticatedUser(user) ? user : null;
}

/** Only fails when a private route runs without the authentication guard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const user = readRequestUser(context.switchToHttp().getRequest<Request>());
    if (user === null) {
      throw new ApiException({
        statusCode: API_ERROR_STATUS.unauthenticated,
        code: "unauthenticated",
      });
    }
    return user;
  },
);
