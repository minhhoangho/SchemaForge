import type { SqlDialect } from "../../generators/shared/generator-types.js";
import { err, ok, type Result } from "../../result.js";
import { MAX_IMPORT_SOURCE_LENGTH } from "../shared/import-limits.js";
import { lexNext, type SqlToken } from "./sql-lexer.js";

export {
  tokenizeSql,
  type ScanFailure,
  type SqlToken,
  type SqlTokenKind,
} from "./sql-lexer.js";

// `start` is the offset of the first token; `end` is the offset after the
// terminator (`;`, the MySQL delimiter, or the `GO` of a SQL Server GO line),
// or after the last token when the source or a psql meta-command line follows
// without one. A PostgreSQL `COPY … FROM stdin` statement ends after its data,
// at the end of the `\.` line; a psql meta-command line is a statement of its
// own that ends at the end of the line.
export type SqlStatement = {
  readonly start: number;
  readonly end: number;
  readonly tokens: readonly SqlToken[];
};

// An unterminated string, comment, dollar quote or quoted identifier at
// `offset`, or a source with more tokens than MAX_SCANNED_TOKENS.
export type StatementScanFailure =
  | { readonly code: "syntax-error"; readonly offset: number }
  | { readonly code: "source-too-large" };

type ScanState = {
  tokens: SqlToken[];
  tokenCount: number;
  depth: number;
  delimiter: string;
  readonly statements: SqlStatement[];
};

const DEFAULT_DELIMITER = ";";
const COPY_DATA_END = "\\.";

// The terminator is compared at every token, so its length multiplies the
// scan cost. Real delimiters (`;;`, `//`, `$$`) are a few characters long.
export const MAX_DELIMITER_LENGTH = 16;

// Bounds the memory of a crafted source (2 MiB of `(` is 2 million token
// objects). Generated DDL and seed data average more than 4.5 characters a
// token, so a real source at the length limit stays under a quarter of it.
export const MAX_SCANNED_TOKENS = MAX_IMPORT_SOURCE_LENGTH / 4;

function finishStatement(state: ScanState, end: number): void {
  const first = state.tokens[0];
  if (first !== undefined) {
    state.statements.push({ start: first.start, end, tokens: state.tokens });
  }
  state.tokens = [];
  state.depth = 0;
}

// Ends the open statement, which has no terminator, after its last token.
function finishOpenStatement(state: ScanState): void {
  const last = state.tokens.at(-1);
  finishStatement(
    state,
    last === undefined ? 0 : last.start + last.text.length,
  );
}

// Adds a token to the open statement, or returns false when the source has
// more tokens than MAX_SCANNED_TOKENS.
function pushToken(state: ScanState, token: SqlToken): boolean {
  if (state.tokenCount === MAX_SCANNED_TOKENS) {
    return false;
  }
  state.tokens.push(token);
  state.tokenCount += 1;
  return true;
}

// Handles a SQL Server `GO` line or a MySQL `DELIMITER <text>` line starting
// at `offset`, and returns the offset after it, or null for any other line.
function readLineCommand(
  source: string,
  offset: number,
  dialect: SqlDialect,
  state: ScanState,
): number | null {
  if (
    dialect === "postgresql" ||
    (offset > 0 && source.charAt(offset - 1) !== "\n")
  ) {
    return null;
  }
  const newline = source.indexOf("\n", offset);
  const lineEnd = newline === -1 ? source.length : newline;
  const words = source.slice(offset, lineEnd).trim().split(/\s+/);
  const command = words[0]?.toUpperCase();
  if (dialect === "sqlserver" && command === "GO" && words.length === 1) {
    finishStatement(
      state,
      offset + source.slice(offset, lineEnd).trimEnd().length,
    );
    return lineEnd;
  }
  const delimiter = words[1];
  if (
    dialect === "mysql" &&
    command === "DELIMITER" &&
    delimiter !== undefined &&
    delimiter.length <= MAX_DELIMITER_LENGTH &&
    state.tokens.length === 0
  ) {
    state.delimiter = delimiter;
    return lineEnd;
  }
  return null;
}

// Meta-commands that pg_dump writes and that change no model structure: the
// dump guard of PostgreSQL 18 (`\restrict`, `\unrestrict`) and `\connect`.
// psql command names are case-sensitive (`\C` sets the table title).
const IGNORED_PSQL_META_COMMANDS: ReadonlySet<string> = new Set([
  "restrict",
  "unrestrict",
  "connect",
  "c",
]);

const LINE_INDENT = " \t";

// Whether only spaces and tabs stand between the start of the line and
// `offset`. Each run of indentation is walked back from at most one
// character, so the scan stays linear.
function isFirstOnLine(source: string, offset: number): boolean {
  let index = offset - 1;
  while (index >= 0 && LINE_INDENT.includes(source.charAt(index))) {
    index -= 1;
  }
  return index < 0 || source.charAt(index) === "\n";
}

// psql reads a line that starts with a backslash as a meta-command, which ends
// at the end of the line rather than at `;`. Handles one at `offset` and
// returns the offset of the end of its line, or null for any other text. A
// statement left open before it ends there; ignored meta-commands produce no
// statement, others a statement of one token, read as statement-not-supported.
function readPsqlMetaCommand(
  source: string,
  offset: number,
  state: ScanState,
): Result<number, StatementScanFailure> | null {
  if (source.charAt(offset) !== "\\" || !isFirstOnLine(source, offset)) {
    return null;
  }
  const newline = source.indexOf("\n", offset);
  const lineEnd = newline === -1 ? source.length : newline;
  const text = source.slice(offset, lineEnd).trimEnd();
  finishOpenStatement(state);
  const name = text.slice(1).split(/\s/, 1)[0] ?? "";
  if (IGNORED_PSQL_META_COMMANDS.has(name)) {
    return ok(lineEnd);
  }
  const token: SqlToken = {
    kind: "symbol",
    text,
    value: text,
    start: offset,
    depth: 0,
  };
  if (!pushToken(state, token)) {
    return err({ code: "source-too-large" });
  }
  finishStatement(state, offset + text.length);
  return ok(lineEnd);
}

function isCopyFromStdin(tokens: readonly SqlToken[]): boolean {
  const words = tokens.map((token) =>
    token.kind === "word" ? token.text.toUpperCase() : "",
  );
  return (
    words[0] === "COPY" &&
    words.some((word, index) => word === "FROM" && words[index + 1] === "STDIN")
  );
}

// psql reads the data of `COPY … FROM stdin` from the line after the
// statement up to a line `\.`; the data is not SQL, so it is not lexed.
// Without that line, the data runs to the end of the source.
function findCopyDataEnd(source: string, from: number): number {
  let lineStart = source.indexOf("\n", from) + 1;
  while (lineStart > 0) {
    const newline = source.indexOf("\n", lineStart);
    const lineEnd = newline === -1 ? source.length : newline;
    if (source.slice(lineStart, lineEnd).trimEnd() === COPY_DATA_END) {
      return lineStart + COPY_DATA_END.length;
    }
    lineStart = newline + 1;
  }
  return source.length;
}

function scanStep(
  source: string,
  offset: number,
  dialect: SqlDialect,
  state: ScanState,
): Result<number, StatementScanFailure> {
  const commandEnd = readLineCommand(source, offset, dialect, state);
  if (commandEnd !== null) {
    return ok(commandEnd);
  }
  const metaCommandEnd =
    dialect === "postgresql"
      ? readPsqlMetaCommand(source, offset, state)
      : null;
  if (metaCommandEnd !== null) {
    return metaCommandEnd;
  }
  if (state.depth === 0 && source.startsWith(state.delimiter, offset)) {
    const terminatorEnd = offset + state.delimiter.length;
    const isCopyData =
      dialect === "postgresql" && isCopyFromStdin(state.tokens);
    const end = isCopyData
      ? findCopyDataEnd(source, terminatorEnd)
      : terminatorEnd;
    finishStatement(state, end);
    return ok(end);
  }
  const step = lexNext(source, offset, dialect, state.depth);
  if (!step.isOk) {
    return err({ code: "syntax-error", offset: step.error.offset });
  }
  if (step.value.token !== null && !pushToken(state, step.value.token)) {
    return err({ code: "source-too-large" });
  }
  state.depth = step.value.depth;
  return ok(step.value.next);
}

export function scanSqlStatements(
  source: string,
  dialect: SqlDialect,
): Result<readonly SqlStatement[], StatementScanFailure> {
  const state: ScanState = {
    tokens: [],
    tokenCount: 0,
    depth: 0,
    delimiter: DEFAULT_DELIMITER,
    statements: [],
  };
  let offset = 0;
  while (offset < source.length) {
    const next = scanStep(source, offset, dialect, state);
    if (!next.isOk) {
      return next;
    }
    offset = next.value;
  }
  finishOpenStatement(state);
  return ok(state.statements);
}

function blankOut(text: string): string {
  return text.replace(/[^\r\n]/g, " ");
}

// Replaces every character outside a kept statement with a space, keeping line
// breaks, so offsets, lines and columns of the result match the source.
export function maskStatements(
  source: string,
  statements: readonly SqlStatement[],
  shouldKeep: (statement: SqlStatement) => boolean,
): string {
  const parts: string[] = [];
  let offset = 0;
  for (const statement of statements.filter(shouldKeep)) {
    parts.push(
      blankOut(source.slice(offset, statement.start)),
      source.slice(statement.start, statement.end),
    );
    offset = statement.end;
  }
  parts.push(blankOut(source.slice(offset)));
  return parts.join("");
}
