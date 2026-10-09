import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";

import type { ImportOptions, LayoutMetrics } from "@schemaforge/core";
import { createCounterIdGenerator } from "@schemaforge/core/testing";
import { MySqlContainer } from "@testcontainers/mysql";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import type { StartedTestContainer } from "testcontainers";

import { MYSQL_IMAGE, POSTGRES_IMAGE } from "./containers.js";
import { withTempDirectory } from "./temp-directory.js";

export type DumpDialect = "postgresql" | "mysql";

/** A database that already ran the DDL it was created with. */
export type DumpDatabase = {
  // Reachable from the host, for `prisma db pull`.
  readonly url: string;
  // `pg_dump --schema-only --no-owner` or `mysqldump --no-data`, run in the container.
  readonly dump: () => Promise<string>;
};

export type DumpServer = {
  readonly createDatabase: (name: string, ddl: string) => Promise<DumpDatabase>;
  readonly stop: () => Promise<void>;
};

const DDL_PATH = "/tmp/ddl.sql";

// Database names come from the tests (f_1, f_2, ...), never from fixtures.
const SAFE_DATABASE_NAME = /^[a-z][a-z0-9_]*$/;

async function execOrThrow(
  container: StartedTestContainer,
  command: readonly string[],
  env: Readonly<Record<string, string>> = {},
): Promise<string> {
  const result = await container.exec([...command], { env: { ...env } });
  if (result.exitCode !== 0) {
    throw new Error(
      `${command[0] ?? ""} exited with ${String(result.exitCode)}:\n${result.output}`,
    );
  }
  return result.stdout;
}

function assertSafeName(name: string): void {
  if (!SAFE_DATABASE_NAME.test(name)) {
    throw new Error(`Unsafe database name: ${name}`);
  }
}

// The DDL can be larger than one command line argument, so it goes in a file.
async function copyDdl(
  container: StartedTestContainer,
  ddl: string,
): Promise<void> {
  await container.copyContentToContainer([{ content: ddl, target: DDL_PATH }]);
}

async function startPostgresqlDumpServer(): Promise<DumpServer> {
  const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  // Inside the container psql and pg_dump use the local socket, which trusts the user.
  const user = container.getUsername();
  return {
    createDatabase: async (name, ddl) => {
      assertSafeName(name);
      await execOrThrow(container, [
        "psql",
        "-U",
        user,
        "-d",
        container.getDatabase(),
        "-c",
        `CREATE DATABASE ${name}`,
      ]);
      // An empty output has no statement to send.
      if (ddl.trim() !== "") {
        await copyDdl(container, ddl);
        await execOrThrow(container, [
          "psql",
          "-v",
          "ON_ERROR_STOP=1",
          "-U",
          user,
          "-d",
          name,
          "-f",
          DDL_PATH,
        ]);
      }
      const credentials = `${encodeURIComponent(user)}:${encodeURIComponent(container.getPassword())}`;
      return {
        url: `postgresql://${credentials}@${container.getHost()}:${String(container.getPort())}/${name}`,
        dump: () =>
          execOrThrow(container, [
            "pg_dump",
            "--schema-only",
            "--no-owner",
            "-U",
            user,
            name,
          ]),
      };
    },
    stop: async () => {
      await container.stop();
    },
  };
}

async function startMysqlDumpServer(): Promise<DumpServer> {
  const container = await new MySqlContainer(MYSQL_IMAGE).start();
  // The default user may only use the container's own database.
  const env = { MYSQL_PWD: container.getRootPassword() };
  return {
    createDatabase: async (name, ddl) => {
      assertSafeName(name);
      // Same character set and collation as the CG-01 conformance test.
      await execOrThrow(
        container,
        [
          "mysql",
          "-uroot",
          "-e",
          `CREATE DATABASE ${name} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci`,
        ],
        env,
      );
      if (ddl.trim() !== "") {
        await copyDdl(container, ddl);
        await execOrThrow(
          container,
          [
            "sh",
            "-c",
            `mysql --binary-mode --default-character-set=utf8mb4 -uroot ${name} < ${DDL_PATH}`,
          ],
          env,
        );
      }
      const credentials = `root:${encodeURIComponent(container.getRootPassword())}`;
      return {
        url: `mysql://${credentials}@${container.getHost()}:${String(container.getPort())}/${name}`,
        dump: () =>
          execOrThrow(
            container,
            [
              "mysqldump",
              "--no-data",
              "--default-character-set=utf8mb4",
              "-uroot",
              name,
            ],
            env,
          ),
      };
    },
    stop: async () => {
      await container.stop();
    },
  };
}

// Positions never reach the DDL, so any layout metrics do.
const IMPORT_LAYOUT: LayoutMetrics = {
  tableWidth: 320,
  headerHeight: 40,
  columnRowHeight: 28,
  gap: 80,
};

/** Importer options for a conformance import that keeps the fixture's schema name. */
export function createImportOptions(fallbackSchemaName: string): ImportOptions {
  return {
    fallbackSchemaName,
    generateId: createCounterIdGenerator(),
    layout: IMPORT_LAYOUT,
  };
}

/** Starts one database server whose databases can be dumped with the real dump tool. */
export function startDumpServer(dialect: DumpDialect): Promise<DumpServer> {
  return dialect === "postgresql"
    ? startPostgresqlDumpServer()
    : startMysqlDumpServer();
}

function runPrismaCli(
  args: readonly string[],
  cwd: string,
): Promise<{ readonly stdout: string }> {
  const cli = createRequire(import.meta.url).resolve("prisma/build/index.js");
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [cli, ...args],
      { cwd, maxBuffer: 64 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error === null) {
          resolve({ stdout });
        } else {
          // The arguments hold the database URL, so the message leaves them out.
          reject(
            new Error(`The prisma CLI failed:\n${stdout}${stderr}`, {
              cause: error,
            }),
          );
        }
      },
    );
  });
}

/** Runs `prisma db pull --print` against the database and returns the introspected schema. */
export async function pullPrismaSchema(
  url: string,
  provider: DumpDialect,
): Promise<string> {
  return withTempDirectory(async (directory) => {
    const schemaPath = join(directory, "schema.prisma");
    await writeFile(
      schemaPath,
      `datasource db {\n  provider = "${provider}"\n}\n`,
    );
    const { stdout } = await runPrismaCli(
      ["db", "pull", "--print", "--schema", schemaPath, "--url", url],
      directory,
    );
    return stdout;
  });
}
