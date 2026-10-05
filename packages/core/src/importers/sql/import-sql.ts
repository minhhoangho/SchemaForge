import type { SqlDialect } from "../../generators/shared/generator-types.js";
import { err, ok, type Result } from "../../result.js";
import { assembleDocument } from "../shared/assemble-document.js";
import { parseSqlWithDbmlCore } from "../shared/dbml-core-adapter.js";
import type { CoreDatabase } from "../shared/dbml-core-adapter-types.js";
import type { ImportDiagnosticCode } from "../shared/import-diagnostic-codes.js";
import type { DraftDiagnostic, ImportDraft } from "../shared/import-draft.js";
import { createImportDiagnostic } from "../shared/import-diagnostics.js";
import { checkSourceLength } from "../shared/import-limits.js";
import type {
  ImportFailure,
  ImportOptions,
  ImportResult,
  Importer,
} from "../shared/import-types.js";
import {
  createLineStarts,
  toSourceLocation,
} from "../shared/source-location.js";
import { classifyStatement, type StatementKind } from "./classify-statement.js";
import { readPostgresqlAlterColumn } from "./postgresql-identity.js";
import {
  readAddedUniqueConstraint,
  readSqlTableDefinition,
  type SqlTableDefinition,
} from "./sql-column-definitions.js";
import { buildSqlDraft } from "./sql-draft.js";
import { locateSqlElements } from "./sql-element-locations.js";
import { hideCustomTypes, hideWithCheckClauses } from "./sql-parser-source.js";
import { readSqlIndexDefinition } from "./sql-index-definitions.js";
import { readSqlServerDescription } from "./sqlserver-extended-property.js";
import {
  scanSqlStatements,
  maskStatements,
  type SqlStatement,
} from "./statement-scanner.js";

type ClassifiedStatement = {
  readonly statement: SqlStatement;
  readonly kind: StatementKind;
};

type Locate = (offset: number) => DraftDiagnostic["location"];

// Statements of a kind the model has no concept for, by their diagnostic.
const UNSUPPORTED_KIND_CODES: ReadonlyMap<StatementKind, ImportDiagnosticCode> =
  new Map<StatementKind, ImportDiagnosticCode>([
    ["view", "view-not-supported"],
    ["routine", "routine-not-supported"],
    ["trigger", "trigger-not-supported"],
    ["sequence", "sequence-not-supported"],
    ["unsupported", "statement-not-supported"],
  ]);

function statementsOf(
  classified: readonly ClassifiedStatement[],
  kind: StatementKind,
): readonly SqlStatement[] {
  return classified
    .filter((entry) => entry.kind === kind)
    .map(({ statement }) => statement);
}

// One diagnostic per unsupported statement and one for all data statements
// (spec section 5, statement table).
function reportStatements(
  classified: readonly ClassifiedStatement[],
  at: Locate,
): readonly DraftDiagnostic[] {
  const [firstData] = statementsOf(classified, "data");
  return [
    ...classified.flatMap(({ statement, kind }) => {
      const code = UNSUPPORTED_KIND_CODES.get(kind);
      return code === undefined
        ? []
        : [{ code, location: at(statement.start), target: null }];
    }),
    ...(firstData === undefined
      ? []
      : [
          {
            code: "data-statements-ignored",
            location: at(firstData.start),
            target: null,
          } as const,
        ]),
  ];
}

// Reads the statements the scanner handles instead of the parser; one it
// cannot read is reported as statement-not-supported.
function readScannerStatements<Read>(
  statements: readonly SqlStatement[],
  read: (statement: SqlStatement) => Read | null,
  unread: DraftDiagnostic[],
  at: Locate,
): readonly Read[] {
  return statements.flatMap((statement) => {
    const value = read(statement);
    if (value === null) {
      unread.push({
        code: "statement-not-supported",
        location: at(statement.start),
        target: null,
      });
      return [];
    }
    return [value];
  });
}

type ParsedSql = {
  readonly classified: readonly ClassifiedStatement[];
  // The statements given to the parser, in source order.
  readonly kept: readonly SqlStatement[];
  readonly tableDefinitions: readonly SqlTableDefinition[];
  readonly database: CoreDatabase;
};

// Steps 2 to 4: scans and classifies the statements, then parses the ones
// the parser reads.
function parseSql(
  dialect: SqlDialect,
  source: string,
  at: Locate,
): Result<ParsedSql, ImportFailure> {
  const scanned = scanSqlStatements(source, dialect);
  if (!scanned.isOk) {
    const { error } = scanned;
    const location = error.code === "syntax-error" ? at(error.offset) : null;
    return err({
      diagnostics: [createImportDiagnostic(error.code, location, null)],
    });
  }
  const classified = scanned.value.map((statement) => ({
    statement,
    kind: classifyStatement(statement, dialect),
  }));
  const kept = statementsOf(classified, "parser");
  const keptSet = new Set(kept);
  const tableDefinitions = kept.flatMap(
    (statement) => readSqlTableDefinition(statement, source) ?? [],
  );
  const masked = maskStatements(source, scanned.value, (statement) =>
    keptSet.has(statement),
  );
  const parserSource = hideCustomTypes({
    source: hideWithCheckClauses({ source: masked, statements: kept, dialect }),
    definitions: tableDefinitions,
    dialect,
  });
  const parsed = parseSqlWithDbmlCore(parserSource, dialect);
  return parsed.isOk
    ? ok({ classified, kept, tableDefinitions, database: parsed.value })
    : err({ diagnostics: parsed.error });
}

// Steps 5 to 7 on what parseSql read.
function draftParsedSql(
  dialect: SqlDialect,
  parsed: ParsedSql,
  lineStarts: readonly number[],
  at: Locate,
): ImportDraft {
  const { classified, kept } = parsed;
  const unread: DraftDiagnostic[] = [];
  const draft = buildSqlDraft({
    dialect,
    database: parsed.database,
    locations: locateSqlElements({
      statements: kept,
      tableDefinitions: parsed.tableDefinitions,
      lineStarts,
    }),
    indexDefinitions: kept.flatMap((s) => readSqlIndexDefinition(s) ?? []),
    addedUniqueConstraints: kept.flatMap(
      (statement) => readAddedUniqueConstraint(statement) ?? [],
    ),
    alterColumns: readScannerStatements(
      statementsOf(classified, "postgresqlAlterColumn"),
      readPostgresqlAlterColumn,
      unread,
      at,
    ),
    descriptions: readScannerStatements(
      statementsOf(classified, "sqlserverExtendedProperty"),
      readSqlServerDescription,
      unread,
      at,
    ),
  });
  return {
    ...draft,
    diagnostics: [
      ...reportStatements(classified, at),
      ...unread,
      ...draft.diagnostics,
    ],
  };
}

/**
 * Reads SQL DDL into a draft (import / export spec, section 5, steps 1 to 7);
 * exported for the draft tests.
 */
export function draftSql(
  dialect: SqlDialect,
  source: string,
): Result<ImportDraft, ImportFailure> {
  const tooLarge = checkSourceLength(source);
  if (tooLarge !== null) {
    return err(tooLarge);
  }
  const lineStarts = createLineStarts(source);
  const at: Locate = (offset) => toSourceLocation(lineStarts, offset);
  const parsed = parseSql(dialect, source, at);
  return parsed.isOk
    ? ok(draftParsedSql(dialect, parsed.value, lineStarts, at))
    : parsed;
}

function importSql(
  dialect: SqlDialect,
  source: string,
  options: ImportOptions,
): ImportResult {
  const draft = draftSql(dialect, source);
  return draft.isOk ? assembleDocument(draft.value, options) : draft;
}

/** Imports PostgreSQL DDL such as `pg_dump --schema-only` (spec section 5). */
export const importPostgresql: Importer = (source, options) =>
  importSql("postgresql", source, options);

/** Imports MySQL DDL such as `mysqldump --no-data` (spec section 5). */
export const importMysql: Importer = (source, options) =>
  importSql("mysql", source, options);

/** Imports SQL Server DDL such as an SSMS "Generate Scripts" file (spec section 5). */
export const importSqlserver: Importer = (source, options) =>
  importSql("sqlserver", source, options);
