import { DB_PULL_MYSQL, DB_PULL_POSTGRESQL } from "./db-pull.fixture.js";
import {
  PRISMA_FEATURES_MONGODB,
  PRISMA_FEATURES_MULTI_SCHEMA,
  PRISMA_FEATURES_MYSQL,
  PRISMA_FEATURES_POSTGRESQL,
  PRISMA_FEATURES_SQLSERVER,
} from "./prisma-features.fixture.js";

/** Every `.prisma` fixture of the importer tests, for `prisma validate` in conformance. */
export const PRISMA_IMPORT_FIXTURES: readonly {
  readonly name: string;
  readonly source: string;
}[] = [
  { name: "db-pull-postgresql", source: DB_PULL_POSTGRESQL },
  { name: "db-pull-mysql", source: DB_PULL_MYSQL },
  { name: "features-postgresql", source: PRISMA_FEATURES_POSTGRESQL },
  { name: "features-mysql", source: PRISMA_FEATURES_MYSQL },
  { name: "features-sqlserver", source: PRISMA_FEATURES_SQLSERVER },
  { name: "features-multi-schema", source: PRISMA_FEATURES_MULTI_SCHEMA },
  { name: "features-mongodb", source: PRISMA_FEATURES_MONGODB },
];
