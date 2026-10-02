import { sortByPathThenCode } from "../../document-path.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { Issue } from "../issue-codes.js";

/** Reports every table without columns: MySQL, SQL Server, and Prisma reject one. */
export function validateTables(schema: SchemaDocument): readonly Issue[] {
  return sortByPathThenCode(
    Object.values(schema.tables)
      .filter((table) => table.columnIds.length === 0)
      .map((table): Issue => ({
        code: "table-columns-empty",
        path: ["tables", table.id, "columnIds"],
      })),
  );
}
