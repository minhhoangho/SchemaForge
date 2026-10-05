import type { ImportFormat, Importer } from "@schemaforge/core";

// One literal import() per subpath lets the bundler split a chunk per format,
// so the DBML parser loads only for DBML.
const loaders: Readonly<Record<ImportFormat, () => Promise<Importer>>> = {
  postgresql: async () =>
    (await import("@schemaforge/core/importers/sql")).importPostgresql,
  mysql: async () =>
    (await import("@schemaforge/core/importers/sql")).importMysql,
  sqlserver: async () =>
    (await import("@schemaforge/core/importers/sql")).importSqlserver,
  prisma: async () =>
    (await import("@schemaforge/core/importers/prisma")).importPrisma,
  dbml: async () =>
    (await import("@schemaforge/core/importers/dbml")).importDbml,
  json: async () =>
    (await import("@schemaforge/core/importers/json")).importJson,
};

export function loadImporter(format: ImportFormat): Promise<Importer> {
  return loaders[format]();
}
