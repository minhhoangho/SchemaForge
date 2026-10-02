import type { ReferentialAction } from "../../model/relation.js";

// ON DELETE and ON UPDATE keywords of the SQL DDL generators. Dialect
// differences (MySQL SET DEFAULT, SQL Server RESTRICT) are resolved in the DDL
// model before printing.
export const REFERENTIAL_ACTION_SQL: Readonly<
  Record<ReferentialAction, string>
> = {
  noAction: "NO ACTION",
  restrict: "RESTRICT",
  cascade: "CASCADE",
  setNull: "SET NULL",
  setDefault: "SET DEFAULT",
};
