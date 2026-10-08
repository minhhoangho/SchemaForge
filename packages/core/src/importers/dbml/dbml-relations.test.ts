import { describe, expect, it } from "vitest";

import type {
  CoreRef,
  CoreTable,
  CoreToken,
} from "../shared/dbml-core-adapter-types.js";
import { translateRefs } from "./dbml-relations.js";

function token(startLine: number, endLine: number): CoreToken {
  return {
    start: { line: startLine, column: 1 },
    end: { line: endLine, column: 2 },
  };
}

function table(name: string, tableToken: CoreToken | null): CoreTable {
  return {
    name,
    schemaName: null,
    note: null,
    headerColor: null,
    fields: [],
    indexes: [],
    checks: [],
    token: tableToken,
  };
}

// `-` keeps the written order outside a table and swaps it inside one.
function oneToOneRef(refToken: CoreToken | null): CoreRef {
  return {
    name: null,
    color: null,
    endpoints: [
      { schemaName: null, tableName: "a", columnNames: ["id"], relation: "1" },
      { schemaName: null, tableName: "b", columnNames: ["id"], relation: "1" },
    ],
    onDelete: null,
    onUpdate: null,
    token: refToken,
  };
}

function fromTableNames(
  refs: readonly CoreRef[],
  tables: readonly CoreTable[],
): readonly string[] {
  return translateRefs(refs, tables).relations.map(
    ({ fromTableName }) => fromTableName,
  );
}

describe("translateRefs", () => {
  it("treats a ref inside any table as inline whatever the order of the tables", () => {
    const tables = [
      table("late", token(20, 30)),
      table("none", null),
      table("early", token(1, 10)),
    ];
    const refs = [
      oneToOneRef(token(5, 5)),
      oneToOneRef(token(25, 25)),
      oneToOneRef(token(15, 15)),
      oneToOneRef(token(30, 31)),
      oneToOneRef(null),
    ];

    expect(fromTableNames(refs, tables)).toStrictEqual([
      "b",
      "b",
      "a",
      "a",
      "a",
    ]);
  });

  it("treats a ref inside a table that ends after a later table as inline", () => {
    const tables = [
      table("outer", token(1, 50)),
      table("inner", token(10, 20)),
    ];

    expect(fromTableNames([oneToOneRef(token(30, 30))], tables)).toStrictEqual([
      "b",
    ]);
  });

  // Counts the reads of table tokens instead of timing: a scan of every
  // table per ref reads them tables x refs times.
  it("reads the table tokens a number of times linear in their count however many refs there are", () => {
    const tableCount = 2000;
    let tokenReads = 0;
    const tables = Array.from({ length: tableCount }, (_, position) => {
      const line = position * 10 + 1;
      return new Proxy(table(`t${String(position)}`, token(line, line + 5)), {
        get: (target, key, receiver): unknown => {
          tokenReads += key === "token" ? 1 : 0;
          return Reflect.get(target, key, receiver);
        },
      });
    });
    const refs = Array.from({ length: tableCount }, (_, position) => {
      const line = position * 10 + 3;
      return oneToOneRef(token(line, line));
    });

    expect(new Set(fromTableNames(refs, tables))).toStrictEqual(new Set(["b"]));
    expect(tokenReads).toBeLessThan(tableCount * 10);
  });
});
