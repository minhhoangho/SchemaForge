import { describe, expect, it } from "vitest";

import type { SqlDialect } from "../../generators/shared/generator-types.js";
import { unwrapOk } from "../../testing/unwrap-result.js";
import type {
  DraftColumn,
  DraftDiagnostic,
  ImportDraft,
} from "../shared/import-draft.js";
import { draftSql } from "./import-sql.js";

const PARSE_TIMEOUT = { timeout: 60_000 };

function draftOf(dialect: SqlDialect, source: string): ImportDraft {
  return unwrapOk(draftSql(dialect, source));
}

function columnsOf(
  dialect: SqlDialect,
  source: string,
): readonly DraftColumn[] {
  return draftOf(dialect, source).tables[0]?.columns ?? [];
}

function columnDiagnostic(
  code: DraftDiagnostic["code"],
  line: number,
  column: number,
  columnIndex: number,
  field?: string,
): DraftDiagnostic {
  return {
    code,
    location: { line, column },
    target: {
      kind: "column",
      tableIndex: 0,
      columnIndex,
      ...(field === undefined ? {} : { field }),
    },
  };
}

function indexDiagnostic(
  code: DraftDiagnostic["code"],
  line: number,
  column: number,
  index: number,
): DraftDiagnostic {
  return {
    code,
    location: { line, column },
    target: { kind: "index", index },
  };
}

describe("buildSqlDraft", PARSE_TIMEOUT, () => {
  describe("namespaces, names and keys", () => {
    it.each([
      { dialect: "postgresql", source: "CREATE TABLE public.t (id int);" },
      { dialect: "sqlserver", source: "CREATE TABLE [dbo].[t] ([id] int);" },
      { dialect: "mysql", source: "CREATE TABLE `t` (`id` int);" },
    ] as const)(
      "drops the default namespace of $dialect without a diagnostic",
      ({ dialect, source }) => {
        const draft = draftOf(dialect, source);

        expect({
          name: draft.tables[0]?.name,
          diagnostics: draft.diagnostics,
        }).toStrictEqual({ name: "t", diagnostics: [] });
      },
    );

    it.each([
      { dialect: "postgresql", source: "CREATE TABLE sales.t (id int);" },
      { dialect: "sqlserver", source: "CREATE TABLE [audit].[t] ([id] int);" },
      { dialect: "mysql", source: "CREATE TABLE `shop`.`t` (`id` int);" },
    ] as const)(
      "reports namespace-dropped for another namespace in $dialect",
      ({ dialect, source }) => {
        expect(draftOf(dialect, source).diagnostics).toStrictEqual([
          {
            code: "namespace-dropped",
            location: { line: 1, column: 1 },
            target: { kind: "table", tableIndex: 0 },
          },
        ]);
      },
    );

    it("makes a column nullable unless it is not null or in the primary key", () => {
      const columns = columnsOf(
        "postgresql",
        "CREATE TABLE t (a int, b int NOT NULL, c int, PRIMARY KEY (c));",
      );

      expect(columns.map(({ isNullable }) => isNullable)).toStrictEqual([
        true,
        false,
        false,
      ]);
    });

    it("keeps the order of a composite primary key", () => {
      const draft = draftOf(
        "postgresql",
        "CREATE TABLE t (a int, b int, CONSTRAINT t_pkey PRIMARY KEY (b, a));",
      );

      expect(draft.tables[0]?.primaryKeyColumnNames).toStrictEqual(["b", "a"]);
    });

    it("reads a primary key added by alter table", () => {
      const draft = draftOf(
        "postgresql",
        "CREATE TABLE public.t (id integer NOT NULL);\nALTER TABLE ONLY public.t\n    ADD CONSTRAINT t_pkey PRIMARY KEY (id);\n",
      );

      expect(draft.tables[0]?.primaryKeyColumnNames).toStrictEqual(["id"]);
    });
  });

  describe("unique constraints and indexes", () => {
    it.each([
      {
        dialect: "postgresql",
        source: "CREATE TABLE t (a int UNIQUE, b int);",
      },
      {
        dialect: "postgresql",
        source: "CREATE TABLE t (a int, b int, CONSTRAINT t_a_key UNIQUE (a));",
      },
      {
        dialect: "postgresql",
        source:
          "CREATE TABLE t (a int, b int);\nALTER TABLE ONLY t ADD CONSTRAINT x UNIQUE (a);",
      },
      {
        dialect: "sqlserver",
        source:
          "CREATE TABLE t (a int, b int);\nALTER TABLE t ADD CONSTRAINT x UNIQUE (a);",
      },
      {
        dialect: "mysql",
        source: "CREATE TABLE t (a int, b int, UNIQUE KEY t_a_key (a));",
      },
      {
        dialect: "mysql",
        source: "CREATE TABLE t (a int, b int, UNIQUE KEY (a));",
      },
    ] as const)(
      "makes a single-column unique constraint a unique column in $dialect: $source",
      ({ dialect, source }) => {
        const draft = draftOf(dialect, source);

        expect({
          isUnique: draft.tables[0]?.columns.map(({ isUnique }) => isUnique),
          indexes: draft.indexes,
          diagnostics: draft.diagnostics,
        }).toStrictEqual({
          isUnique: [true, false],
          indexes: [],
          diagnostics: [],
        });
      },
    );

    it.each([
      {
        dialect: "postgresql",
        source:
          "CREATE TABLE t (a int, b int, CONSTRAINT t_ab_key UNIQUE (a, b));",
        location: { line: 1, column: 1 },
      },
      {
        dialect: "postgresql",
        source:
          "CREATE TABLE t (a int, b int);\nALTER TABLE ONLY t\n    ADD CONSTRAINT t_ab_key UNIQUE (a, b);",
        location: { line: 2, column: 1 },
      },
      {
        dialect: "mysql",
        source: "CREATE TABLE t (a int, b int, UNIQUE KEY t_ab_key (a, b));",
        location: { line: 1, column: 1 },
      },
    ] as const)(
      "makes a multi-column unique constraint a unique index named after it in $dialect: $source",
      ({ dialect, source, location }) => {
        expect(draftOf(dialect, source).indexes).toStrictEqual([
          {
            tableName: "t",
            name: "t_ab_key",
            columnNames: ["a", "b"],
            isUnique: true,
            location,
          },
        ]);
      },
    );

    it("tells a table-level unique constraint from a unique index", () => {
      const draft = draftOf(
        "postgresql",
        "CREATE TABLE t (a int, b int, CONSTRAINT t_a_key UNIQUE (a));\nCREATE UNIQUE INDEX t_b_ux ON t (b);",
      );

      expect({
        isUnique: draft.tables[0]?.columns.map(({ isUnique }) => isUnique),
        indexes: draft.indexes,
      }).toStrictEqual({
        isUnique: [true, false],
        indexes: [
          {
            tableName: "t",
            name: "t_b_ux",
            columnNames: ["b"],
            isUnique: true,
            location: { line: 2, column: 1 },
          },
        ],
      });
    });

    it.each([
      { key: "UNIQUE KEY `t_a_key` (`a`)", isUnique: true, indexNames: [] },
      { key: "UNIQUE KEY (`a`)", isUnique: true, indexNames: [] },
      { key: "UNIQUE KEY `a_ux` (`a`)", isUnique: false, indexNames: ["a_ux"] },
      {
        key: "UNIQUE KEY `t_a_key_2` (`a`)",
        isUnique: false,
        indexNames: ["t_a_key_2"],
      },
    ])(
      "reads a mysqldump unique key as a unique column or an index by its name: $key",
      ({ key, isUnique, indexNames }) => {
        const draft = draftOf(
          "mysql",
          `CREATE TABLE \`t\` (\n  \`a\` int,\n  ${key}\n);`,
        );

        expect({
          isUnique: draft.tables[0]?.columns[0]?.isUnique,
          indexNames: draft.indexes.map(({ name }) => name),
        }).toStrictEqual({ isUnique, indexNames });
      },
    );

    it.each([
      {
        index:
          "CREATE UNIQUE INDEX [t_a_key] ON [t] ([a]) WHERE [a] IS NOT NULL;",
        isUnique: true,
        indexNames: [],
      },
      {
        index: "CREATE UNIQUE INDEX [a_ux] ON [t] ([a]) WHERE [a] IS NOT NULL;",
        isUnique: false,
        indexNames: ["a_ux"],
      },
      {
        index:
          "CREATE UNIQUE INDEX [t_ab_ux] ON [t] ([a], [b]) WHERE [a] IS NOT NULL AND [b] IS NOT NULL;",
        isUnique: false,
        indexNames: ["t_ab_ux"],
      },
    ])(
      "keeps the sql server not-null filter of a unique index without a diagnostic: $index",
      ({ index, isUnique, indexNames }) => {
        const draft = draftOf(
          "sqlserver",
          `CREATE TABLE [t] ([a] int NULL, [b] int NULL);\n${index}`,
        );

        expect({
          isUnique: draft.tables[0]?.columns[0]?.isUnique,
          indexNames: draft.indexes.map(({ name }) => name),
          diagnostics: draft.diagnostics,
        }).toStrictEqual({ isUnique, indexNames, diagnostics: [] });
      },
    );

    it.each([
      {
        dialect: "postgresql",
        type: "varchar(20)",
        index: "CREATE INDEX t_a_idx ON t (a DESC);",
      },
      {
        dialect: "postgresql",
        type: "varchar(20)",
        index: "CREATE INDEX t_a_idx ON t (a) WHERE b > 0;",
      },
      {
        dialect: "sqlserver",
        type: "nvarchar(20)",
        index: "CREATE INDEX t_a_idx ON t (a) INCLUDE (b);",
      },
      {
        dialect: "sqlserver",
        type: "nvarchar(20)",
        index: "CREATE UNIQUE INDEX t_a_idx ON t (a) WHERE b > 0;",
      },
      {
        dialect: "mysql",
        type: "varchar(20)",
        index: "CREATE INDEX t_a_idx ON t (a(10));",
      },
    ] as const)(
      "reports index-option-dropped for element options, include and a where clause: $index",
      ({ dialect, type, index }) => {
        const draft = draftOf(
          dialect,
          `CREATE TABLE t (a ${type}, b int);\n${index}`,
        );

        expect({
          columnNames: draft.indexes.map(({ columnNames }) => columnNames),
          diagnostics: draft.diagnostics,
        }).toStrictEqual({
          columnNames: [["a"]],
          diagnostics: [indexDiagnostic("index-option-dropped", 2, 1, 0)],
        });
      },
    );

    it("reports index-option-dropped on the unique column of a constraint with an element option", () => {
      const draft = draftOf(
        "mysql",
        "CREATE TABLE t (a varchar(20), UNIQUE KEY (a(10)));",
      );

      expect(draft.diagnostics).toStrictEqual([
        {
          code: "index-option-dropped",
          location: { line: 1, column: 17 },
          target: {
            kind: "column",
            tableIndex: 0,
            columnIndex: 0,
            field: "isUnique",
          },
        },
      ]);
    });

    it("ignores with options and a filegroup of an ssms index", () => {
      const draft = draftOf(
        "sqlserver",
        "CREATE TABLE [dbo].[t] ([a] int NULL)\nGO\nCREATE NONCLUSTERED INDEX [t_a_idx] ON [dbo].[t]\n(\n\t[a] ASC\n)WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF) ON [PRIMARY]\nGO\n",
      );

      expect({
        names: draft.indexes.map(({ name }) => name),
        diagnostics: draft.diagnostics,
      }).toStrictEqual({ names: ["t_a_idx"], diagnostics: [] });
    });

    it("names an index without a name later through suggestIndexName", () => {
      const draft = draftOf(
        "postgresql",
        "CREATE TABLE t (a int);\nCREATE INDEX ON t (a);",
      );

      expect(draft.indexes.map(({ name }) => name)).toStrictEqual([null]);
    });

    it("drops an expression index with index-expression-not-supported", () => {
      const draft = draftOf(
        "postgresql",
        "CREATE TABLE t (a text);\nCREATE INDEX t_e_idx ON t (lower(a));",
      );

      expect({
        indexes: draft.indexes,
        diagnostics: draft.diagnostics,
      }).toStrictEqual({
        indexes: [],
        diagnostics: [
          {
            code: "index-expression-not-supported",
            location: { line: 2, column: 1 },
            target: null,
          },
        ],
      });
    });

    it("keeps an index of another method with index-type-dropped", () => {
      const draft = draftOf(
        "postgresql",
        "CREATE TABLE t (a int);\nCREATE INDEX t_h_idx ON t USING hash (a);",
      );

      expect({
        names: draft.indexes.map(({ name }) => name),
        diagnostics: draft.diagnostics,
      }).toStrictEqual({
        names: ["t_h_idx"],
        diagnostics: [indexDiagnostic("index-type-dropped", 2, 1, 0)],
      });
    });

    it.each([
      { key: "KEY `t_a_idx` (`a`(10))", code: "index-option-dropped" },
      { key: "KEY (`a`(10))", code: "index-option-dropped" },
      { key: "KEY `t_a_idx` (`a` DESC)", code: "index-option-dropped" },
      { key: "FULLTEXT KEY `t_a_ft` (`a`)", code: "index-type-dropped" },
      { key: "FULLTEXT (`a`)", code: "index-type-dropped" },
      { key: "SPATIAL KEY `t_g_sp` (`g`)", code: "index-type-dropped" },
      { key: "SPATIAL INDEX `t_g_sp` (`g`)", code: "index-type-dropped" },
    ] as const)(
      "keeps a mysql key inside create table with $code: $key",
      ({ key, code }) => {
        const draft = draftOf(
          "mysql",
          `CREATE TABLE \`t\` (\`a\` varchar(20), \`g\` point NOT NULL, ${key});`,
        );

        expect({
          count: draft.indexes.length,
          diagnostics: draft.diagnostics,
        }).toStrictEqual({
          count: 1,
          diagnostics: [indexDiagnostic(code, 1, 1, 0)],
        });
      },
    );

    it.each(["KEY `t_a_idx` (`a`)", "INDEX `t_a_idx` (`a` ASC)"])(
      "keeps a plain mysql key inside create table without a diagnostic: %s",
      (key) => {
        const draft = draftOf(
          "mysql",
          `CREATE TABLE \`t\` (\`a\` varchar(20), ${key});`,
        );

        expect({
          names: draft.indexes.map(({ name }) => name),
          diagnostics: draft.diagnostics,
        }).toStrictEqual({ names: ["t_a_idx"], diagnostics: [] });
      },
    );

    it.each([
      "PRIMARY KEY (`id`),\n  KEY `t_id_idx` (`id`)",
      "PRIMARY KEY (`a`),\n  UNIQUE KEY `t_id_key` (`id`),\n  KEY `t_id_idx` (`id`)",
      "PRIMARY KEY (`a`),\n  KEY `t_id_a_idx` (`id`, `a`),\n  KEY `t_id_idx` (`id`)",
    ])(
      "keeps the auto-increment index when another key starts with its column: %s",
      (keys) => {
        const draft = draftOf(
          "mysql",
          `CREATE TABLE \`t\` (\n  \`a\` INT NOT NULL,\n  \`id\` BIGINT AUTO_INCREMENT NOT NULL,\n  ${keys}\n);`,
        );

        expect(draft.indexes.map(({ name }) => name)).toContain("t_id_idx");
      },
    );

    it("drops the index that mysql needs for an auto-increment column", () => {
      const draft = draftOf(
        "mysql",
        "CREATE TABLE `t` (\n  `a` INT NOT NULL,\n  `id` BIGINT AUTO_INCREMENT NOT NULL,\n  PRIMARY KEY (`a`, `id`),\n  KEY `t_id_idx` (`id`)\n);",
      );

      expect(draft.indexes).toStrictEqual([]);
    });
  });

  describe("implicit mysql foreign key indexes", () => {
    const PARENT =
      "CREATE TABLE `p` (`id` int NOT NULL, `code` int NOT NULL, PRIMARY KEY (`id`, `code`));\n";

    function childTable(elements: string): string {
      return `${PARENT}CREATE TABLE \`c\` (\n  \`id\` int NOT NULL,\n  \`p_id\` int,\n  \`p_code\` int,\n  ${elements}\n);\n`;
    }

    function indexNamesOf(dialect: SqlDialect, source: string): unknown {
      const draft = draftOf(dialect, source);
      return {
        names: draft.indexes.map(({ name }) => name),
        relations: draft.relations.length,
        diagnostics: draft.diagnostics,
      };
    }

    it.each([
      {
        case: "a key and a foreign key inside create table",
        source: childTable(
          "PRIMARY KEY (`id`),\n  KEY `c_p_id_fkey` (`p_id`),\n  CONSTRAINT `c_p_id_fkey` FOREIGN KEY (`p_id`) REFERENCES `p` (`id`)",
        ),
      },
      {
        case: "a foreign key added by alter table",
        source: `${childTable("PRIMARY KEY (`id`),\n  KEY `c_p_id_fkey` (`p_id`)")}ALTER TABLE \`c\` ADD CONSTRAINT \`c_p_id_fkey\` FOREIGN KEY (\`p_id\`) REFERENCES \`p\` (\`id\`);\n`,
      },
      {
        case: "a create index",
        source: `${childTable("PRIMARY KEY (`id`)")}CREATE INDEX \`c_p_id_fkey\` ON \`c\` (\`p_id\`);\nALTER TABLE \`c\` ADD CONSTRAINT \`c_p_id_fkey\` FOREIGN KEY (\`p_id\`) REFERENCES \`p\` (\`id\`);\n`,
      },
      {
        case: "a foreign key of two columns",
        source: childTable(
          "PRIMARY KEY (`id`),\n  KEY `c_p_fkey` (`p_id`, `p_code`),\n  CONSTRAINT `c_p_fkey` FOREIGN KEY (`p_id`, `p_code`) REFERENCES `p` (`id`, `code`)",
        ),
      },
    ])(
      "drops the index mysql creates for a foreign key: $case",
      ({ source }) => {
        expect(indexNamesOf("mysql", source)).toStrictEqual({
          names: [],
          relations: 1,
          diagnostics: [],
        });
      },
    );

    it.each([
      {
        case: "another name",
        keys: "PRIMARY KEY (`id`),\n  KEY `c_p_id_idx` (`p_id`)",
        name: "c_p_id_idx",
      },
      {
        case: "the name in another case",
        keys: "PRIMARY KEY (`id`),\n  KEY `C_P_ID_FKEY` (`p_id`)",
        name: "C_P_ID_FKEY",
      },
      {
        case: "other columns",
        keys: "PRIMARY KEY (`id`),\n  KEY `c_p_id_fkey` (`p_code`)",
        name: "c_p_id_fkey",
      },
      {
        case: "the primary key starting with the column",
        keys: "PRIMARY KEY (`p_id`, `id`),\n  KEY `c_p_id_fkey` (`p_id`)",
        name: "c_p_id_fkey",
      },
    ])("keeps a key named like a foreign key with $case", ({ keys, name }) => {
      const source = childTable(
        `${keys},\n  CONSTRAINT \`c_p_id_fkey\` FOREIGN KEY (\`p_id\`) REFERENCES \`p\` (\`id\`)`,
      );

      expect(indexNamesOf("mysql", source)).toStrictEqual({
        names: [name],
        relations: 1,
        diagnostics: [],
      });
    });

    it.each([
      {
        case: "a fulltext key",
        source: childTable(
          "PRIMARY KEY (`id`),\n  FULLTEXT KEY `c_p_id_fkey` (`p_id`),\n  CONSTRAINT `c_p_id_fkey` FOREIGN KEY (`p_id`) REFERENCES `p` (`id`)",
        ),
      },
      {
        case: "a descending key",
        source: childTable(
          "PRIMARY KEY (`id`),\n  KEY `c_p_id_fkey` (`p_id` DESC),\n  CONSTRAINT `c_p_id_fkey` FOREIGN KEY (`p_id`) REFERENCES `p` (`id`)",
        ),
      },
      {
        case: "a key with a prefix length",
        source: childTable(
          "PRIMARY KEY (`id`),\n  KEY `c_p_id_fkey` (`p_id`(4)),\n  CONSTRAINT `c_p_id_fkey` FOREIGN KEY (`p_id`) REFERENCES `p` (`id`)",
        ),
      },
      {
        case: "a descending create index",
        source: `${childTable("PRIMARY KEY (`id`)")}CREATE INDEX \`c_p_id_fkey\` ON \`c\` (\`p_id\` DESC);\nALTER TABLE \`c\` ADD CONSTRAINT \`c_p_id_fkey\` FOREIGN KEY (\`p_id\`) REFERENCES \`p\` (\`id\`);\n`,
      },
    ])("keeps an index named like a foreign key with $case", ({ source }) => {
      const draft = draftOf("mysql", source);

      expect(draft.indexes.map(({ name }) => name)).toStrictEqual([
        "c_p_id_fkey",
      ]);
    });

    it("keeps the foreign key index when another index serves the foreign key", () => {
      const source = childTable(
        "PRIMARY KEY (`id`),\n  KEY `c_p_id_fkey` (`p_id`),\n  KEY `c_p_id_code_idx` (`p_id`, `p_code`),\n  CONSTRAINT `c_p_id_fkey` FOREIGN KEY (`p_id`) REFERENCES `p` (`id`)",
      );

      expect(indexNamesOf("mysql", source)).toStrictEqual({
        names: ["c_p_id_fkey", "c_p_id_code_idx"],
        relations: 1,
        diagnostics: [],
      });
    });

    it("keeps the foreign key index when a unique column serves the foreign key", () => {
      const draft = draftOf(
        "mysql",
        childTable(
          "PRIMARY KEY (`id`),\n  UNIQUE KEY `c_p_id_key` (`p_id`),\n  KEY `c_p_id_fkey` (`p_id`),\n  CONSTRAINT `c_p_id_fkey` FOREIGN KEY (`p_id`) REFERENCES `p` (`id`)",
        ),
      );

      expect(draft.indexes.map(({ name }) => name)).toStrictEqual([
        "c_p_id_fkey",
      ]);
    });

    it("keeps an index named like a foreign key in postgresql", () => {
      const source =
        "CREATE TABLE p (id int PRIMARY KEY);\nCREATE TABLE c (id int PRIMARY KEY, p_id int);\nCREATE INDEX c_p_id_fkey ON c (p_id);\nALTER TABLE c ADD CONSTRAINT c_p_id_fkey FOREIGN KEY (p_id) REFERENCES p (id);\n";

      expect(indexNamesOf("postgresql", source)).toStrictEqual({
        names: ["c_p_id_fkey"],
        relations: 1,
        diagnostics: [],
      });
    });
  });

  describe("relations", () => {
    const TABLES =
      "CREATE TABLE p (id int PRIMARY KEY, code int UNIQUE, a int, b int);\nCREATE UNIQUE INDEX p_ab_ux ON p (a, b);\nCREATE TABLE c (id int PRIMARY KEY, code int UNIQUE, a int, b int);\nCREATE UNIQUE INDEX c_ab_ux ON c (a, b);\n";

    it.each([
      { columns: "(id) REFERENCES p (id)", kind: "oneToOne" },
      { columns: "(code) REFERENCES p (code)", kind: "oneToOne" },
      { columns: "(a, b) REFERENCES p (a, b)", kind: "oneToOne" },
      { columns: "(a) REFERENCES p (id)", kind: "oneToMany" },
    ])("infers $kind for a foreign key $columns", ({ columns, kind }) => {
      const draft = draftOf(
        "postgresql",
        `${TABLES}ALTER TABLE c ADD CONSTRAINT c_fk FOREIGN KEY ${columns};`,
      );

      expect(draft.relations.map((relation) => relation.kind)).toStrictEqual([
        kind,
      ]);
    });

    it("reads the foreign key side, columns and actions", () => {
      const draft = draftOf(
        "postgresql",
        "CREATE TABLE p (id int PRIMARY KEY);\nCREATE TABLE c (id int PRIMARY KEY, p_id int);\nALTER TABLE c ADD CONSTRAINT c_fk FOREIGN KEY (p_id) REFERENCES p (id) ON DELETE CASCADE ON UPDATE SET NULL;",
      );

      expect(draft.relations).toStrictEqual([
        {
          fromTableName: "c",
          toTableName: "p",
          columnPairs: [{ fromColumnName: "p_id", toColumnName: "id" }],
          kind: "oneToMany",
          onDelete: "cascade",
          onUpdate: "setNull",
          location: { line: 3, column: 1 },
        },
      ]);
    });

    it.each([
      {
        actions: "ON DELETE SET DEFAULT ON UPDATE RESTRICT",
        expected: ["setDefault", "restrict"],
      },
      { actions: "ON DELETE NO ACTION", expected: ["noAction", "noAction"] },
      { actions: "", expected: ["noAction", "noAction"] },
    ])("reads the actions $actions", ({ actions, expected }) => {
      const draft = draftOf(
        "postgresql",
        `CREATE TABLE p (id int PRIMARY KEY);\nCREATE TABLE c (p_id int REFERENCES p (id) ${actions});`,
      );

      expect(
        draft.relations.map(({ onDelete, onUpdate }) => [onDelete, onUpdate]),
      ).toStrictEqual([expected]);
    });
  });

  describe("comments", () => {
    it.each([
      {
        dialect: "postgresql",
        source:
          "CREATE TABLE t (c int);\nCOMMENT ON TABLE t IS 'it''s t';\nCOMMENT ON COLUMN t.c IS 'the c';",
      },
      {
        dialect: "mysql",
        source: "CREATE TABLE t (c int COMMENT 'the c') COMMENT='it''s t';",
      },
      {
        dialect: "sqlserver",
        source:
          "CREATE TABLE [dbo].[t] ([c] int)\nGO\nEXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'it''s t' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N't'\nGO\nEXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'the c' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N't', @level2type=N'COLUMN',@level2name=N'c'\nGO\n",
      },
    ] as const)(
      "reads table and column comments in $dialect",
      ({ dialect, source }) => {
        const table = draftOf(dialect, source).tables[0];

        expect([table?.comment, table?.columns[0]?.comment]).toStrictEqual([
          "it's t",
          "the c",
        ]);
      },
    );
  });

  describe("checks and enums", () => {
    it.each([
      {
        dialect: "postgresql",
        source: "CREATE TABLE t (s text CHECK (s IN ('a', 'b')));",
        column: 17,
      },
      {
        dialect: "sqlserver",
        source:
          "CREATE TABLE [t] ([s] nvarchar(1), CONSTRAINT [t_s_check] CHECK ([s] IN (N'a', N'b')));",
        column: 19,
      },
    ] as const)(
      "turns a check in on $dialect into the enum named after the table and column",
      ({ dialect, source, column }) => {
        const draft = draftOf(dialect, source);

        expect({
          type: draft.tables[0]?.columns[0]?.type,
          enums: draft.enums,
          diagnostics: draft.diagnostics,
        }).toStrictEqual({
          type: { kind: "enum", enumName: "t_s" },
          enums: [
            { name: "t_s", values: ["a", "b"], location: { line: 1, column } },
          ],
          diagnostics: [
            columnDiagnostic("check-converted-to-enum", 1, column, 0, "type"),
          ],
        });
      },
    );

    it.each([
      "CREATE TABLE t (n int CHECK (n > 0));",
      "CREATE TABLE t (n int, CONSTRAINT t_n_check CHECK (n > 0));",
      "CREATE TABLE t (n int CHECK (n IN (1, 2)));",
    ])("reports check-constraint-not-supported for %s", (source) => {
      const draft = draftOf("postgresql", source);

      expect({
        type: draft.tables[0]?.columns[0]?.type,
        codes: draft.diagnostics.map(({ code, target }) => [code, target]),
      }).toStrictEqual({
        type: { kind: "integer" },
        codes: [["check-constraint-not-supported", null]],
      });
    });

    it.each([
      {
        dialect: "postgresql",
        source:
          "CREATE TABLE t (n int);\nALTER TABLE ONLY t ADD CONSTRAINT t_n_check CHECK (n > 0);",
        line: 2,
      },
      {
        dialect: "sqlserver",
        source:
          "CREATE TABLE [dbo].[t] ([n] int)\nGO\nALTER TABLE [dbo].[t]  WITH CHECK ADD  CONSTRAINT [CK_t_n] CHECK  (([n]>(0)))\nGO\n",
        line: 3,
      },
    ] as const)(
      "locates a check added through alter table at its statement in $dialect",
      ({ dialect, source, line }) => {
        const draft = draftOf(dialect, source);

        expect(draft.diagnostics).toStrictEqual([
          {
            code: "check-constraint-not-supported",
            location: { line, column: 1 },
            target: null,
          },
        ]);
      },
    );

    it("maps a mysql inline enum to the enum named after the table and column before mapSqlType", () => {
      const draft = draftOf(
        "mysql",
        "CREATE TABLE `t` (`st` ENUM('a', 'it''s') NOT NULL DEFAULT 'a');",
      );

      expect({
        column: draft.tables[0]?.columns[0],
        enums: draft.enums,
        diagnostics: draft.diagnostics,
      }).toStrictEqual({
        column: {
          name: "st",
          type: { kind: "enum", enumName: "t_st" },
          isNullable: false,
          isUnique: false,
          isAutoIncrement: false,
          defaultValue: { kind: "literal", value: "a" },
          comment: "",
          location: { line: 1, column: 19 },
        },
        enums: [
          {
            name: "t_st",
            values: ["a", "it's"],
            location: { line: 1, column: 19 },
          },
        ],
        diagnostics: [],
      });
    });

    it("reads a postgresql create type as an enum", () => {
      const draft = draftOf(
        "postgresql",
        "CREATE TYPE status AS ENUM ('a', 'it''s');\nCREATE TABLE t (s status);",
      );

      expect({
        type: draft.tables[0]?.columns[0]?.type,
        values: draft.enums.map(({ values }) => values),
      }).toStrictEqual({
        type: { kind: "enum", enumName: "status" },
        values: [["a", "it's"]],
      });
    });
  });

  describe("column types and attributes", () => {
    it.each([
      {
        rawType: "timestamp with time zone",
        dialect: "postgresql",
        type: { kind: "timestamptz" },
        codes: [],
      },
      {
        rawType: "double precision",
        dialect: "postgresql",
        type: { kind: "double" },
        codes: [],
      },
      {
        rawType: "int unsigned",
        dialect: "mysql",
        type: { kind: "bigint" },
        codes: ["type-approximated"],
      },
    ] as const)(
      "uses the scanner type text instead of the parser type name: $rawType",
      ({ rawType, dialect, type, codes }) => {
        const draft = draftOf(dialect, `CREATE TABLE t (c ${rawType});`);

        expect({
          type: draft.tables[0]?.columns[0]?.type,
          codes: draft.diagnostics.map(({ code }) => code),
        }).toStrictEqual({ type, codes });
      },
    );

    it("falls back to the parser type name for a column added by alter table", () => {
      const draft = draftOf(
        "sqlserver",
        "CREATE TABLE [t] ([id] int NOT NULL);\nALTER TABLE [t] ADD [extra] nvarchar(10) NULL;",
      );

      expect(draft.tables[0]?.columns[1]).toStrictEqual({
        name: "extra",
        type: { kind: "varchar", length: 10 },
        isNullable: true,
        isUnique: false,
        isAutoIncrement: false,
        defaultValue: null,
        comment: "",
        location: { line: 2, column: 1 },
      });
    });

    it.each([
      {
        dialect: "postgresql",
        source:
          "CREATE TABLE t (a int, b int GENERATED ALWAYS AS (a * 2) STORED);",
        type: { kind: "integer" },
        column: 24,
      },
      {
        dialect: "mysql",
        source:
          "CREATE TABLE t (a int, b int GENERATED ALWAYS AS (a * 2) STORED);",
        type: { kind: "integer" },
        column: 24,
      },
      {
        dialect: "sqlserver",
        source: "CREATE TABLE t (a int, b AS (a * 2) PERSISTED);",
        type: { kind: "text" },
        column: 24,
      },
    ] as const)(
      "keeps a computed column of $dialect with computed-column-not-supported",
      ({ dialect, source, type, column }) => {
        const draft = draftOf(dialect, source);

        expect({
          type: draft.tables[0]?.columns[1]?.type,
          diagnostics: draft.diagnostics,
        }).toStrictEqual({
          type,
          diagnostics: [
            columnDiagnostic("computed-column-not-supported", 1, column, 1),
          ],
        });
      },
    );

    it("gives a sql server computed column the text type with one diagnostic", () => {
      const draft = draftOf(
        "sqlserver",
        "CREATE TABLE [t] ([a] int, [b] AS ([a] * 2));",
      );

      expect(draft.diagnostics.map(({ code }) => code)).toStrictEqual([
        "computed-column-not-supported",
      ]);
    });

    it("reports on-update-not-supported and keeps the mysql default", () => {
      const draft = draftOf(
        "mysql",
        "CREATE TABLE t (u DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6));",
      );

      expect({
        defaultValue: draft.tables[0]?.columns[0]?.defaultValue,
        diagnostics: draft.diagnostics,
      }).toStrictEqual({
        defaultValue: { kind: "currentTimestamp" },
        diagnostics: [columnDiagnostic("on-update-not-supported", 1, 17, 0)],
      });
    });

    it.each([
      { dialect: "postgresql", column: 'a text COLLATE "C"' },
      { dialect: "mysql", column: "a varchar(10) CHARACTER SET latin1" },
      {
        dialect: "sqlserver",
        column: "a nvarchar(10) COLLATE Latin1_General_CI_AS",
      },
    ] as const)(
      "reports type-parameter-dropped for a collation in $dialect",
      ({ dialect, column }) => {
        expect(
          draftOf(dialect, `CREATE TABLE t (${column});`).diagnostics,
        ).toStrictEqual([
          columnDiagnostic("type-parameter-dropped", 1, 17, 0, "type"),
        ]);
      },
    );
  });
});
