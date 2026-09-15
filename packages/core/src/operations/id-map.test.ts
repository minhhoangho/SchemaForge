import { describe, expect, it } from "vitest";

import type { TableId } from "../model/ids.js";
import type { IdMap } from "../model/schema-document.js";
import type { Table } from "../model/table.js";
import { makeTable } from "../testing/factories.js";
import { withEntry, withoutIds } from "./id-map.js";

describe("withEntry", () => {
  it("adds an entry without changing the original map", () => {
    const table = makeTable({ id: "tbl_1" });
    const map: IdMap<TableId, Table> = {};

    const result = withEntry(map, "tbl_1", table);

    expect(map).toStrictEqual({});
    expect(result).toStrictEqual({ tbl_1: table });
  });

  it("replaces an existing entry", () => {
    const original = makeTable({ id: "tbl_1", name: "old" });
    const replacement = makeTable({ id: "tbl_1", name: "new" });
    const map = { tbl_1: original };

    const result = withEntry(map, "tbl_1", replacement);

    expect(result).toStrictEqual({ tbl_1: replacement });
  });
});

describe("withoutIds", () => {
  it("removes every listed id and keeps the others", () => {
    const first = makeTable({ id: "tbl_1" });
    const second = makeTable({ id: "tbl_2" });
    const third = makeTable({ id: "tbl_3" });
    const map = { tbl_1: first, tbl_2: second, tbl_3: third };

    const result = withoutIds(map, ["tbl_1", "tbl_3"]);

    expect(result).toStrictEqual({ tbl_2: second });
  });

  it("returns an equal map when no listed id exists", () => {
    const table = makeTable({ id: "tbl_1" });
    const map = { tbl_1: table };

    const result = withoutIds(map, ["tbl_missing"]);

    expect(result).toStrictEqual(map);
  });
});
