// Specification tests for the @dbml/core behavior that the sql and dbml importers rely
// on (import / export plan, Task 8). Each test records what 10.2.0 does today, so an
// upgrade that changes the behavior turns a test red.
import { Parser } from "@dbml/core";
import type { Database, Field, Table } from "@dbml/core";
import { describe, expect, it } from "vitest";

type SqlFormat = "postgres" | "mysql" | "mssql";

const SQL_FORMATS: readonly SqlFormat[] = ["postgres", "mysql", "mssql"];

// The ANTLR sql parsers, mssql above all, take up to a second per call and far more
// on a loaded machine; the shared 5 s test timeout is too tight for them.
const SQL_PARSE_TIMEOUT = { timeout: 30_000 };

function captureThrown(run: () => unknown): unknown {
  try {
    run();
  } catch (error: unknown) {
    return error;
  }
  return undefined;
}

function tablesOf(database: Database): readonly Table[] {
  return database.schemas.flatMap((schema) => schema.tables);
}

function fieldsOf(
  source: string,
  format: SqlFormat | "dbmlv2",
): readonly Field[] {
  return tablesOf(Parser.parse(source, format)).flatMap(
    (table) => table.fields,
  );
}

describe("syntax errors (probe point 1)", SQL_PARSE_TIMEOUT, () => {
  it.each([
    { format: "postgres", source: "CREATE TABLE a (id int);\nfoo bar;\n" },
    { format: "mysql", source: "CREATE TABLE a (id int);\nfoo bar;\n" },
    { format: "mssql", source: "CREATE TABLE a (id int);\n) x;\n" },
  ] as const)(
    "throws diags with a 0-based column for an error at the start of a line in $format",
    ({ format, source }) => {
      const thrown = captureThrown(() => Parser.parse(source, format));

      expect(thrown).not.toBeInstanceOf(Error);
      expect(thrown).toMatchObject({
        diags: [{ location: { start: { line: 2, column: 0 } } }],
      });
      expect(thrown).toHaveProperty(["diags", 0, "text"]);
    },
  );

  it("accepts an unknown mssql statement at the start of a line without an error", () => {
    expect(
      tablesOf(Parser.parse("CREATE TABLE a (id int);\nfoo bar;\n", "mssql")),
    ).toHaveLength(1);
  });

  it("throws diags with 1-based lines and columns for dbmlv2", () => {
    const thrown = captureThrown(() =>
      Parser.parse("Table a {\n  id int\n}\nfoo bar\n", "dbmlv2"),
    );

    expect(thrown).toHaveProperty(
      "diags",
      expect.arrayContaining([
        expect.objectContaining({
          code: 3062,
          location: {
            start: { line: 4, column: 1 },
            end: { line: 4, column: 8 },
          },
        }),
      ]),
    );
    expect(thrown).toHaveProperty(["diags", 0, "message"]);
  });

  it.each(["postgres", "mysql"] as const)(
    "wraps an internal %s failure as an Error entry without a location",
    (format) => {
      const thrown = captureThrown(() =>
        Parser.parse("CREATE TABLE t (a int REFERENCES);", format),
      );

      expect(thrown).toMatchObject({ diags: [expect.any(Error)] });
    },
  );
});

describe(
  "names, unique constraints and alter table (probe points 2 to 4)",
  SQL_PARSE_TIMEOUT,
  () => {
    it.each([
      {
        format: "postgres",
        source: 'CREATE TABLE Users (Id int, "Quoted" int);',
      },
      { format: "mysql", source: "CREATE TABLE Users (Id int, `Quoted` int);" },
      { format: "mssql", source: "CREATE TABLE Users (Id int, [Quoted] int);" },
    ] as const)(
      "keeps the case of unquoted names in $format",
      ({ format, source }) => {
        const [table] = tablesOf(Parser.parse(source, format));

        expect(table).toMatchObject({
          name: "Users",
          fields: [{ name: "Id" }, { name: "Quoted" }],
        });
      },
    );

    it.each(SQL_FORMATS)(
      "marks only a column-level unique on the field and turns table-level unique constraints and unique indexes alike into indexes in %s",
      (format) => {
        const source =
          "CREATE TABLE t (a int UNIQUE, b int, c int, d int, e int, CONSTRAINT t_b_key UNIQUE (b), CONSTRAINT t_cd_key UNIQUE (c, d));\nCREATE UNIQUE INDEX t_e_idx ON t (e);\n";
        const [table] = tablesOf(Parser.parse(source, format));

        expect(table?.fields.map((field) => field.unique)).toStrictEqual([
          true,
          undefined,
          undefined,
          undefined,
          undefined,
        ]);
        expect(
          table?.indexes.map((index) => [index.name, index.unique]),
        ).toStrictEqual([
          ["t_b_key", true],
          ["t_cd_key", true],
          ["t_e_idx", true],
        ]);
      },
    );

    it.each([
      { format: "postgres", add: "ADD COLUMN extra text", fieldNames: ["id"] },
      { format: "mysql", add: "ADD COLUMN extra text", fieldNames: ["id"] },
      {
        format: "mssql",
        add: "ADD extra nvarchar(10)",
        fieldNames: ["id", "extra"],
      },
    ] as const)(
      "keeps an alter table add column only in mssql ($format)",
      ({ format, add, fieldNames }) => {
        const fields = fieldsOf(
          `CREATE TABLE t (id int);\nALTER TABLE t ${add} NOT NULL;\n`,
          format,
        );

        expect(fields.map((field) => field.name)).toStrictEqual(fieldNames);
      },
    );

    it.each([
      { format: "postgres", isFieldUnique: true, indexNames: [] },
      { format: "mysql", isFieldUnique: false, indexNames: [] },
      { format: "mssql", isFieldUnique: false, indexNames: ["t_b_key"] },
    ] as const)(
      "reads a single-column unique added by alter table differently in $format",
      ({ format, isFieldUnique, indexNames }) => {
        const source =
          "CREATE TABLE t (a int, b int);\nALTER TABLE t ADD CONSTRAINT t_b_key UNIQUE (b);\n";
        const [table] = tablesOf(Parser.parse(source, format));

        expect(table?.fields[1]?.unique === true).toBe(isFieldUnique);
        expect(table?.indexes.map((index) => index.name)).toStrictEqual(
          indexNames,
        );
      },
    );

    it("reads pg_dump primary and foreign keys from alter table only", () => {
      const database = Parser.parse(
        "CREATE TABLE public.p (id integer NOT NULL);\nCREATE TABLE public.c (id integer NOT NULL, p_id integer);\nALTER TABLE ONLY public.p\n    ADD CONSTRAINT p_pkey PRIMARY KEY (id);\nALTER TABLE ONLY public.c\n    ADD CONSTRAINT c_p_id_fkey FOREIGN KEY (p_id) REFERENCES public.p(id) ON DELETE CASCADE ON UPDATE SET NULL;\n",
        "postgres",
      );

      expect(tablesOf(database)[0]?.fields[0]?.pk).toBe(true);
      expect(database.schemas[0]?.refs[0]).toMatchObject({
        name: "c_p_id_fkey",
        onDelete: "CASCADE",
        onUpdate: "SET NULL",
        endpoints: [
          {
            schemaName: "public",
            tableName: "c",
            fieldNames: ["p_id"],
            relation: "0..*",
          },
          {
            schemaName: "public",
            tableName: "p",
            fieldNames: ["id"],
            relation: "0..1",
          },
        ],
      });
    });

    it.each([
      { format: "mysql", relations: ["0..*", "0..1"] },
      { format: "mssql", relations: ["*", "1"] },
    ] as const)(
      "reads a foreign key added by alter table in $format",
      ({ format, relations }) => {
        const database = Parser.parse(
          "CREATE TABLE p (id int NOT NULL, PRIMARY KEY (id));\nCREATE TABLE c (id int NOT NULL, p_id int);\nALTER TABLE c ADD CONSTRAINT c_p_fk FOREIGN KEY (p_id) REFERENCES p (id) ON DELETE CASCADE;\n",
          format,
        );

        expect(database.schemas[0]?.refs[0]).toMatchObject({
          name: "c_p_fk",
          onDelete: "CASCADE",
          endpoints: [
            { tableName: "c", relation: relations[0] },
            { tableName: "p", relation: relations[1] },
          ],
        });
      },
    );
  },
);

describe(
  "information dropped without an error (probe point 5)",
  SQL_PARSE_TIMEOUT,
  () => {
    it("drops a mysql on update clause and keeps the default", () => {
      const [field] = fieldsOf(
        "CREATE TABLE t (u DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6));",
        "mysql",
      );

      expect(field).toMatchObject({
        dbdefault: { type: "expression", value: "CURRENT_TIMESTAMP(6)" },
      });
      expect(Object.keys(field ?? {})).not.toContain("onUpdate");
    });

    it.each([
      {
        format: "postgres",
        source:
          "CREATE TABLE t (a int, b int GENERATED ALWAYS AS (a * 2) STORED);",
        typeName: "int",
      },
      {
        format: "mysql",
        source:
          "CREATE TABLE t (a int, b int GENERATED ALWAYS AS (a * 2) STORED);",
        typeName: "int",
      },
      {
        format: "mssql",
        source: "CREATE TABLE t (a int, b AS (a * 2) PERSISTED);",
        typeName: "AS a * 2 PERSISTED",
      },
    ] as const)(
      "reads a computed column as type $typeName in $format",
      ({ format, source, typeName }) => {
        expect(fieldsOf(source, format)[1]).toMatchObject({
          name: "b",
          type: { type_name: typeName },
        });
      },
    );

    it.each([
      {
        format: "postgres",
        source: 'CREATE TABLE t (a text COLLATE "C");',
        typeName: "text",
      },
      {
        format: "mysql",
        source: "CREATE TABLE t (a varchar(10) COLLATE utf8mb4_bin);",
        typeName: "varchar(10)",
      },
      {
        format: "mssql",
        source: "CREATE TABLE t (a nvarchar(10) COLLATE Latin1_General_CI_AS);",
        typeName: "nvarchar(10)",
      },
    ] as const)(
      "drops a column collation in $format",
      ({ format, source, typeName }) => {
        expect(fieldsOf(source, format)[0]).toMatchObject({
          type: { type_name: typeName },
        });
      },
    );

    it.each([
      { format: "postgres", where: " WHERE b > 0", columnType: "string" },
      { format: "mysql", where: "", columnType: "column" },
      { format: "mssql", where: " WHERE b > 0", columnType: "column" },
    ] as const)(
      "drops desc and where of an index in $format",
      ({ format, where, columnType }) => {
        const source = `CREATE TABLE t (a int, b int);\nCREATE INDEX t_a_idx ON t (a DESC)${where};\n`;
        const [table] = tablesOf(Parser.parse(source, format));

        expect(table?.indexes).toMatchObject([
          {
            name: "t_a_idx",
            unique: false,
            columns: [{ type: columnType, value: "a" }],
          },
        ]);
      },
    );

    it("keeps the index method and marks expression columns in postgres", () => {
      const source =
        "CREATE TABLE t (a int, b int);\nCREATE INDEX t_h_idx ON t USING hash (b);\nCREATE INDEX t_e_idx ON t (lower(a::text));\n";
      const [table] = tablesOf(Parser.parse(source, "postgres"));

      expect(table?.indexes).toMatchObject([
        {
          name: "t_h_idx",
          type: "hash",
          columns: [{ type: "string", value: "b" }],
        },
        {
          name: "t_e_idx",
          columns: [{ type: "expression", value: "lower(a::text)" }],
        },
      ]);
    });
  },
);

describe("defaults (probe point 6)", SQL_PARSE_TIMEOUT, () => {
  it.each([
    {
      format: "postgres",
      column: "s text DEFAULT 'it''s'",
      dbdefault: { type: "string", value: "it''s" },
    },
    {
      format: "postgres",
      column: "n numeric DEFAULT 12345678901234567890.123",
      dbdefault: { type: "number", value: "12345678901234567890.123" },
    },
    {
      format: "postgres",
      column: "i int DEFAULT -5",
      dbdefault: { type: "expression", value: "-5" },
    },
    {
      format: "postgres",
      column: "b boolean DEFAULT true",
      dbdefault: { type: "boolean", value: "true" },
    },
    {
      format: "postgres",
      column: "c text DEFAULT 'a'::text",
      dbdefault: { type: "expression", value: "'a'::text" },
    },
    {
      format: "postgres",
      column: "z text DEFAULT NULL",
      dbdefault: { type: "boolean", value: "null" },
    },
    {
      format: "postgres",
      column: "x int DEFAULT nextval('t_x_seq'::regclass)",
      dbdefault: { type: "expression", value: "nextval('t_x_seq'::regclass)" },
    },
    {
      format: "mysql",
      column: "b boolean DEFAULT false",
      dbdefault: { type: "boolean", value: "false" },
    },
    {
      format: "mysql",
      column: "u char(36) DEFAULT (UUID())",
      dbdefault: { type: "expression", value: "UUID()" },
    },
    {
      format: "mssql",
      column: "s nvarchar(10) DEFAULT N'a'",
      dbdefault: { type: "expression", value: "N'a'" },
    },
    {
      format: "mssql",
      column: "p nvarchar(10) DEFAULT 'b'",
      dbdefault: { type: "string", value: "b" },
    },
    {
      format: "mssql",
      column: "i int DEFAULT ((0))",
      dbdefault: { type: "number", value: "0" },
    },
    {
      format: "mssql",
      column: "b bit DEFAULT 1",
      dbdefault: { type: "number", value: "1" },
    },
  ] as const)(
    "reads $column in $format as $dbdefault",
    ({ format, column, dbdefault }) => {
      expect(fieldsOf(`CREATE TABLE t (${column});`, format)[0]).toMatchObject({
        dbdefault,
      });
    },
  );
});

describe("types (probe point 7)", SQL_PARSE_TIMEOUT, () => {
  it.each([
    {
      format: "postgres",
      column: "character varying(255)",
      typeName: "character varying(255)",
    },
    { format: "postgres", column: "numeric(10, 2)", typeName: "numeric(10,2)" },
    {
      format: "postgres",
      column: "timestamp with time zone",
      typeName: "timestamp",
    },
    { format: "postgres", column: "time with time zone", typeName: "time" },
    {
      format: "postgres",
      column: "double precision",
      typeName: "doubleprecision",
    },
    { format: "postgres", column: "bit varying(4)", typeName: "bitvarying(4)" },
    {
      format: "postgres",
      column: "geometry(Point,4326)",
      typeName: "geometry(Point,4326)",
    },
    { format: "mysql", column: "int unsigned", typeName: "int" },
    {
      format: "mysql",
      column: "decimal(10,2) unsigned",
      typeName: "decimal(10,2)",
    },
    { format: "mysql", column: "double precision", typeName: "double" },
    { format: "mysql", column: "tinyint(1)", typeName: "tinyint(1)" },
    {
      format: "mssql",
      column: "bigint IDENTITY(1,1)",
      typeName: "bigint IDENTITY(1,1)",
    },
    {
      format: "mssql",
      column: "int IDENTITY(10, 5)",
      typeName: "int IDENTITY(10,5)",
    },
    { format: "mssql", column: "nvarchar(max)", typeName: "nvarchar(MAX)" },
    {
      format: "mssql",
      column: "double precision",
      typeName: "double precision",
    },
  ] as const)(
    "reads the $format type $column as $typeName",
    ({ format, column, typeName }) => {
      expect(
        fieldsOf(`CREATE TABLE t (c ${column});`, format)[0],
      ).toMatchObject({ type: { type_name: typeName } });
    },
  );

  it.each([
    { format: "postgres", column: "serial" },
    { format: "postgres", column: "bigint GENERATED BY DEFAULT AS IDENTITY" },
    { format: "mysql", column: "bigint NOT NULL AUTO_INCREMENT" },
  ] as const)("marks $column as increment in $format", ({ format, column }) => {
    expect(fieldsOf(`CREATE TABLE t (c ${column});`, format)[0]).toMatchObject({
      increment: true,
    });
  });

  it("does not mark an mssql identity column as increment", () => {
    expect(
      fieldsOf("CREATE TABLE t (c bigint IDENTITY(1,1));", "mssql")[0]
        ?.increment,
    ).toBeUndefined();
  });

  it("names a mysql inline enum <table>_<column>_enum", () => {
    const database = Parser.parse(
      "CREATE TABLE t (st ENUM('x', 'y') NOT NULL);",
      "mysql",
    );

    expect(tablesOf(database)[0]?.fields[0]).toMatchObject({
      type: { type_name: "t_st_enum" },
    });
    expect(database.schemas[0]?.enums[0]).toMatchObject({
      name: "t_st_enum",
      values: [{ name: "x" }, { name: "y" }],
    });
  });

  it("reads a postgres create type as enum and keeps the schema of a qualified column type", () => {
    const database = Parser.parse(
      "CREATE TYPE status AS ENUM ('a', 'b');\nCREATE TABLE t (s status, p public.status);\n",
      "postgres",
    );

    expect(database.schemas[0]?.enums[0]).toMatchObject({
      name: "status",
      values: [{ name: "a" }, { name: "b" }],
    });
    expect(tablesOf(database)[0]?.fields).toMatchObject([
      { type: { type_name: "status", schemaName: null } },
      { type: { type_name: "status", schemaName: "public" } },
    ]);
  });
});

describe(
  "comments, checks, skipped statements and positions (probe points 8 to 10)",
  SQL_PARSE_TIMEOUT,
  () => {
    it.each([
      {
        format: "postgres",
        source:
          "CREATE TABLE t (a int CHECK (a > 0), CONSTRAINT t_a_check CHECK (a IN (1, 2)));\nCOMMENT ON TABLE t IS 'table note';\nCOMMENT ON COLUMN t.a IS 'col note';\n",
        tableNote: "table note",
        fieldNote: "col note",
        tableCheck: "a IN (1, 2)",
      },
      {
        format: "mysql",
        source:
          "CREATE TABLE t (a int COMMENT 'col note' CHECK (a > 0), CONSTRAINT t_a_check CHECK (a IN (1, 2))) COMMENT='table note';",
        tableNote: "table note",
        fieldNote: "col note",
        tableCheck: "a IN (1, 2)",
      },
      {
        format: "mssql",
        source:
          "CREATE TABLE t (a int CHECK (a > 0), CONSTRAINT t_a_check CHECK ([a] IN (1, 2)));\nEXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'col note', @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N't', @level2type = N'COLUMN', @level2name = N'a';\nGO\n",
        tableNote: null,
        fieldNote: null,
        tableCheck: "[a] IN (1, 2)",
      },
    ] as const)(
      "reads comments and checks in $format",
      ({ format, source, tableNote, fieldNote, tableCheck }) => {
        const [table] = tablesOf(Parser.parse(source, format));

        expect(table).toMatchObject({
          note: tableNote,
          checks: [{ name: "t_a_check", expression: tableCheck }],
          fields: [{ note: fieldNote, checks: [{ expression: "a > 0" }] }],
        });
      },
    );

    it.each([
      {
        format: "postgres",
        statements:
          "CREATE VIEW v AS SELECT 1;\nCREATE SEQUENCE s START 1;\nCREATE FUNCTION f() RETURNS trigger AS $$ BEGIN RETURN NEW; END; $$ LANGUAGE plpgsql;\nCREATE TRIGGER tr BEFORE INSERT ON t FOR EACH ROW EXECUTE FUNCTION f();\nALTER TABLE ONLY t ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (SEQUENCE NAME t_id_seq START WITH 1);\n",
      },
      { format: "mysql", statements: "CREATE VIEW v AS SELECT 1;\n" },
      {
        format: "mssql",
        statements:
          "GO\nDECLARE @x int;\nEXEC sp_rename 'a', 'b';\nGO\nCREATE VIEW v AS SELECT 1;\nGO\n",
      },
    ] as const)(
      "skips statements outside the model without an error in $format",
      ({ format, statements }) => {
        const source = `CREATE TABLE t (id int NOT NULL);\n${statements}CREATE TABLE u (id int);\n`;
        const fields = fieldsOf(source, format);

        expect(
          fields.map((field) => [field.table.name, field.increment]),
        ).toStrictEqual([
          ["t", undefined],
          ["u", undefined],
        ]);
      },
    );

    it.each(SQL_FORMATS)(
      "has no token on elements of an sql model in %s",
      (format) => {
        const [table] = tablesOf(
          Parser.parse(
            "CREATE TABLE t (id int, CONSTRAINT t_id_key UNIQUE (id));",
            format,
          ),
        );

        expect([
          table?.token,
          table?.fields[0]?.token,
          table?.indexes[0]?.token,
        ]).toStrictEqual([undefined, undefined, undefined]);
      },
    );

    it("lists tables schema by schema, with ids in source order", () => {
      const database = Parser.parse(
        "CREATE TABLE other.a (id int);\nCREATE TABLE b (id int);\nCREATE TABLE other.c (id int);\n",
        "postgres",
      );

      expect(
        tablesOf(database).map((table) => [
          table.schema.name,
          table.name,
          table.id,
        ]),
      ).toStrictEqual([
        ["other", "a", 1],
        ["other", "c", 3],
        ["public", "b", 2],
      ]);
    });
  },
);

const DBML_FEATURES = [
  "Project shop {",
  "  database_type: 'PostgreSQL'",
  "  Note: 'project note'",
  "}",
  "Enum status {",
  "  active [note: 'on']",
  "}",
  "Table users [headercolor: #3498DB, note: 'users note'] {",
  "  id bigint [pk, increment]",
  "  name \"varchar(255)\" [not null, unique, note: 'n']",
  "  price decimal(10,2) [default: 12345678901234567890.123]",
  "  maybe int [null, default: null]",
  "  age int [check: `age > 0`]",
  "  checks {",
  "    `age < 200` [name: 'age_max']",
  "  }",
  "  indexes {",
  "    (name, age) [unique, name: 'users_name_age', type: hash, note: 'idx note']",
  "    `lower(name)` [name: 'expr_idx']",
  "  }",
  "}",
  "Table posts {",
  "  id int [pk]",
  "  user_id bigint",
  "  owner_id bigint [ref: - users.id]",
  "  a int",
  "  b int",
  "  indexes {",
  "    (a, b) [pk]",
  "  }",
  "}",
  "Ref posts_user: posts.user_id > users.id [delete: cascade, update: set null, color: #ff0000]",
  "Ref: posts.a <> users.id",
  "Ref: users.id < posts.b",
  "TableGroup core [color: #00ff00, note: 'group note'] {",
  "  users",
  "}",
  "Note sticky {",
  "  'sticky content'",
  "}",
  "Records users(id) {",
  "  1",
  "}",
].join("\n");

describe("dbmlv2 model (probe points 10 and 11)", () => {
  const database = Parser.parse(DBML_FEATURES, "dbmlv2");
  const [users, posts] = tablesOf(database);
  const [schema] = database.schemas;

  it("reads the project name, database type and note", () => {
    expect([database.name, database.databaseType, database.note]).toStrictEqual(
      ["shop", "PostgreSQL", "project note"],
    );
  });

  it("drops the quotes of a quoted type name and reads a numeric default as a javascript number", () => {
    expect(users?.fields.slice(1, 4)).toMatchObject([
      {
        name: "name",
        type: { type_name: "varchar(255)" },
        not_null: true,
        unique: true,
        note: "n",
      },
      {
        name: "price",
        dbdefault: { type: "number", value: 12345678901234567000 },
      },
      {
        name: "maybe",
        not_null: false,
        dbdefault: { type: "boolean", value: "null" },
      },
    ]);
  });

  it("gives every element a token with 1-based lines and columns", () => {
    expect([
      users?.token,
      users?.fields[0]?.token,
      users?.indexes[0]?.token,
      schema?.enums[0]?.token,
    ]).toMatchObject([
      { start: { line: 8, column: 1 }, end: { line: 21, column: 2 } },
      { start: { line: 9, column: 3 }, end: { line: 9, column: 28 } },
      { start: { line: 18, column: 5 } },
      { start: { line: 5, column: 1 } },
    ]);
  });

  it("reads table color, note, checks and index settings", () => {
    expect(users).toMatchObject({
      headerColor: "#3498DB",
      note: "users note",
      checks: [{ name: "age_max", expression: "age < 200" }],
      fields: [{}, {}, {}, {}, { checks: [{ expression: "age > 0" }] }],
      indexes: [
        {
          name: "users_name_age",
          unique: true,
          type: "hash",
          note: "idx note",
          columns: [
            { type: "column", value: "name" },
            { type: "column", value: "age" },
          ],
        },
        {
          name: "expr_idx",
          columns: [{ type: "expression", value: "lower(name)" }],
        },
      ],
    });
    expect(posts?.indexes).toMatchObject([
      { pk: true, columns: [{ value: "a" }, { value: "b" }] },
    ]);
  });

  it("reads refs with name, color, actions and cardinalities, putting the referenced side first for an inline ref", () => {
    expect(
      schema?.refs.map((ref) => [
        ref.name,
        ref.endpoints.map(
          (endpoint) =>
            `${endpoint.tableName}.${endpoint.fieldNames.join()}:${endpoint.relation}`,
        ),
      ]),
    ).toStrictEqual([
      [undefined, ["users.id:1", "posts.owner_id:1"]],
      ["posts_user", ["posts.user_id:*", "users.id:1"]],
      [null, ["posts.a:*", "users.id:*"]],
      [null, ["users.id:1", "posts.b:*"]],
    ]);
    expect(schema?.refs[1]).toMatchObject({
      color: "#ff0000",
      onDelete: "cascade",
      onUpdate: "set null",
    });
  });

  it("reads enum value notes, table groups, sticky notes and records", () => {
    expect(schema?.enums[0]?.values).toMatchObject([
      { name: "active", note: "on" },
    ]);
    expect(schema?.tableGroups[0]).toMatchObject({
      name: "core",
      color: "#00ff00",
      note: "group note",
      tables: [{ name: "users" }],
    });
    expect(database.notes).toMatchObject([
      {
        name: "sticky",
        content: "sticky content",
        token: { start: { line: 38, column: 1 } },
      },
    ]);
    expect(database.records).toMatchObject([
      { tableName: "users", token: { start: { line: 41, column: 1 } } },
    ]);
  });
});
