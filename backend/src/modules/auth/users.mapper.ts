import type { UserResponse } from "@schemaforge/api-contract";

import type { UserRecord } from "./users.repository.js";

/** Builds a new object field by field so extra record fields never reach a response. */
export function toUserResponse(user: UserRecord): UserResponse {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}
