import { cookies } from "next/headers";

import { AUTH_HINT_COOKIE_NAME, parseAuthHint } from "./auth-hint-cookie";

/**
 * Reads the `sf-auth-hint` cookie of the incoming request, so the root layout
 * can tell the header whether this browser signed in before and the account
 * menu does not flash a sign-in link at a signed-in user. Only a Server
 * Component calls this.
 */
export async function getRequestAuthHint(): Promise<boolean> {
  const cookieStore = await cookies();

  return parseAuthHint(cookieStore.get(AUTH_HINT_COOKIE_NAME)?.value);
}
