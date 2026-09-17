import { ConfigService } from "@nestjs/config";
import type * as PrismaAdapterPg from "@prisma/adapter-pg";
import { describe, expect, it, vi } from "vitest";

import type { Env } from "../config/env.js";

const prismaPgConstructor = vi.fn();

vi.mock("@prisma/adapter-pg", async (importOriginal) => {
  const actual = await importOriginal<typeof PrismaAdapterPg>();
  return {
    ...actual,
    PrismaPg: class extends actual.PrismaPg {
      constructor(options: ConstructorParameters<typeof actual.PrismaPg>[0]) {
        prismaPgConstructor(options);
        super(options);
      }
    },
  };
});

const { PrismaService } = await import("./prisma.service.js");

function createConfig(databaseUrl: string): ConfigService<Env, true> {
  return new ConfigService<Env, true>({
    NODE_ENV: "test",
    PORT: 3001,
    DATABASE_URL: databaseUrl,
    JWT_ACCESS_SECRET: "a".repeat(32),
    CORS_ORIGINS: ["http://localhost:3000"],
    AUTH_COOKIE_SECURE: true,
    TRUST_PROXY_HOPS: 0,
  });
}

describe("PrismaService", () => {
  it("creates the client with the database url from config", () => {
    const databaseUrl =
      "postgresql://user:password@localhost:5432/schemaforge_test";

    const service = new PrismaService(createConfig(databaseUrl));

    expect(typeof service.$disconnect).toBe("function");
    expect(prismaPgConstructor).toHaveBeenCalledWith({
      connectionString: databaseUrl,
    });
  });

  it("disconnects when the module is destroyed", async () => {
    const service = new PrismaService(
      createConfig(
        "postgresql://user:password@localhost:5432/schemaforge_test",
      ),
    );
    const disconnect = vi
      .spyOn(service, "$disconnect")
      .mockResolvedValue(undefined);

    await service.onModuleDestroy();

    expect(disconnect).toHaveBeenCalledOnce();
  });
});
