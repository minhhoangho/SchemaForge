import { describe, expect, it } from "vitest";

import type { SqlDialect } from "../../generators/shared/generator-types.js";
import { unwrapOk } from "../../testing/unwrap-result.js";
import {
  readAddedUniqueConstraint,
  type SqlAddedUniqueConstraint,
} from "./sql-table-keys.js";
import { scanSqlStatements } from "./statement-scanner.js";

function readAdded(
  source: string,
  dialect: SqlDialect = "postgresql",
): readonly (SqlAddedUniqueConstraint | null)[] {
  return unwrapOk(scanSqlStatements(source, dialect)).map(
    readAddedUniqueConstraint,
  );
}

describe("readAddedUniqueConstraint", () => {
  it.each<readonly [SqlDialect, string, SqlAddedUniqueConstraint]>([
    [
      "postgresql",
      "\nALTER TABLE ONLY public.orders\n    ADD CONSTRAINT orders_code_region_key UNIQUE (code, region);",
      {
        tableName: "orders",
        start: 1,
        constraint: {
          name: "orders_code_region_key",
          columnNames: ["code", "region"],
          isMysqlKey: false,
          hasDroppedElementOption: false,
        },
      },
    ],
    [
      "postgresql",
      "ALTER TABLE IF EXISTS t ADD UNIQUE (a)",
      {
        tableName: "t",
        start: 0,
        constraint: {
          name: null,
          columnNames: ["a"],
          isMysqlKey: false,
          hasDroppedElementOption: false,
        },
      },
    ],
    [
      "sqlserver",
      "ALTER TABLE [dbo].[t] WITH CHECK ADD CONSTRAINT [u] UNIQUE NONCLUSTERED ([a] DESC) WITH (ONLINE = OFF) ON [PRIMARY]",
      {
        tableName: "t",
        start: 0,
        constraint: {
          name: "u",
          columnNames: ["a"],
          isMysqlKey: false,
          hasDroppedElementOption: true,
        },
      },
    ],
    [
      "sqlserver",
      "ALTER TABLE [t] ADD UNIQUE CLUSTERED ([a], [b])",
      {
        tableName: "t",
        start: 0,
        constraint: {
          name: null,
          columnNames: ["a", "b"],
          isMysqlKey: false,
          hasDroppedElementOption: false,
        },
      },
    ],
    [
      "mysql",
      "ALTER TABLE `t` ADD UNIQUE KEY `k` (`a`)",
      {
        tableName: "t",
        start: 0,
        constraint: {
          name: "k",
          columnNames: ["a"],
          isMysqlKey: true,
          hasDroppedElementOption: false,
        },
      },
    ],
  ])(
    "reads a unique constraint added through alter table in %s: %s",
    (dialect, source, added) => {
      expect(readAdded(source, dialect)).toStrictEqual([added]);
    },
  );

  it.each([
    "ALTER TABLE t ADD CONSTRAINT pk PRIMARY KEY (a)",
    "ALTER TABLE t ADD COLUMN a int UNIQUE",
    "ALTER TABLE t ADD CONSTRAINT u UNIQUE (lower(a))",
    "ALTER TABLE t ADD CONSTRAINT u UNIQUE",
    "ALTER TABLE t DROP CONSTRAINT u",
    "ALTER TABLE ADD UNIQUE (a)",
    "CREATE TABLE t (a int UNIQUE)",
  ])("returns null for another alter table form: %s", (source) => {
    expect(readAdded(source)).toStrictEqual([null]);
  });
});
