import type { SchemaDocument } from "../../../model/schema-document.js";
import {
  buildSchema,
  makeColumn,
  makeTable,
} from "../../../testing/factories.js";
import type { ImportDiagnostic } from "../../shared/import-types.js";

// PostgreSQL DDL with one table and a statement of every kind the model has
// no concept for: a domain, a sequence, a view, a function, a trigger, row
// level security, a policy and data.

export const UNSUPPORTED_STATEMENTS_SOURCE = `CREATE TABLE public.accounts (
    id integer NOT NULL,
    balance numeric(12,2) DEFAULT 0 NOT NULL
);
CREATE DOMAIN public.positive_amount AS numeric CHECK (VALUE > 0);
CREATE SEQUENCE public.invoice_seq START WITH 1;
CREATE VIEW public.rich_accounts AS
    SELECT id FROM public.accounts WHERE balance > 1000;
CREATE FUNCTION public.touch() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.balance := NEW.balance;
    RETURN NEW;
END;
$$;
CREATE TRIGGER accounts_touch BEFORE UPDATE ON public.accounts
    FOR EACH ROW EXECUTE FUNCTION public.touch();
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY accounts_owner ON public.accounts USING (true);
INSERT INTO public.accounts (id, balance) VALUES (1, 10);
INSERT INTO public.accounts (id, balance) VALUES (2, 20);
`;

export const UNSUPPORTED_STATEMENTS_EXPECTED: SchemaDocument = buildSchema({
  name: "Imported",
  tables: [makeTable({ id: "tbl_accounts" })],
  columns: [
    makeColumn({ id: "col_accounts_id", tableId: "tbl_accounts", name: "id" }),
    makeColumn({
      id: "col_accounts_balance",
      tableId: "tbl_accounts",
      name: "balance",
      type: { kind: "decimal", precision: 12, scale: 2 },
      defaultValue: { kind: "literal", value: "0" },
    }),
  ],
});

// One diagnostic per statement at its first line, and one for both INSERTs.
export const UNSUPPORTED_STATEMENTS_EXPECTED_DIAGNOSTICS: readonly ImportDiagnostic[] =
  [
    {
      code: "statement-not-supported",
      location: { line: 5, column: 1 },
      path: null,
    },
    {
      code: "sequence-not-supported",
      location: { line: 6, column: 1 },
      path: null,
    },
    {
      code: "view-not-supported",
      location: { line: 7, column: 1 },
      path: null,
    },
    {
      code: "routine-not-supported",
      location: { line: 9, column: 1 },
      path: null,
    },
    {
      code: "trigger-not-supported",
      location: { line: 17, column: 1 },
      path: null,
    },
    {
      code: "statement-not-supported",
      location: { line: 19, column: 1 },
      path: null,
    },
    {
      code: "statement-not-supported",
      location: { line: 20, column: 1 },
      path: null,
    },
    {
      code: "data-statements-ignored",
      location: { line: 21, column: 1 },
      path: null,
    },
  ];
