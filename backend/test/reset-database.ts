import type { PrismaService } from "../src/prisma/prisma.service.js";

/**
 * Empties every table before a test. `CASCADE` covers the foreign keys of
 * `schemas` and `refresh_tokens` onto `users`.
 */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRaw`TRUNCATE users, schemas, refresh_tokens CASCADE`;
}
