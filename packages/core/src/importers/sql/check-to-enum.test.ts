import { describe, expect, it } from "vitest";

import type { SqlDialect } from "../../generators/shared/generator-types.js";
import { readCheckEnumValues } from "./check-to-enum.js";

type Case = readonly [dialect: SqlDialect, expression: string];

describe("readCheckEnumValues", () => {
  it.each<Case>([
    ["postgresql", "status IN ('active', 'blocked')"],
    ["postgresql", "((status)::text IN ('active'::text, 'blocked'::text))"],
    ["postgresql", `("Status"::text IN ('active', 'blocked'))`],
    [
      "postgresql",
      "status::character varying(20) IN ('active'::character varying(20), 'blocked')",
    ],
    ["sqlserver", "([status] IN (N'active', N'blocked'))"],
    ["sqlserver", "[status] in ('active','blocked')"],
    ["mysql", "(`status` in (_utf8mb4'active',_utf8mb4'blocked'))"],
    ["mysql", "`STATUS` IN ('active', 'blocked')"],
  ])("reads values of an in check in %s: %s", (dialect, expression) => {
    expect(
      readCheckEnumValues({ expression, columnName: "status", dialect }),
    ).toStrictEqual(["active", "blocked"]);
  });

  it("keeps escaped quotes and the order of the values", () => {
    expect(
      readCheckEnumValues({
        expression: "kind IN ('it''s', 'a', 'b')",
        columnName: "kind",
        dialect: "postgresql",
      }),
    ).toStrictEqual(["it's", "a", "b"]);
  });

  it.each<Case>([
    ["postgresql", "other IN ('a', 'b')"],
    ["postgresql", "status_2 IN ('a')"],
  ])(
    "returns null for a check on another column: %s",
    (dialect, expression) => {
      expect(
        readCheckEnumValues({ expression, columnName: "status", dialect }),
      ).toBeNull();
    },
  );

  it.each<Case>([
    ["postgresql", "status > 0"],
    ["postgresql", "status = 'a'"],
    ["postgresql", "status NOT IN ('a', 'b')"],
    ["postgresql", "status IN ('a', 1)"],
    ["postgresql", "status IN ('a', 'b') AND status <> 'c'"],
    ["postgresql", "status IN ('a' 'b')"],
    ["postgresql", "status IN ('a',)"],
    ["postgresql", "status IN (SELECT name FROM s)"],
    ["postgresql", "status IN ('a')::text"],
    ["postgresql", "status::"],
    ["postgresql", "lower(status) IN ('a')"],
    ["postgresql", "status IN ('a', 'b'"],
    ["postgresql", "status IN 'a'"],
    ["postgresql", "'unterminated"],
  ])("returns null for a comparison check: %s", (dialect, expression) => {
    expect(
      readCheckEnumValues({ expression, columnName: "status", dialect }),
    ).toBeNull();
  });

  it.each<Case>([
    ["postgresql", "status IN ()"],
    ["sqlserver", "([status] IN ())"],
  ])("returns null for an empty list: %s", (dialect, expression) => {
    expect(
      readCheckEnumValues({ expression, columnName: "status", dialect }),
    ).toBeNull();
  });
});
