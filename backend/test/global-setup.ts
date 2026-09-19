import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const BACKEND_DIRECTORY = fileURLToPath(new URL("..", import.meta.url));

/**
 * Refuses to touch a database unless this is the test environment, then brings
 * the test database up to the committed migrations (spec section 11).
 */
export function setup(): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("e2e tests require NODE_ENV=test");
  }
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: BACKEND_DIRECTORY,
    stdio: "inherit",
  });
}
