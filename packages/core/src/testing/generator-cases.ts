import { generateDbml } from "../generators/dbml/index.js";
import { generateDrizzle } from "../generators/drizzle/index.js";
import { generateMarkdown } from "../generators/markdown/index.js";
import { generateMockApi } from "../generators/mock-api/index.js";
import { generateMysql } from "../generators/mysql/index.js";
import { generateOpenApi } from "../generators/openapi/index.js";
import { generatePostgresql } from "../generators/postgresql/index.js";
import { generatePrisma } from "../generators/prisma/index.js";
import { generateSeed } from "../generators/seed/index.js";
import type {
  GenerateResult,
  MarkdownLabels,
} from "../generators/shared/generator-types.js";
import { generateSqlServer } from "../generators/sqlserver/index.js";
import { generateTypeScript } from "../generators/typescript/index.js";
import { generateZod } from "../generators/zod/index.js";
import type { SchemaDocument } from "../model/schema-document.js";

export type GeneratorCase = {
  readonly name: string;
  readonly run: (schema: SchemaDocument) => GenerateResult;
};

const SEED_ROWS_PER_TABLE = 3;
const SEED_VALUE = 1;

const MARKDOWN_LABELS: MarkdownLabels = {
  enumsHeading: "Enums",
  tablesHeading: "Tables",
  indexesHeading: "Indexes",
  relationsHeading: "Relations",
  columnNameHeader: "Name",
  columnTypeHeader: "Type",
  columnNullableHeader: "Nullable",
  columnDefaultHeader: "Default",
  columnConstraintsHeader: "Constraints",
  columnCommentHeader: "Comment",
  indexNameHeader: "Name",
  indexColumnsHeader: "Columns",
  indexUniqueHeader: "Unique",
  yes: "yes",
  no: "no",
  primaryKey: "primary key",
  unique: "unique",
  autoIncrement: "auto increment",
  foreignKey: "foreign key",
  oneToOne: "one to one",
  oneToMany: "one to many",
  outgoingRelations: "References",
  incomingRelations: "Referenced by",
};

/** One case per generator and main option value (spec section 10, "Property test"). */
export function listGeneratorCases(): readonly GeneratorCase[] {
  return [
    { name: "postgresql", run: (schema) => generatePostgresql(schema, {}) },
    { name: "mysql", run: (schema) => generateMysql(schema, {}) },
    { name: "sqlserver", run: (schema) => generateSqlServer(schema, {}) },
    ...(["postgresql", "mysql", "sqlserver"] as const).map((provider) => ({
      name: `prisma ${provider}`,
      run: (schema: SchemaDocument) => generatePrisma(schema, { provider }),
    })),
    ...(["postgresql", "mysql"] as const).map((dialect) => ({
      name: `drizzle ${dialect}`,
      run: (schema: SchemaDocument) => generateDrizzle(schema, { dialect }),
    })),
    { name: "typescript", run: (schema) => generateTypeScript(schema, {}) },
    { name: "zod", run: (schema) => generateZod(schema, {}) },
    { name: "mock-api", run: (schema) => generateMockApi(schema, {}) },
    { name: "openapi", run: (schema) => generateOpenApi(schema, {}) },
    ...(["postgresql", "mysql", "sqlserver", "json"] as const).map(
      (format) => ({
        name: `seed ${format}`,
        run: (schema: SchemaDocument) =>
          generateSeed(schema, {
            format,
            rowsPerTable: SEED_ROWS_PER_TABLE,
            seed: SEED_VALUE,
          }),
      }),
    ),
    { name: "dbml", run: (schema) => generateDbml(schema, {}) },
    {
      name: "markdown",
      run: (schema) => generateMarkdown(schema, { labels: MARKDOWN_LABELS }),
    },
  ];
}
