import { describe, expect, it } from "vitest";

import type { ColumnType } from "../../model/column-type.js";
import { makeColumn } from "../../testing/factories.js";
import type { DialectColumnType } from "./dialect-types.js";
import {
  mysqlKeyPartBytes,
  resolveDialectColumnType,
  sqlServerFixedKeyBytes,
} from "./dialect-types.js";
import type { SqlDialect } from "./generator-types.js";

const TYPE_PATH = ["columns", "col_a", "type"];

function resolve(
  dialect: SqlDialect,
  type: ColumnType,
  isKeyColumn = false,
  isFixedLengthNarrowed = false,
): ReturnType<typeof resolveDialectColumnType> {
  return resolveDialectColumnType({
    dialect,
    column: makeColumn({ id: "col_a", tableId: "tbl_t", type }),
    isKeyColumn,
    isFixedLengthNarrowed,
  });
}

function codesOf(result: ReturnType<typeof resolve>): readonly string[] {
  return result.diagnostics.map((diagnostic) => diagnostic.code);
}

describe("resolveDialectColumnType", () => {
  it.each([
    [{ kind: "varchar", length: 1000 }, ["key-column-type-narrowed"]],
    [
      { kind: "char", length: 1000 },
      ["key-column-type-narrowed", "type-parameter-out-of-range"],
    ],
    [
      { kind: "varchar", length: 20000 },
      ["key-column-type-narrowed", "type-parameter-out-of-range"],
    ],
  ] as const)(
    "narrows a MySQL char or varchar key column longer than 768 to varchar(768): %o",
    (type, codes) => {
      const result = resolve("mysql", type, true);

      expect(result.type).toStrictEqual({ kind: "varchar", length: 768 });
      expect(codesOf(result).toSorted()).toStrictEqual(codes);
    },
  );

  it("narrows a SQL Server nchar to nvarchar when asked", () => {
    const result = resolve(
      "sqlserver",
      { kind: "char", length: 500 },
      true,
      true,
    );

    expect(result).toStrictEqual({
      type: { kind: "varchar", length: 500 },
      diagnostics: [{ code: "key-column-type-narrowed", path: TYPE_PATH }],
    });
  });

  it("keeps a MySQL varchar(768) key column", () => {
    expect(
      resolve("mysql", { kind: "varchar", length: 768 }, true),
    ).toStrictEqual({
      type: { kind: "varchar", length: 768 },
      diagnostics: [],
    });
  });

  it.each(["sqlserver", "postgresql"] as const)(
    "keeps a long varchar key column on SQL Server and PostgreSQL: %s",
    (dialect) => {
      expect(
        resolve(dialect, { kind: "varchar", length: 1000 }, true),
      ).toStrictEqual({
        type: { kind: "varchar", length: 1000 },
        diagnostics: [],
      });
    },
  );

  it("keeps a long MySQL varchar that is not a key column", () => {
    expect(resolve("mysql", { kind: "varchar", length: 1000 })).toStrictEqual({
      type: { kind: "varchar", length: 1000 },
      diagnostics: [],
    });
  });

  it.each([
    ["postgresql", { kind: "char", length: 10485760 }],
    ["postgresql", { kind: "varchar", length: 10485760 }],
    ["postgresql", { kind: "decimal", precision: 1000, scale: 1000 }],
    ["mysql", { kind: "char", length: 255 }],
    ["mysql", { kind: "varchar", length: 16383 }],
    ["mysql", { kind: "decimal", precision: 65, scale: 30 }],
    ["sqlserver", { kind: "char", length: 4000 }],
    ["sqlserver", { kind: "varchar", length: 4000 }],
    ["sqlserver", { kind: "decimal", precision: 38, scale: 38 }],
    ["mysql", { kind: "bigint" }],
    ["sqlserver", { kind: "uuid" }],
    ["postgresql", { kind: "enum", enumId: "enum_status" }],
  ] as const)(
    "keeps types within dialect limits unchanged: %s %o",
    (dialect, type) => {
      expect(resolve(dialect, type)).toStrictEqual({ type, diagnostics: [] });
    },
  );

  it("maps char beyond the MySQL limit to varchar", () => {
    expect(resolve("mysql", { kind: "char", length: 300 })).toStrictEqual({
      type: { kind: "varchar", length: 300 },
      diagnostics: [{ code: "type-parameter-out-of-range", path: TYPE_PATH }],
    });
  });

  it("maps a MySQL char(300) key column to varchar(300) without narrowing", () => {
    expect(resolve("mysql", { kind: "char", length: 300 }, true)).toStrictEqual(
      {
        type: { kind: "varchar", length: 300 },
        diagnostics: [{ code: "type-parameter-out-of-range", path: TYPE_PATH }],
      },
    );
  });

  it("maps char beyond the MySQL varchar limit to text", () => {
    expect(resolve("mysql", { kind: "char", length: 16384 })).toStrictEqual({
      type: { kind: "text" },
      diagnostics: [{ code: "type-parameter-out-of-range", path: TYPE_PATH }],
    });
  });

  it.each([
    ["postgresql", 10485761],
    ["sqlserver", 4001],
  ] as const)(
    "maps char beyond the PostgreSQL and SQL Server limits to text: %s",
    (dialect, length) => {
      expect(resolve(dialect, { kind: "char", length })).toStrictEqual({
        type: { kind: "text" },
        diagnostics: [{ code: "type-parameter-out-of-range", path: TYPE_PATH }],
      });
    },
  );

  it.each([
    ["postgresql", 10485761],
    ["mysql", 16384],
    ["sqlserver", 4001],
  ] as const)(
    "maps varchar beyond the limit to text for each dialect: %s",
    (dialect, length) => {
      expect(resolve(dialect, { kind: "varchar", length })).toStrictEqual({
        type: { kind: "text" },
        diagnostics: [{ code: "type-parameter-out-of-range", path: TYPE_PATH }],
      });
    },
  );

  it.each([
    ["postgresql", 1001, 1001, 1000, 1000],
    ["mysql", 70, 40, 65, 30],
    ["mysql", 30, 31, 30, 30],
    ["mysql", 66, 10, 65, 10],
    ["sqlserver", 50, 45, 38, 38],
    ["sqlserver", 40, 20, 38, 20],
  ] as const)(
    "clamps decimal precision and scale to each dialect limit: %s decimal(%i, %i)",
    (dialect, precision, scale, clampedPrecision, clampedScale) => {
      expect(
        resolve(dialect, { kind: "decimal", precision, scale }),
      ).toStrictEqual({
        type: {
          kind: "decimal",
          precision: clampedPrecision,
          scale: clampedScale,
        },
        diagnostics: [{ code: "type-parameter-out-of-range", path: TYPE_PATH }],
      });
    },
  );

  it("reports type-parameter-out-of-range at the column type path", () => {
    expect(
      resolve("sqlserver", { kind: "varchar", length: 5000 }).diagnostics,
    ).toStrictEqual([{ code: "type-parameter-out-of-range", path: TYPE_PATH }]);
  });

  it("keeps text in a PostgreSQL key column", () => {
    expect(resolve("postgresql", { kind: "text" }, true)).toStrictEqual({
      type: { kind: "text" },
      diagnostics: [],
    });
  });

  it.each([
    ["mysql", 255],
    ["sqlserver", 450],
  ] as const)(
    "narrows text in a key column to 255 on MySQL and 450 on SQL Server: %s",
    (dialect, length) => {
      expect(resolve(dialect, { kind: "text" }, true)).toStrictEqual({
        type: { kind: "keyText", length },
        diagnostics: [{ code: "key-column-type-narrowed", path: TYPE_PATH }],
      });
    },
  );

  it("keeps text outside a key column on MySQL", () => {
    expect(resolve("mysql", { kind: "text" })).toStrictEqual({
      type: { kind: "text" },
      diagnostics: [],
    });
  });

  it("narrows an out-of-range varchar key column to nvarchar(450) on SQL Server and reports both diagnostics", () => {
    const result = resolve(
      "sqlserver",
      { kind: "varchar", length: 5000 },
      true,
    );

    expect(result.type).toStrictEqual({ kind: "keyText", length: 450 });
    expect(codesOf(result).toSorted()).toStrictEqual([
      "key-column-type-narrowed",
      "type-parameter-out-of-range",
    ]);
  });

  it("ignores the fixed-length narrowing for a varchar column", () => {
    expect(
      resolve("sqlserver", { kind: "varchar", length: 20 }, true, true),
    ).toStrictEqual({ type: { kind: "varchar", length: 20 }, diagnostics: [] });
  });

  it("marks a custom type with an unsafe name", () => {
    expect(
      resolve("postgresql", { kind: "custom", name: "int; drop table x" }),
    ).toStrictEqual({
      type: { kind: "custom", name: "int; drop table x", isSafe: false },
      diagnostics: [],
    });
  });

  it("marks a custom type with a safe name", () => {
    expect(
      resolve("mysql", { kind: "custom", name: "YEAR" }).type,
    ).toStrictEqual({ kind: "custom", name: "YEAR", isSafe: true });
  });
});

describe("mysqlKeyPartBytes", () => {
  it.each<[DialectColumnType, number]>([
    [{ kind: "varchar", length: 10 }, 40],
    [{ kind: "char", length: 10 }, 40],
    [{ kind: "keyText", length: 255 }, 1020],
    [{ kind: "uuid" }, 144],
    [{ kind: "custom", name: "YEAR", isSafe: true }, 0],
    [{ kind: "bigint" }, 32],
  ])("counts MySQL key part bytes by type: %o", (type, bytes) => {
    expect(mysqlKeyPartBytes(type)).toBe(bytes);
  });
});

describe("sqlServerFixedKeyBytes", () => {
  it.each<[DialectColumnType, number]>([
    [{ kind: "char", length: 500 }, 1000],
    [{ kind: "uuid" }, 16],
    [{ kind: "varchar", length: 500 }, 0],
    [{ kind: "keyText", length: 450 }, 0],
    [{ kind: "text" }, 0],
    [{ kind: "json" }, 0],
    [{ kind: "binary" }, 0],
    [{ kind: "enum", enumId: "enum_status" }, 0],
    [{ kind: "custom", name: "money", isSafe: true }, 0],
    [{ kind: "decimal", precision: 38, scale: 2 }, 17],
    [{ kind: "integer" }, 17],
  ])("counts SQL Server fixed key bytes by type: %o", (type, bytes) => {
    expect(sqlServerFixedKeyBytes(type)).toBe(bytes);
  });
});
