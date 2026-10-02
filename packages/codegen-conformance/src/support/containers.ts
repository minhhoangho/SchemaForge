import type { SqlDialect } from "@schemaforge/core";
import { MSSQLServerContainer } from "@testcontainers/mssqlserver";
import { MySqlContainer } from "@testcontainers/mysql";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import mssql from "mssql";
import { createConnection } from "mysql2/promise";
import type { RowDataPacket } from "mysql2/promise";
import { Client } from "pg";

export const POSTGRES_IMAGE = "postgres:18-alpine";
export const MYSQL_IMAGE = "mysql:8.4";
export const SQLSERVER_IMAGE = "mcr.microsoft.com/mssql/server:2022-latest";

const SQLSERVER_PLATFORM = "linux/amd64";
const SQLSERVER_STARTUP_TIMEOUT_MS = 300_000;

type Row = Readonly<Record<string, unknown>>;

export type DatabaseSession = {
  // One round trip that may hold several statements.
  readonly execute: (sql: string) => Promise<void>;
  readonly query: (sql: string) => Promise<readonly Row[]>;
  // BASE TABLE rows of the current database.
  readonly countTables: () => Promise<number>;
  readonly countRows: (tableName: string) => Promise<number>;
  readonly close: () => Promise<void>;
};

export type DatabaseServer = {
  readonly dialect: SqlDialect;
  readonly createDatabase: (name: string) => Promise<DatabaseSession>;
  readonly stop: () => Promise<void>;
};

// Same quoting rules as the generators (spec section 5).
function quoteIdentifier(dialect: SqlDialect, name: string): string {
  switch (dialect) {
    case "postgresql":
      return `"${name.replaceAll('"', '""')}"`;
    case "mysql":
      return `\`${name.replaceAll("`", "``")}\``;
    case "sqlserver":
      return `[${name.replaceAll("]", "]]")}]`;
    default: {
      const unhandled: never = dialect;
      throw new Error(`Unknown dialect: ${String(unhandled)}`);
    }
  }
}

const COUNT_TABLES_SQL: Readonly<Record<SqlDialect, string>> = {
  postgresql:
    "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog', 'information_schema')",
  mysql:
    "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_schema = DATABASE()",
  sqlserver:
    "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'",
};

type Connection = Pick<DatabaseSession, "execute" | "query" | "close">;

function toSession(
  dialect: SqlDialect,
  connection: Connection,
): DatabaseSession {
  const count = async (sql: string) => {
    const [row] = await connection.query(sql);
    return Number(row?.count);
  };
  return {
    ...connection,
    countTables: () => count(COUNT_TABLES_SQL[dialect]),
    countRows: (tableName) =>
      count(
        `SELECT COUNT(*) AS count FROM ${quoteIdentifier(dialect, tableName)}`,
      ),
  };
}

async function startPostgreSql(): Promise<DatabaseServer> {
  const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  const connect = async (database: string): Promise<Connection> => {
    const client = new Client({
      host: container.getHost(),
      port: container.getPort(),
      user: container.getUsername(),
      password: container.getPassword(),
      database,
    });
    await client.connect();
    return {
      // No parameters, so pg sends a simple query that may hold several statements.
      execute: async (sql) => {
        await client.query(sql);
      },
      query: async (sql) => (await client.query<Row>(sql)).rows,
      close: () => client.end(),
    };
  };
  const admin = await connect(container.getDatabase());
  return {
    dialect: "postgresql",
    createDatabase: async (name) => {
      await admin.execute(
        `CREATE DATABASE ${quoteIdentifier("postgresql", name)}`,
      );
      return toSession("postgresql", await connect(name));
    },
    stop: async () => {
      await admin.close();
      await container.stop();
    },
  };
}

async function startMySql(): Promise<DatabaseServer> {
  const container = await new MySqlContainer(MYSQL_IMAGE).start();
  const connect = async (database: string): Promise<Connection> => {
    const connection = await createConnection({
      host: container.getHost(),
      port: container.getPort(),
      // The default user may only use the container's own database.
      user: "root",
      password: container.getRootPassword(),
      database,
      multipleStatements: true,
    });
    return {
      execute: async (sql) => {
        await connection.query(sql);
      },
      query: async (sql) => (await connection.query<RowDataPacket[]>(sql))[0],
      close: () => connection.end(),
    };
  };
  const admin = await connect(container.getDatabase());
  return {
    dialect: "mysql",
    createDatabase: async (name) => {
      // The sql_mode stays the 8.4 default (strict), which the comment limits rely on.
      await admin.execute(
        `CREATE DATABASE ${quoteIdentifier("mysql", name)} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci`,
      );
      return toSession("mysql", await connect(name));
    },
    stop: async () => {
      await admin.close();
      await container.stop();
    },
  };
}

async function startSqlServer(): Promise<DatabaseServer> {
  const container = await new MSSQLServerContainer(SQLSERVER_IMAGE)
    .acceptLicense()
    // The image is amd64 only; on arm64 hosts it runs emulated and starts slowly.
    .withPlatform(SQLSERVER_PLATFORM)
    .withStartupTimeout(SQLSERVER_STARTUP_TIMEOUT_MS)
    .start();
  const connect = async (database: string): Promise<Connection> => {
    const pool = await new mssql.ConnectionPool({
      server: container.getHost(),
      port: container.getPort(),
      user: container.getUsername(),
      password: container.getPassword(),
      database,
      options: { encrypt: false, trustServerCertificate: true },
    }).connect();
    return {
      // One batch, not sp_executesql, so DECLARE works across statements.
      execute: async (sql) => {
        await pool.request().batch(sql);
      },
      query: async (sql) => (await pool.request().query<Row>(sql)).recordset,
      close: () => pool.close(),
    };
  };
  const admin = await connect("master");
  return {
    dialect: "sqlserver",
    createDatabase: async (name) => {
      await admin.execute(
        `CREATE DATABASE ${quoteIdentifier("sqlserver", name)}`,
      );
      return toSession("sqlserver", await connect(name));
    },
    stop: async () => {
      await admin.close();
      await container.stop();
    },
  };
}

export function startDatabaseServer(
  dialect: SqlDialect,
): Promise<DatabaseServer> {
  switch (dialect) {
    case "postgresql":
      return startPostgreSql();
    case "mysql":
      return startMySql();
    case "sqlserver":
      return startSqlServer();
    default: {
      const unhandled: never = dialect;
      throw new Error(`Unknown dialect: ${String(unhandled)}`);
    }
  }
}

export type SqlOutcome = {
  readonly isAccepted: boolean;
  // Server error numbers (MySQL errno, SQL Server number) or SQLSTATE
  // (PostgreSQL), in the order the server reported them; empty when accepted.
  readonly codes: readonly (number | string)[];
  readonly message: string;
};

function readErrorCodes(error: unknown): readonly (number | string)[] {
  if (typeof error !== "object" || error === null) {
    return [];
  }
  // mssql reports the last error and keeps the earlier ones in precedingErrors.
  const preceding: readonly unknown[] =
    "precedingErrors" in error && Array.isArray(error.precedingErrors)
      ? error.precedingErrors
      : [];
  const own =
    "errno" in error && typeof error.errno === "number"
      ? error.errno
      : "number" in error && typeof error.number === "number"
        ? error.number
        : "code" in error && typeof error.code === "string"
          ? error.code
          : undefined;
  return [
    ...preceding.flatMap(readErrorCodes),
    ...(own === undefined ? [] : [own]),
  ];
}

/** Runs the SQL and reports whether the database accepted it, instead of throwing. */
export async function tryExecute(
  session: DatabaseSession,
  sql: string,
): Promise<SqlOutcome> {
  try {
    await session.execute(sql);
    return { isAccepted: true, codes: [], message: "" };
  } catch (error: unknown) {
    return {
      isAccepted: false,
      codes: readErrorCodes(error),
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
