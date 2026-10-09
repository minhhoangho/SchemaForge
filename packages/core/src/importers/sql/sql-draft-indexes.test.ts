import { describe, expect, it } from "vitest";

import type { SqlDialect } from "../../generators/shared/generator-types.js";
import type { ForeignKeyColumns } from "../shared/implicit-foreign-key-index.js";
import type {
  CoreField,
  CoreIndex,
  CoreTable,
} from "../shared/dbml-core-adapter-types.js";
import type { SqlTableDefinition } from "./sql-column-definitions.js";
import type { SqlDraftContext } from "./sql-draft-context.js";
import { translateIndexes } from "./sql-draft-indexes.js";
import type { SqlIndexDefinition } from "./sql-index-definitions.js";
import type {
  SqlAddedUniqueConstraint,
  SqlTableKey,
  SqlUniqueConstraint,
} from "./sql-table-keys.js";

const INDEX_COUNT = 1000;
const POSITIONS = Array.from(
  { length: INDEX_COUNT },
  (_, position) => position,
);

function columnName(position: number): string {
  return `c${String(position)}`;
}

// Even positions are named, odd ones have no name.
function indexName(position: number): string | null {
  return position % 2 === 0 ? `i${String(position)}` : null;
}

function field(position: number, isIncrement: boolean): CoreField {
  return {
    name: columnName(position),
    typeName: "int",
    isPrimaryKey: false,
    isUnique: false,
    isNotNull: false,
    isIncrement,
    defaultValue: null,
    note: null,
    checks: [],
    token: null,
  };
}

function index(
  name: string | null,
  columnNames: readonly string[],
  isUnique: boolean,
): CoreIndex {
  return {
    name,
    columns: columnNames.map((value) => ({ value, isExpression: false })),
    isUnique,
    isPrimaryKey: false,
    type: null,
    note: null,
    token: null,
  };
}

function uniqueConstraint(position: number): SqlUniqueConstraint {
  return {
    name: `u${String(position)}`,
    columnNames: [columnName(position), columnName(position + 1)],
    isMysqlKey: false,
    hasDroppedElementOption: false,
  };
}

type Scenario = {
  readonly dialect: SqlDialect;
  readonly isIncrement: boolean;
  readonly indexes: readonly CoreIndex[];
  readonly definitions: readonly SqlIndexDefinition[];
  readonly keys: readonly SqlTableKey[];
  readonly uniqueConstraints: readonly SqlUniqueConstraint[];
  readonly added: readonly SqlAddedUniqueConstraint[];
  readonly foreignKeys: readonly ForeignKeyColumns[];
};

const NO_READS: Omit<Scenario, "dialect" | "isIncrement" | "indexes"> = {
  definitions: [],
  keys: [],
  uniqueConstraints: [],
  added: [],
  foreignKeys: [],
};

// The reads are listed in reverse, so a scan per index would walk past most.
const SCENARIOS: readonly (readonly [string, Scenario, readonly number[]])[] = [
  [
    "CREATE INDEX statements",
    {
      ...NO_READS,
      dialect: "postgresql",
      isIncrement: false,
      indexes: POSITIONS.map((p) =>
        index(indexName(p), [columnName(p)], false),
      ),
      definitions: POSITIONS.toReversed().map((p) => ({
        indexName: indexName(p),
        tableName: "t",
        start: p,
        isUnique: false,
        columnNames: [columnName(p)],
        hasDroppedElementOption: false,
        hasInclude: false,
        hasWhere: true,
        whereNotNullColumnNames: null,
      })),
    },
    [INDEX_COUNT, INDEX_COUNT],
  ],
  [
    "MySQL keys inside CREATE TABLE",
    {
      ...NO_READS,
      dialect: "mysql",
      isIncrement: false,
      indexes: POSITIONS.map((p) =>
        index(indexName(p), [columnName(p)], false),
      ),
      keys: POSITIONS.toReversed().map((p) => ({
        name: indexName(p),
        columnNames: [columnName(p)],
        kind: "fulltext",
        hasDroppedElementOption: false,
      })),
    },
    [INDEX_COUNT, INDEX_COUNT],
  ],
  [
    // Every index starts with the same column, so a scan of the keys that
    // start like the index would read them all for each index.
    "MySQL implicit indexes of foreign keys",
    {
      ...NO_READS,
      dialect: "mysql",
      isIncrement: false,
      indexes: POSITIONS.map((p) =>
        index(`f${String(p)}`, [columnName(0), columnName(p + 1)], false),
      ),
      foreignKeys: POSITIONS.toReversed().map((p) => ({
        name: `f${String(p)}`,
        columnNames: [columnName(0), columnName(p + 1)],
      })),
    },
    [0, 0],
  ],
  [
    "MySQL indexes of auto-increment columns",
    {
      ...NO_READS,
      dialect: "mysql",
      isIncrement: true,
      indexes: POSITIONS.map((p) =>
        index(`t_${columnName(p)}_idx`, [columnName(p)], false),
      ),
    },
    [0, 0],
  ],
  [
    "unique constraints in CREATE TABLE and ALTER TABLE",
    {
      ...NO_READS,
      dialect: "postgresql",
      isIncrement: false,
      indexes: POSITIONS.map((p) =>
        index(null, [columnName(p + 1), columnName(p)], true),
      ),
      uniqueConstraints: POSITIONS.toReversed()
        .filter((p) => p % 2 === 0)
        .map(uniqueConstraint),
      added: POSITIONS.toReversed()
        .filter((p) => p % 2 === 1)
        .map((p) => ({
          tableName: "t",
          start: p,
          constraint: uniqueConstraint(p),
        })),
    },
    [INDEX_COUNT, 0],
  ],
];

function counted<Element extends object>(
  element: Element,
  count: () => void,
): Element {
  return new Proxy(element, {
    get: (target, key, receiver): unknown => {
      count();
      return Reflect.get(target, key, receiver);
    },
  });
}

function contextOf(
  scenario: Scenario,
  table: CoreTable,
  count: () => void,
): SqlDraftContext {
  const created: SqlTableDefinition = {
    tableName: table.name,
    isQualified: false,
    start: 0,
    columns: [],
    uniqueConstraints: scenario.uniqueConstraints.map((u) => counted(u, count)),
    keys: scenario.keys.map((key) => counted(key, count)),
  };
  return {
    dialect: scenario.dialect,
    locations: {
      at: () => ({ line: 1, column: 1 }),
      table: () => null,
      column: () => null,
      tableDefinition: () => created,
      columnDefinition: () => null,
      foreignKey: () => null,
      check: () => null,
    },
    enumNameKeys: new Set(),
    inlineEnumNames: new Set(),
    overrides: { column: () => null, tableComment: () => null },
    indexDefinitions: new Map([
      ["t", scenario.definitions.map((d) => counted(d, count))],
    ]),
    addedUniqueConstraints: new Map([
      ["t", scenario.added.map((added) => counted(added, count))],
    ]),
    foreignKeys: new Map([
      ["t", scenario.foreignKeys.map((key) => counted(key, count))],
    ]),
    parts: { tables: [], indexes: [], enums: [], diagnostics: [] },
  };
}

describe("translateIndexes", () => {
  // Counts the reads of what the scanner read and of the table's fields and
  // indexes instead of timing: a scan per index reads them indexes x reads
  // times.
  it.each(SCENARIOS)(
    "reads %s a number of times linear in the index count",
    (_, scenario, [indexCount, diagnosticCount]) => {
      let reads = 0;
      const count = (): void => {
        reads += 1;
      };
      const table: CoreTable = {
        name: "t",
        schemaName: null,
        note: null,
        headerColor: null,
        fields: counted(
          [...POSITIONS, INDEX_COUNT].map((p) =>
            field(p, scenario.isIncrement),
          ),
          count,
        ),
        indexes: counted([...scenario.indexes], count),
        checks: [],
        token: null,
      };
      const context = contextOf(scenario, table, count);

      translateIndexes(table, 0, [], context);

      expect([
        context.parts.indexes.length,
        context.parts.diagnostics.length,
      ]).toStrictEqual([indexCount, diagnosticCount]);
      expect(reads).toBeLessThan(INDEX_COUNT * 30);
    },
  );
});
