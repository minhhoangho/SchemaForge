import { describe, expect, it } from "vitest";

import type { Column } from "../../model/column.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import { createImportTestOptions } from "../../testing/import-test-options.js";
import { unwrapError, unwrapOk } from "../../testing/unwrap-result.js";
import type { ImportSuccess } from "../shared/import-types.js";
import {
  MAX_IMPORTED_ELEMENTS,
  MAX_IMPORT_SOURCE_LENGTH,
} from "../shared/import-limits.js";
import { DBDIAGRAM_FIXTURE } from "./fixtures/dbdiagram.fixture.js";
import { DBML_FEATURES_FIXTURE } from "./fixtures/dbml-features.fixture.js";
import { importDbml } from "./import-dbml.js";

// @dbml/core parses a few thousand lines per second; a loaded machine is slower.
const PARSE_TIMEOUT = { timeout: 60_000 };

function importSource(source: string): ImportSuccess {
  return unwrapOk(importDbml(source, createImportTestOptions()));
}

function importDocument(source: string): SchemaDocument {
  return importSource(source).document;
}

type ColumnView = Omit<Column, "id" | "tableId">;

function columnViews(document: SchemaDocument): readonly ColumnView[] {
  return Object.values(document.columns).map((column) => ({
    name: column.name,
    type: column.type,
    isNullable: column.isNullable,
    defaultValue: column.defaultValue,
    isUnique: column.isUnique,
    isAutoIncrement: column.isAutoIncrement,
    comment: column.comment,
  }));
}

function onlyColumn(source: string): ColumnView {
  const [column] = columnViews(importDocument(source));
  return column ?? expect.fail("the source has no column");
}

function columnDefault(type: string, setting: string): Column["defaultValue"] {
  return onlyColumn(`Table t {\n  c ${type} [${setting}]\n}\n`).defaultValue;
}

function relationViews(document: SchemaDocument): readonly unknown[] {
  return Object.values(document.relations).map((relation) => ({
    kind: relation.kind,
    from: document.tables[relation.fromTableId]?.name,
    to: document.tables[relation.toTableId]?.name,
    columnPairs: relation.columnPairs.map((pair) => [
      document.columns[pair.fromColumnId]?.name,
      document.columns[pair.toColumnId]?.name,
    ]),
    onDelete: relation.onDelete,
    onUpdate: relation.onUpdate,
  }));
}

function primaryKeyNames(document: SchemaDocument): readonly unknown[] {
  return Object.values(document.tables).map((table) =>
    table.primaryKeyColumnIds.map((id) => document.columns[id]?.name),
  );
}

const TWO_TABLES = `Table a {
  id int [pk]
  b_id int
}
Table b {
  id int [pk]
}
`;

describe("importDbml", PARSE_TIMEOUT, () => {
  describe("project", () => {
    it("names the document after the Project", () => {
      expect(importDocument('Project "Shop" {\n}\n').name).toBe("Shop");
    });

    it("uses the fallback name without a Project", () => {
      expect(importDocument("Table t {\n  id int\n}\n").name).toBe("Imported");
    });

    it("reads native type names with the database_type of the Project", () => {
      const source = `Project p {\n  database_type: 'MySQL'\n}\nTable t {\n  flag tinyint(1)\n}\n`;

      expect(onlyColumn(source).type).toStrictEqual({ kind: "boolean" });
    });

    it("drops the note of the Project with comment-dropped", () => {
      const result = importSource(
        `Project p {\n  Note: 'about'\n}\nTable t {\n  id int\n}\n`,
      );

      expect(result.diagnostics).toStrictEqual([
        { code: "comment-dropped", location: null, path: null },
      ]);
    });
  });

  describe("tables and columns", () => {
    it("imports a table with its note as comment and ignores the alias", () => {
      const document = importDocument(
        "Table users as U {\n  id int\n  Note: 'People'\n}\n",
      );

      expect(
        Object.values(document.tables).map(({ name, comment }) => ({
          name,
          comment,
        })),
      ).toStrictEqual([{ name: "users", comment: "People" }]);
    });

    it("drops a schema other than public with namespace-dropped", () => {
      const result = importSource(
        "Table public.a {\n  id int\n}\nTable sales.b {\n  id int\n}\n",
      );

      expect({
        names: Object.values(result.document.tables).map(({ name }) => name),
        diagnostics: result.diagnostics,
      }).toStrictEqual({
        names: ["a", "b"],
        diagnostics: [
          {
            code: "namespace-dropped",
            location: { line: 4, column: 1 },
            path: ["tables", "tbl_2"],
          },
        ],
      });
    });

    it("drops headercolor with color-dropped", () => {
      const result = importSource(
        "Table t [headercolor: #3498DB] {\n  id int\n}\n",
      );

      expect(result.diagnostics).toStrictEqual([
        {
          code: "color-dropped",
          location: { line: 1, column: 1 },
          path: ["tables", "tbl_1"],
        },
      ]);
    });

    it.each([
      {
        setting: "pk",
        expected: { isNullable: false, isAutoIncrement: false },
      },
      {
        setting: "increment",
        expected: { isNullable: true, isAutoIncrement: true },
      },
      {
        setting: "not null",
        expected: { isNullable: false, isAutoIncrement: false },
      },
      {
        setting: "null",
        expected: { isNullable: true, isAutoIncrement: false },
      },
    ])(
      "maps the column setting $setting to the column flags",
      ({ setting, expected }) => {
        const column = onlyColumn(`Table t {\n  c int [${setting}]\n}\n`);

        expect({
          isNullable: column.isNullable,
          isAutoIncrement: column.isAutoIncrement,
        }).toStrictEqual(expected);
      },
    );

    it("imports unique and note on a column", () => {
      expect(
        onlyColumn("Table t {\n  c int [unique, note: 'Code']\n}\n"),
      ).toStrictEqual({
        name: "c",
        type: { kind: "integer" },
        isNullable: true,
        defaultValue: null,
        isUnique: true,
        isAutoIncrement: false,
        comment: "Code",
      });
    });

    it("makes a single pk column the primary key", () => {
      expect(
        primaryKeyNames(
          importDocument("Table t {\n  a int\n  b int [pk]\n}\n"),
        ),
      ).toStrictEqual([["b"]]);
    });

    it("drops a column check with check-constraint-not-supported", () => {
      const result = importSource("Table t {\n  a int [check: `a > 0`]\n}\n");

      expect(result.diagnostics).toStrictEqual([
        {
          code: "check-constraint-not-supported",
          location: { line: 2, column: 10 },
          path: null,
        },
      ]);
    });

    it("drops a checks block with check-constraint-not-supported", () => {
      const result = importSource(
        "Table t {\n  a int\n  checks {\n    `a > 0`\n  }\n}\n",
      );

      expect(result.diagnostics).toStrictEqual([
        {
          code: "check-constraint-not-supported",
          location: { line: 4, column: 5 },
          path: null,
        },
      ]);
    });
  });

  describe("types", () => {
    it.each([
      { type: '"status"', expected: { kind: "enum", enumId: "enum_1" } },
      { type: "status", expected: { kind: "enum", enumId: "enum_1" } },
      { type: '"tsvector"', expected: { kind: "custom", name: "tsvector" } },
      { type: "int4", expected: { kind: "integer" } },
      { type: "tsvector", expected: { kind: "custom", name: "tsvector" } },
    ])("maps the column type $type", ({ type, expected }) => {
      const source = `Enum status {\n  a\n}\nTable t {\n  c ${type}\n}\n`;

      expect(onlyColumn(source).type).toStrictEqual(expected);
    });

    it("distinguishes quoted and unquoted types with a generic type name", () => {
      const document = importDocument(
        'Table t {\n  "quoted" "varchar(255)"\n  plain varchar(255)\n}\n',
      );

      expect(columnViews(document).map(({ type }) => type)).toStrictEqual([
        { kind: "custom", name: "varchar(255)" },
        { kind: "varchar", length: 255 },
      ]);
    });

    it("keeps an unquoted array type as custom", () => {
      expect(onlyColumn("Table t {\n  c int[]\n}\n").type).toStrictEqual({
        kind: "custom",
        name: "int[]",
      });
    });

    it("maps an unsafe unquoted type to text with type-not-supported", () => {
      const result = importSource("Table t {\n  c varchar(-1)\n}\n");

      expect({
        type: columnViews(result.document)[0]?.type,
        diagnostics: result.diagnostics,
      }).toStrictEqual({
        type: { kind: "text" },
        diagnostics: [
          {
            code: "type-not-supported",
            location: { line: 2, column: 3 },
            path: ["columns", "col_2", "type"],
          },
        ],
      });
    });
  });

  describe("defaults", () => {
    it.each([
      { type: "text", setting: "default: 'it\\'s'", expected: "it's" },
      { type: "integer", setting: "default: -5", expected: "-5" },
      { type: "real", setting: "default: 1.5e10", expected: "1.5e10" },
      { type: "decimal(4,2)", setting: "default: 1.50", expected: "1.50" },
      { type: "boolean", setting: "default: true", expected: "true" },
      { type: "boolean", setting: "default: false", expected: "false" },
    ])(
      "keeps the default $setting as a literal with the source text",
      ({ type, setting, expected }) => {
        expect(columnDefault(type, setting)).toStrictEqual({
          kind: "literal",
          value: expected,
        });
      },
    );

    it("keeps the large numeric default 12345678901234567890.123", () => {
      expect(
        columnDefault("decimal(30,3)", "default: 12345678901234567890.123"),
      ).toStrictEqual({ kind: "literal", value: "12345678901234567890.123" });
    });

    it("reads no default from default: null", () => {
      expect(columnDefault("text", "default: null")).toBeNull();
    });

    it.each([
      {
        type: "timestamptz",
        setting: "default: `now()`",
        expected: { kind: "currentTimestamp" },
      },
      {
        type: "uuid",
        setting: "default: `gen_random_uuid()`",
        expected: { kind: "generateUuid" },
      },
      {
        type: "uuid",
        setting: "default: `newid()`",
        expected: { kind: "generateUuid" },
      },
    ])(
      "maps the expression default $setting",
      ({ type, setting, expected }) => {
        expect(columnDefault(type, setting)).toStrictEqual(expected);
      },
    );

    it("drops another expression default with default-not-supported", () => {
      const result = importSource(
        "Table t {\n  c int [default: `random()`]\n}\n",
      );

      expect({
        defaultValue: columnViews(result.document)[0]?.defaultValue,
        diagnostics: result.diagnostics,
      }).toStrictEqual({
        defaultValue: null,
        diagnostics: [
          {
            code: "default-not-supported",
            location: { line: 2, column: 3 },
            path: ["columns", "col_2", "defaultValue"],
          },
        ],
      });
    });

    it("turns a nextval default into auto increment", () => {
      const result = importSource(
        "Table t {\n  c int [default: `nextval('t_c_seq')`]\n}\n",
      );

      expect({
        isAutoIncrement: columnViews(result.document)[0]?.isAutoIncrement,
        diagnostics: result.diagnostics,
      }).toStrictEqual({
        isAutoIncrement: true,
        diagnostics: [
          {
            code: "sequence-default-as-auto-increment",
            location: { line: 2, column: 3 },
            path: ["columns", "col_2", "isAutoIncrement"],
          },
        ],
      });
    });
  });

  describe("indexes", () => {
    it("makes a pk index the primary key in its column order", () => {
      const document = importDocument(
        "Table t {\n  a int\n  b int\n  indexes {\n    (b, a) [pk]\n  }\n}\n",
      );

      expect({
        primaryKey: primaryKeyNames(document),
        nullable: columnViews(document).map(({ isNullable }) => isNullable),
        indexes: Object.keys(document.indexes),
      }).toStrictEqual({
        primaryKey: [["b", "a"]],
        nullable: [false, false],
        indexes: [],
      });
    });

    it("imports a named unique index and names an unnamed index", () => {
      const document = importDocument(
        "Table t {\n  a int\n  b int\n  indexes {\n    (a, b) [unique, name: 'ab_key']\n    b\n  }\n}\n",
      );

      expect(
        Object.values(document.indexes).map(
          ({ name, isUnique, columnIds }) => ({
            name,
            isUnique,
            columns: columnIds.map((id) => document.columns[id]?.name),
          }),
        ),
      ).toStrictEqual([
        { name: "ab_key", isUnique: true, columns: ["a", "b"] },
        { name: "t_b_idx", isUnique: false, columns: ["b"] },
      ]);
    });

    it("keeps an index of type btree without a diagnostic", () => {
      const result = importSource(
        "Table t {\n  a int\n  indexes {\n    a [type: btree]\n  }\n}\n",
      );

      expect(result.diagnostics).toStrictEqual([]);
    });

    it("keeps an index of another type with index-type-dropped", () => {
      const result = importSource(
        "Table t {\n  a int\n  indexes {\n    a [type: hash]\n  }\n}\n",
      );

      expect({
        indexes: Object.keys(result.document.indexes),
        diagnostics: result.diagnostics,
      }).toStrictEqual({
        indexes: ["idx_3"],
        diagnostics: [
          {
            code: "index-type-dropped",
            location: { line: 4, column: 5 },
            path: ["indexes", "idx_3"],
          },
        ],
      });
    });

    it("drops an index with an expression column with index-expression-not-supported", () => {
      const result = importSource(
        "Table t {\n  a int\n  indexes {\n    (a, `lower(a)`)\n  }\n}\n",
      );

      expect({
        indexes: Object.keys(result.document.indexes),
        diagnostics: result.diagnostics,
      }).toStrictEqual({
        indexes: [],
        diagnostics: [
          {
            code: "index-expression-not-supported",
            location: { line: 4, column: 5 },
            path: null,
          },
        ],
      });
    });

    it("drops the note of an index with comment-dropped", () => {
      const result = importSource(
        "Table t {\n  a int\n  indexes {\n    a [note: 'Lookup']\n  }\n}\n",
      );

      expect(result.diagnostics).toStrictEqual([
        {
          code: "comment-dropped",
          location: { line: 4, column: 5 },
          path: ["indexes", "idx_3"],
        },
      ]);
    });

    it("drops the type, name and note of a pk index on the primary key", () => {
      const result = importSource(
        "Table t {\n  a int\n  indexes {\n    a [pk, type: hash, name: 'pk_t', note: 'Key']\n  }\n}\n",
      );

      const path = ["tables", "tbl_1", "primaryKeyColumnIds"];
      expect(result.diagnostics).toStrictEqual([
        { code: "comment-dropped", location: { line: 4, column: 5 }, path },
        {
          code: "index-option-dropped",
          location: { line: 4, column: 5 },
          path,
        },
        { code: "index-type-dropped", location: { line: 4, column: 5 }, path },
      ]);
    });
    it("keeps the first pk index and drops other key definitions with index-option-dropped", () => {
      const result = importSource(
        "Table t {\n  a int [pk]\n  b int\n  indexes {\n    (a, b) [pk]\n    b [pk]\n  }\n}\n",
      );

      const path = ["tables", "tbl_1", "primaryKeyColumnIds"];
      expect({
        primaryKey: primaryKeyNames(result.document),
        diagnostics: result.diagnostics,
      }).toStrictEqual({
        primaryKey: [["a", "b"]],
        diagnostics: [
          {
            code: "index-option-dropped",
            location: { line: 2, column: 3 },
            path,
          },
          {
            code: "index-option-dropped",
            location: { line: 6, column: 5 },
            path,
          },
        ],
      });
    });

    it("drops a pk index with an expression column with index-expression-not-supported", () => {
      const result = importSource(
        "Table t {\n  a int [pk]\n  indexes {\n    (`lower(a)`) [pk]\n  }\n}\n",
      );

      expect({
        primaryKey: primaryKeyNames(result.document),
        diagnostics: result.diagnostics,
      }).toStrictEqual({
        primaryKey: [["a"]],
        diagnostics: [
          {
            code: "index-expression-not-supported",
            location: { line: 4, column: 5 },
            path: null,
          },
        ],
      });
    });
  });

  describe("relations", () => {
    it.each([
      {
        ref: "Ref: a.b_id > b.id",
        expected: { kind: "oneToMany", from: "a", to: "b" },
        pair: ["b_id", "id"],
      },
      {
        ref: "Ref: b.id < a.b_id",
        expected: { kind: "oneToMany", from: "a", to: "b" },
        pair: ["b_id", "id"],
      },
      {
        ref: "Ref: a.b_id - b.id",
        expected: { kind: "oneToOne", from: "a", to: "b" },
        pair: ["b_id", "id"],
      },
      {
        ref: "Ref: b.id - a.b_id",
        expected: { kind: "oneToOne", from: "b", to: "a" },
        pair: ["id", "b_id"],
      },
    ])("maps $ref", ({ ref, expected, pair }) => {
      expect(
        relationViews(importDocument(`${TWO_TABLES}${ref}\n`)),
      ).toStrictEqual([
        {
          ...expected,
          columnPairs: [pair],
          onDelete: "noAction",
          onUpdate: "noAction",
        },
      ]);
    });

    it.each([
      { setting: "ref: > b.id", kind: "oneToMany" },
      { setting: "ref: - b.id", kind: "oneToOne" },
    ])(
      "keeps the column with an inline $setting as the from side",
      ({ setting, kind }) => {
        const source = TWO_TABLES.replace("b_id int", `b_id int [${setting}]`);

        expect(relationViews(importDocument(source))).toStrictEqual([
          {
            kind,
            from: "a",
            to: "b",
            columnPairs: [["b_id", "id"]],
            onDelete: "noAction",
            onUpdate: "noAction",
          },
        ]);
      },
    );

    it("pairs the columns of a composite ref in order", () => {
      const source = `Table a {\n  x int\n  y int\n}\nTable b {\n  x int\n  y int\n}\nRef: a.(y, x) > b.(x, y)\n`;

      expect(relationViews(importDocument(source))).toStrictEqual([
        {
          kind: "oneToMany",
          from: "a",
          to: "b",
          columnPairs: [
            ["y", "x"],
            ["x", "y"],
          ],
          onDelete: "noAction",
          onUpdate: "noAction",
        },
      ]);
    });

    it.each([
      { keyword: "cascade", action: "cascade" },
      { keyword: "restrict", action: "restrict" },
      { keyword: "set null", action: "setNull" },
      { keyword: "set default", action: "setDefault" },
      { keyword: "no action", action: "noAction" },
    ])("maps the referential action $keyword", ({ keyword, action }) => {
      const source = `${TWO_TABLES}Ref: a.b_id > b.id [delete: ${keyword}, update: ${keyword}]\n`;
      const [relation] = Object.values(importDocument(source).relations);

      expect({
        onDelete: relation?.onDelete,
        onUpdate: relation?.onUpdate,
      }).toStrictEqual({ onDelete: action, onUpdate: action });
    });

    it("drops a many-to-many ref with many-to-many-not-supported", () => {
      const result = importSource(`${TWO_TABLES}Ref: a.b_id <> b.id\n`);

      expect({
        relations: Object.keys(result.document.relations),
        diagnostics: result.diagnostics,
      }).toStrictEqual({
        relations: [],
        diagnostics: [
          {
            code: "many-to-many-not-supported",
            location: { line: 8, column: 1 },
            path: null,
          },
        ],
      });
    });

    it("drops the color of a ref with color-dropped and ignores its name", () => {
      const result = importSource(
        `${TWO_TABLES}Ref fk_a_b: a.b_id > b.id [color: #79AD51]\n`,
      );

      expect(result.diagnostics).toStrictEqual([
        {
          code: "color-dropped",
          location: { line: 8, column: 1 },
          path: ["relations", "rel_6"],
        },
      ]);
    });
  });

  describe("enums, groups and notes", () => {
    it("imports an enum with its values in order", () => {
      const document = importDocument('Enum e {\n  b\n  "a c"\n  a\n}\n');

      expect(Object.values(document.enums)).toStrictEqual([
        { id: "enum_1", name: "e", values: ["b", "a c", "a"] },
      ]);
    });

    it("drops the notes of enum values with comment-dropped", () => {
      const result = importSource("Enum e {\n  a [note: 'First']\n}\n");

      expect(result.diagnostics).toStrictEqual([
        {
          code: "comment-dropped",
          location: { line: 1, column: 1 },
          path: ["enums", "enum_1"],
        },
      ]);
    });

    it("turns a TableGroup into a subject area of its tables", () => {
      const document = importDocument(
        `${TWO_TABLES}TableGroup "Core" {\n  b\n}\n`,
      );

      expect({
        areas: Object.values(document.subjectAreas),
        tables: Object.values(document.tables).map(
          ({ name, subjectAreaId }) => [name, subjectAreaId],
        ),
      }).toStrictEqual({
        areas: [{ id: "area_6", name: "Core" }],
        tables: [
          ["a", null],
          ["b", "area_6"],
        ],
      });
    });

    it("drops the color and note of a TableGroup", () => {
      const result = importSource(
        `${TWO_TABLES}TableGroup g [color: #79AD51, note: 'Group'] {\n  b\n}\n`,
      );

      const path = ["subjectAreas", "area_6"];
      expect(result.diagnostics).toStrictEqual([
        { code: "color-dropped", location: { line: 8, column: 1 }, path },
        { code: "comment-dropped", location: { line: 8, column: 1 }, path },
      ]);
    });

    it("imports a standalone note and drops its name", () => {
      const document = importDocument("Note intro {\n  'Read me'\n}\n");

      expect(
        Object.values(document.notes).map(({ id, text }) => ({ id, text })),
      ).toStrictEqual([{ id: "note_1", text: "Read me" }]);
    });

    it("ignores Records with data-statements-ignored", () => {
      const result = importSource(
        "Table t {\n  id int\n}\nrecords t(id) {\n  1\n}\n",
      );

      expect(result.diagnostics).toStrictEqual([
        {
          code: "data-statements-ignored",
          location: { line: 4, column: 1 },
          path: null,
        },
      ]);
    });
  });

  describe("fixtures", () => {
    it("imports the dbdiagram fixture", () => {
      const result = importSource(DBDIAGRAM_FIXTURE);

      expect({
        name: result.document.name,
        tables: Object.values(result.document.tables).map(({ name }) => name),
        columns: Object.keys(result.document.columns).length,
        relations: relationViews(result.document),
        indexes: Object.values(result.document.indexes).map(({ name }) => name),
        primaryKey: primaryKeyNames(result.document),
        diagnostics: result.diagnostics,
      }).toStrictEqual({
        name: "blog",
        tables: ["users", "posts", "follows"],
        columns: 13,
        relations: [
          {
            kind: "oneToMany",
            from: "posts",
            to: "users",
            columnPairs: [["user_id", "id"]],
            onDelete: "noAction",
            onUpdate: "noAction",
          },
          {
            kind: "oneToMany",
            from: "follows",
            to: "users",
            columnPairs: [["following_user_id", "id"]],
            onDelete: "noAction",
            onUpdate: "noAction",
          },
          {
            kind: "oneToMany",
            from: "follows",
            to: "users",
            columnPairs: [["followed_user_id", "id"]],
            onDelete: "noAction",
            onUpdate: "noAction",
          },
        ],
        indexes: ["posts_user_status", "posts_title_idx"],
        primaryKey: [["id"], ["id"], []],
        diagnostics: [],
      });
    });

    it("reports every dropped feature of the features fixture", () => {
      expect(importSource(DBML_FEATURES_FIXTURE).diagnostics).toStrictEqual([
        {
          code: "comment-dropped",
          location: { line: 5, column: 1 },
          path: ["enums", "enum_1"],
        },
        {
          code: "color-dropped",
          location: { line: 10, column: 1 },
          path: ["tables", "tbl_2"],
        },
        {
          code: "namespace-dropped",
          location: { line: 10, column: 1 },
          path: ["tables", "tbl_2"],
        },
        {
          code: "check-constraint-not-supported",
          location: { line: 12, column: 59 },
          path: null,
        },
        {
          code: "default-not-supported",
          location: { line: 13, column: 3 },
          path: ["columns", "col_6", "defaultValue"],
        },
        {
          code: "comment-dropped",
          location: { line: 16, column: 5 },
          path: ["indexes", "idx_9"],
        },
        {
          code: "index-type-dropped",
          location: { line: 16, column: 5 },
          path: ["indexes", "idx_9"],
        },
        {
          code: "index-expression-not-supported",
          location: { line: 17, column: 5 },
          path: null,
        },
        {
          code: "check-constraint-not-supported",
          location: { line: 20, column: 5 },
          path: null,
        },
        {
          code: "many-to-many-not-supported",
          location: { line: 28, column: 1 },
          path: null,
        },
        {
          code: "color-dropped",
          location: { line: 29, column: 1 },
          path: ["relations", "rel_10"],
        },
        {
          code: "color-dropped",
          location: { line: 31, column: 1 },
          path: ["subjectAreas", "area_11"],
        },
        {
          code: "comment-dropped",
          location: { line: 31, column: 1 },
          path: ["subjectAreas", "area_11"],
        },
        {
          code: "data-statements-ignored",
          location: { line: 39, column: 1 },
          path: null,
        },
        { code: "comment-dropped", location: null, path: null },
      ]);
    });
  });

  describe("failures and limits", () => {
    it("reports syntax errors at their dbml positions", () => {
      expect(
        unwrapError(
          importDbml("Table t {\n  id int\n", createImportTestOptions()),
        ),
      ).toStrictEqual({
        diagnostics: [
          {
            code: "syntax-error",
            location: { line: 3, column: 1 },
            path: null,
          },
        ],
      });
    });

    it("reports a syntax error at the start of a line as column 1", () => {
      expect(
        unwrapError(
          importDbml("Table t {\n  id int\n}\n}\n", createImportTestOptions()),
        ),
      ).toStrictEqual({
        diagnostics: [
          {
            code: "syntax-error",
            location: { line: 4, column: 1 },
            path: null,
          },
        ],
      });
    });

    it("accepts a source at exactly the length limit", () => {
      const source = "Table t {\n  id int\n}\n";
      const padded =
        source + " ".repeat(MAX_IMPORT_SOURCE_LENGTH - source.length);

      expect(importDbml(padded, createImportTestOptions()).isOk).toBe(true);
    });

    it("reports source-too-large one code unit over the limit", () => {
      expect(
        unwrapError(
          importDbml(
            " ".repeat(MAX_IMPORT_SOURCE_LENGTH + 1),
            createImportTestOptions(),
          ),
        ),
      ).toStrictEqual({
        diagnostics: [{ code: "source-too-large", location: null, path: null }],
      });
    });

    it("reports too-many-elements past the element limit", () => {
      const columns = Array.from(
        { length: MAX_IMPORTED_ELEMENTS },
        (_, index) => `  c${String(index)} int`,
      ).join("\n");

      expect(
        unwrapError(
          importDbml(`Table t {\n${columns}\n}\n`, createImportTestOptions()),
        ),
      ).toStrictEqual({
        diagnostics: [
          { code: "too-many-elements", location: null, path: null },
        ],
      });
    });

    it("imports tables named __proto__ and constructor", () => {
      const document = importDocument(
        'Table "__proto__" {\n  id int\n}\nTable "constructor" {\n  "__proto__" int\n}\n',
      );

      expect(
        Object.values(document.tables).map(({ name }) => name),
      ).toStrictEqual(["__proto__", "constructor"]);
    });
  });
});
