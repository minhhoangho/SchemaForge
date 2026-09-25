import { authUserResponseSchema } from "@schemaforge/api-contract";

import type { HttpClient } from "./http-client.js";

/** Long enough for the policy and absent from `common-passwords.txt`. */
export const TEST_PASSWORD = "maple-orbit-lantern-42";

const REGISTERED_STATUS = 201;

export function testEmail(label: string): string {
  return `${label}@example.com`;
}

export type RegisteredUser = {
  readonly userId: string;
  readonly email: string;
};

export async function registerUser(
  client: HttpClient,
  label: string,
): Promise<RegisteredUser> {
  const email = testEmail(label);
  const response = await client.request("POST", "/auth/register", {
    body: { email, password: TEST_PASSWORD },
  });
  if (response.status !== REGISTERED_STATUS) {
    throw new Error(
      `Registering ${email} answered ${String(response.status)} instead of ${String(REGISTERED_STATUS)}`,
    );
  }
  const body: unknown = response.body;
  return { userId: authUserResponseSchema.parse(body).user.id, email };
}
