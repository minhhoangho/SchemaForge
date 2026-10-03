import { describe, expect, it } from "vitest";

import type { ColumnDefault } from "../../model/column-default.js";
import type { ColumnType } from "../../model/column-type.js";
import {
  createColumnId,
  createEnumId,
  createTableId,
} from "../../model/ids.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import { makeColumn, makeEnum } from "../../testing/factories.js";
import type { SqlDialect } from "./generator-types.js";
import {
  formatSqlDefault,
  formatSqlLiteral,
  removeNullCharacters,
  sqlStringLiteral,
} from "./sql-literals.js";
import type { SqlDefault } from "./sql-literals.js";

type TemporalKind = "time" | "timestamp" | "timestamptz";

const STATUS_ENUM_ID = createEnumId(() => "status");
const ENUMS: SchemaDocument["enums"] = {
  [STATUS_ENUM_ID]: makeEnum({ id: STATUS_ENUM_ID, values: ["active"] }),
};

function formatDefault(
  dialect: SqlDialect,
  type: ColumnType,
  defaultValue: ColumnDefault | null,
  shouldParenthesizeLiteral = false,
): SqlDefault {
  const column = makeColumn({
    id: createColumnId(() => "value"),
    tableId: createTableId(() => "items"),
    type,
    defaultValue,
  });
  return formatSqlDefault({
    dialect,
    column,
    enums: ENUMS,
    shouldParenthesizeLiteral,
  });
}

function sqlValue(sql: string): SqlDefault {
  return { kind: "value", sql, hasRemovedNullCharacter: false };
}

describe("sqlStringLiteral", () => {
  it.each<readonly [SqlDialect, string, string]>([
    ["postgresql", "it's", "'it''s'"],
    ["postgresql", "a\\b", "'a\\b'"],
    ["mysql", "a\\b", "'a\\\\b'"],
    ["mysql", "it's", "'it''s'"],
    ["mysql", "a\\'b", "'a\\\\''b'"],
    ["sqlserver", "it's", "N'it''s'"],
    ["postgresql", "line 1\nline 2", "'line 1\nline 2'"],
    ["mysql", "line 1\nline 2", "'line 1\nline 2'"],
    ["sqlserver", "line 1\nline 2", "N'line 1\nline 2'"],
  ])(
    "quotes string literals for each dialect: %s %j",
    (dialect, value, sql) => {
      expect(sqlStringLiteral(dialect, value)).toBe(sql);
    },
  );

  // T-SQL drops a backslash followed by LF or CRLF inside a string constant
  // (line continuation); the doubled backslash and line break survive it.
  it.each<readonly [string, string]>([
    ["a\\\nb", "N'a\\\\\n\nb'"],
    ["a\\\r\nb", "N'a\\\\\r\n\r\nb'"],
    ["a\\\\\nb", "N'a\\\\\\\n\nb'"],
    ["a\\\nb\\\nc", "N'a\\\\\n\nb\\\\\n\nc'"],
    ["a\\\rb", "N'a\\\rb'"],
  ])(
    "keeps a backslash before a line break in a SQL Server literal: %j",
    (value, sql) => {
      expect(sqlStringLiteral("sqlserver", value)).toBe(sql);
    },
  );
});

describe("removeNullCharacters", () => {
  it("removes null characters and reports it", () => {
    expect(removeNullCharacters("a\u0000b\u0000")).toStrictEqual({
      text: "ab",
      hasRemoved: true,
    });
  });

  it("reports nothing when there is no null character", () => {
    expect(removeNullCharacters("ab")).toStrictEqual({
      text: "ab",
      hasRemoved: false,
    });
  });
});

describe("formatSqlLiteral", () => {
  const enumType: ColumnType = { kind: "enum", enumId: STATUS_ENUM_ID };
  const uuid = "123e4567-e89b-12d3-a456-426614174000";

  it.each<readonly [SqlDialect, ColumnType, string, string]>([
    ["postgresql", { kind: "integer" }, "-5", "-5"],
    ["mysql", { kind: "integer" }, "-5", "-5"],
    ["sqlserver", { kind: "integer" }, "-5", "-5"],
    ["postgresql", { kind: "decimal", precision: 3, scale: 2 }, "9.99", "9.99"],
    ["mysql", { kind: "decimal", precision: 3, scale: 2 }, "9.99", "9.99"],
    ["sqlserver", { kind: "decimal", precision: 3, scale: 2 }, "9.99", "9.99"],
    ["postgresql", { kind: "real" }, "1.5e-3", "1.5e-3"],
    ["mysql", { kind: "real" }, "1.5e-3", "1.5e-3"],
    ["sqlserver", { kind: "real" }, "1.5e-3", "1.5e-3"],
    ["postgresql", { kind: "boolean" }, "true", "true"],
    ["postgresql", { kind: "boolean" }, "false", "false"],
    ["mysql", { kind: "boolean" }, "true", "TRUE"],
    ["mysql", { kind: "boolean" }, "false", "FALSE"],
    ["sqlserver", { kind: "boolean" }, "true", "1"],
    ["sqlserver", { kind: "boolean" }, "false", "0"],
    ["postgresql", { kind: "varchar", length: 10 }, "it's", "'it''s'"],
    ["mysql", { kind: "varchar", length: 10 }, "it's", "'it''s'"],
    ["sqlserver", { kind: "varchar", length: 10 }, "it's", "N'it''s'"],
    ["postgresql", { kind: "uuid" }, uuid, `'${uuid}'`],
    ["mysql", { kind: "uuid" }, uuid, `'${uuid}'`],
    ["sqlserver", { kind: "uuid" }, uuid, `N'${uuid}'`],
    ["postgresql", { kind: "date" }, "2026-01-02", "'2026-01-02'"],
    ["mysql", { kind: "date" }, "2026-01-02", "'2026-01-02'"],
    ["sqlserver", { kind: "date" }, "2026-01-02", "N'2026-01-02'"],
    [
      "postgresql",
      { kind: "timestamptz" },
      "2026-01-02T03:04:05Z",
      "'2026-01-02T03:04:05Z'",
    ],
    [
      "sqlserver",
      { kind: "timestamptz" },
      "2026-01-02T03:04:05Z",
      "N'2026-01-02T03:04:05Z'",
    ],
    ["postgresql", { kind: "json" }, '{"a":"b"}', `'{"a":"b"}'`],
    ["mysql", { kind: "json" }, '{"a":"b"}', `'{"a":"b"}'`],
    ["sqlserver", { kind: "json" }, '{"a":"b"}', `N'{"a":"b"}'`],
    ["postgresql", enumType, "active", "'active'"],
    ["mysql", enumType, "active", "'active'"],
    ["sqlserver", enumType, "active", "N'active'"],
  ])(
    "formats literals by column type and dialect: %s %j %j",
    (dialect, type, value, sql) => {
      expect(formatSqlLiteral(dialect, type, value)).toBe(sql);
    },
  );

  it.each<readonly [TemporalKind, string, string]>([
    ["time", "12:34:56.123456789", "N'12:34:56.1234567'"],
    [
      "timestamptz",
      "2026-01-02T03:04:05.123456789+07:00",
      "N'2026-01-02T03:04:05.1234567+07:00'",
    ],
    [
      "timestamptz",
      "2026-01-02T03:04:05.123456789Z",
      "N'2026-01-02T03:04:05.1234567Z'",
    ],
    [
      "timestamp",
      "2026-01-02T03:04:05.1234567",
      "N'2026-01-02T03:04:05.1234567'",
    ],
  ])(
    "truncates fractional seconds beyond seven digits for SQL Server: %s %j",
    (kind, value, sql) => {
      expect(formatSqlLiteral("sqlserver", { kind }, value)).toBe(sql);
    },
  );

  it.each<readonly [TemporalKind, string, string]>([
    ["time", "12:34:56.123456789", "'12:34:56.123456'"],
    [
      "timestamp",
      "2026-01-02T03:04:05.9999999",
      "'2026-01-02T03:04:05.999999'",
    ],
    [
      "timestamptz",
      "2026-01-02T03:04:05.123456789-05:30",
      "'2026-01-02T03:04:05.123456-05:30'",
    ],
    ["time", "12:34:56.5", "'12:34:56.5'"],
  ])(
    "truncates fractional seconds beyond six digits for MySQL: %s %j",
    (kind, value, sql) => {
      expect(formatSqlLiteral("mysql", { kind }, value)).toBe(sql);
    },
  );

  // MySQL 8.4 rejects a "Z" or "-00:00" offset with error 1067 (Task 8 probe).
  it.each<readonly [string, string]>([
    ["2026-01-02T03:04:05Z", "'2026-01-02T03:04:05+00:00'"],
    ["2026-01-02T03:04:05-00:00", "'2026-01-02T03:04:05+00:00'"],
    ["2026-01-02 03:04:05.1234567Z", "'2026-01-02 03:04:05.123456+00:00'"],
    ["2026-01-02T03:04:05+00:00", "'2026-01-02T03:04:05+00:00'"],
    ["2026-01-02T03:04:05-05:00", "'2026-01-02T03:04:05-05:00'"],
  ])(
    "writes a UTC offset as +00:00 in MySQL timestamptz literals: %j",
    (value, sql) => {
      expect(formatSqlLiteral("mysql", { kind: "timestamptz" }, value)).toBe(
        sql,
      );
    },
  );

  it.each<readonly [SqlDialect, string, string]>([
    ["postgresql", "2026-01-02T03:04:05-00:00", "'2026-01-02T03:04:05-00:00'"],
    ["sqlserver", "2026-01-02T03:04:05-00:00", "N'2026-01-02T03:04:05-00:00'"],
  ])(
    "keeps a -00:00 offset in timestamptz literals outside MySQL: %s %j",
    (dialect, value, sql) => {
      expect(formatSqlLiteral(dialect, { kind: "timestamptz" }, value)).toBe(
        sql,
      );
    },
  );

  it("keeps a trailing Z in MySQL text literals", () => {
    expect(
      formatSqlLiteral("mysql", { kind: "text" }, "2026-01-02T03:04:05Z"),
    ).toBe("'2026-01-02T03:04:05Z'");
  });

  it("keeps fractional seconds for PostgreSQL", () => {
    expect(
      formatSqlLiteral(
        "postgresql",
        { kind: "timestamptz" },
        "2026-01-02T03:04:05.123456789+07:00",
      ),
    ).toBe("'2026-01-02T03:04:05.123456789+07:00'");
  });

  it("throws when asked to format a binary literal", () => {
    expect(() =>
      formatSqlLiteral("postgresql", { kind: "binary" }, ""),
    ).toThrow(Error);
  });
});

describe("formatSqlDefault", () => {
  it("returns none for a column without a default", () => {
    expect(
      formatDefault("postgresql", { kind: "integer" }, null),
    ).toStrictEqual({ kind: "none" });
  });

  it.each<readonly [SqlDialect, TemporalKind, string]>([
    ["postgresql", "timestamp", "now()"],
    ["postgresql", "timestamptz", "now()"],
    ["mysql", "timestamp", "CURRENT_TIMESTAMP(6)"],
    ["mysql", "timestamptz", "CURRENT_TIMESTAMP(6)"],
    ["sqlserver", "timestamp", "sysdatetime()"],
    ["sqlserver", "timestamptz", "sysdatetimeoffset()"],
  ])(
    "formats currentTimestamp for each dialect and timestamp kind: %s %s",
    (dialect, kind, sql) => {
      expect(
        formatDefault(dialect, { kind }, { kind: "currentTimestamp" }),
      ).toStrictEqual(sqlValue(sql));
    },
  );

  it.each<readonly [SqlDialect, string]>([
    ["postgresql", "gen_random_uuid()"],
    ["mysql", "(UUID())"],
    ["sqlserver", "newid()"],
  ])("formats generateUuid for each dialect: %s", (dialect, sql) => {
    expect(
      formatDefault(dialect, { kind: "uuid" }, { kind: "generateUuid" }),
    ).toStrictEqual(sqlValue(sql));
  });

  it("formats a literal default with the dialect's literal syntax", () => {
    expect(
      formatDefault(
        "sqlserver",
        { kind: "boolean" },
        { kind: "literal", value: "true" },
      ),
    ).toStrictEqual(sqlValue("1"));
  });

  it("wraps a MySQL literal in parentheses when requested", () => {
    expect(
      formatDefault(
        "mysql",
        { kind: "json" },
        { kind: "literal", value: "[]" },
        true,
      ),
    ).toStrictEqual(sqlValue("('[]')"));
  });

  it("does not wrap a PostgreSQL literal", () => {
    expect(
      formatDefault(
        "postgresql",
        { kind: "json" },
        { kind: "literal", value: "[]" },
        true,
      ),
    ).toStrictEqual(sqlValue("'[]'"));
  });

  it.each(["1; DROP TABLE x", "1 OR 1=1", "0x10"])(
    "omits a literal that is not valid for a numeric column: %j",
    (value) => {
      expect(
        formatDefault(
          "postgresql",
          { kind: "integer" },
          {
            kind: "literal",
            value,
          },
        ),
      ).toStrictEqual({ kind: "omitted" });
    },
  );

  it("omits currentTimestamp on a date column", () => {
    expect(
      formatDefault("mysql", { kind: "date" }, { kind: "currentTimestamp" }),
    ).toStrictEqual({ kind: "omitted" });
  });

  it("omits a literal on a binary column", () => {
    expect(
      formatDefault(
        "sqlserver",
        { kind: "binary" },
        {
          kind: "literal",
          value: "",
        },
      ),
    ).toStrictEqual({ kind: "omitted" });
  });

  it("removes a null character from a PostgreSQL literal", () => {
    expect(
      formatDefault(
        "postgresql",
        { kind: "text" },
        {
          kind: "literal",
          value: "a\u0000b",
        },
      ),
    ).toStrictEqual({
      kind: "value",
      sql: "'ab'",
      hasRemovedNullCharacter: true,
    });
  });

  it("keeps a null character in a MySQL literal", () => {
    expect(
      formatDefault(
        "mysql",
        { kind: "text" },
        {
          kind: "literal",
          value: "a\u0000b",
        },
      ),
    ).toStrictEqual(sqlValue("'a\u0000b'"));
  });
});
