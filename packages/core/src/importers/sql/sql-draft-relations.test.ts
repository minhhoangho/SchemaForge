import { describe, expect, it } from "vitest";

import type { RelationKind } from "../../model/relation.js";
import type { CoreRef } from "../shared/dbml-core-adapter-types.js";
import type {
  DraftColumn,
  DraftIndex,
  DraftTable,
} from "../shared/import-draft.js";
import type { SqlElementLocations } from "./sql-element-locations.js";
import { translateRefs } from "./sql-draft-relations.js";

const NO_LOCATIONS: SqlElementLocations = {
  at: () => ({ line: 1, column: 1 }),
  table: () => null,
  column: () => null,
  tableDefinition: () => null,
  columnDefinition: () => null,
  foreignKey: () => null,
  check: () => null,
};

function column(name: string, isUnique: boolean): DraftColumn {
  return {
    name,
    type: { kind: "integer" },
    isNullable: false,
    isUnique,
    isAutoIncrement: false,
    defaultValue: null,
    comment: "",
    location: null,
  };
}

function table(
  name: string,
  columns: readonly DraftColumn[],
  primaryKeyColumnNames: readonly string[],
): DraftTable {
  return {
    name,
    comment: "",
    subjectAreaName: null,
    columns,
    primaryKeyColumnNames,
    location: null,
  };
}

function uniqueIndex(columnNames: readonly string[]): DraftIndex {
  return {
    tableName: "T",
    name: null,
    columnNames,
    isUnique: true,
    location: null,
  };
}

function ref(fromColumnNames: readonly string[]): CoreRef {
  return {
    name: null,
    color: null,
    endpoints: [
      {
        schemaName: null,
        tableName: "t",
        columnNames: fromColumnNames,
        relation: "*",
      },
      {
        schemaName: null,
        tableName: "u",
        columnNames: fromColumnNames.map(() => "id"),
        relation: "1",
      },
    ],
    onDelete: null,
    onUpdate: null,
    token: null,
  };
}

function kindsOf(
  refs: readonly CoreRef[],
  tables: readonly DraftTable[],
  indexes: readonly DraftIndex[],
): readonly RelationKind[] {
  return translateRefs({
    refs,
    tables,
    indexes,
    locations: NO_LOCATIONS,
  }).relations.map(({ kind }) => kind);
}

describe("translateRefs", () => {
  it("makes a foreign key one-to-one when its columns are the primary key, a unique column or a unique index", () => {
    const tables = [
      table("t", [column("a", false), column("B", true)], ["b", "a"]),
    ];
    const indexes = [uniqueIndex(["A", "c"])];

    expect(
      kindsOf(
        [ref(["a", "b"]), ref(["b"]), ref(["c", "a"]), ref(["a"]), ref(["c"])],
        tables,
        indexes,
      ),
    ).toStrictEqual([
      "oneToOne",
      "oneToOne",
      "oneToOne",
      "oneToMany",
      "oneToMany",
    ]);
  });

  it("keeps a foreign key that repeats a column one-to-one with a wider unique key of its length", () => {
    const tables = [table("t", [], [])];
    const indexes = [uniqueIndex(["a", "b", "c"])];

    expect(
      kindsOf([ref(["a", "a", "b"]), ref(["a", "a", "d"])], tables, indexes),
    ).toStrictEqual(["oneToOne", "oneToMany"]);
  });

  // Counts the reads of the table's columns and unique indexes instead of
  // timing: a scan per foreign key reads them foreign keys x columns times.
  it("reads the columns and unique indexes a number of times linear in their count however many foreign keys there are", () => {
    const columnCount = 1000;
    const names = Array.from(
      { length: columnCount },
      (_, position) => `c${String(position)}`,
    );
    let reads = 0;
    const count = <Element extends object>(element: Element): Element =>
      new Proxy(element, {
        get: (target, key, receiver): unknown => {
          reads += 1;
          return Reflect.get(target, key, receiver);
        },
      });
    const tables = [
      table(
        "t",
        count(names.map((name, position) => column(name, position % 2 === 0))),
        ["id"],
      ),
    ];
    const indexes = names
      .filter((_, position) => position % 2 === 1)
      .map((name) => count(uniqueIndex([name.toUpperCase()])));

    expect(
      new Set(
        kindsOf(
          names.map((name) => ref([name])),
          tables,
          indexes,
        ),
      ),
    ).toStrictEqual(new Set(["oneToOne"]));
    expect(reads).toBeLessThan(columnCount * 10);
  });
});
