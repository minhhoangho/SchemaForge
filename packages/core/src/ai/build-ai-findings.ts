import type { ColumnId, TableId } from "../model/ids.js";
import type { SchemaDocument } from "../model/schema-document.js";
import { err, ok, type Result } from "../result.js";
import type { AiEditError } from "./ai-edit-error-codes.js";
import type { AiFindingsInput } from "./ai-edit-tools.js";
import { formatAiName } from "./describe-path-for-ai.js";
import { findColumnByName, findTableByName } from "./resolve-ai-names.js";

type AiFindingInput = AiFindingsInput["findings"][number];

export type AiFindingTarget = {
  readonly tableId: TableId;
  readonly columnId: ColumnId | null;
};

// Field for field one item of `aiFindingsDataSchema` in api-contract.
export type AiFinding = {
  readonly kind: AiFindingInput["kind"];
  readonly category: AiFindingInput["category"];
  readonly title: string;
  readonly detail: string;
  readonly targets: readonly AiFindingTarget[];
};

type TargetsResult = Result<readonly AiFindingTarget[], readonly AiEditError[]>;

// Names come from the requested input, so `at` names what the model asked for.
function resolveTargets(
  original: SchemaDocument,
  finding: AiFindingInput,
  index: number,
): TargetsResult {
  const at = `findings.${String(index)}`;
  const columns = finding.columns ?? [];
  if (finding.table === undefined) {
    return columns.length === 0
      ? ok([])
      : err([{ code: "table-name-not-found", path: ["findings", index], at }]);
  }
  const table = findTableByName(original, finding.table);
  if (table === null) {
    return err([
      {
        code: "table-name-not-found",
        path: ["findings", index, "table"],
        at: `${at}.tables.${formatAiName(finding.table)}`,
      },
    ]);
  }
  if (columns.length === 0) {
    return ok([{ tableId: table.id, columnId: null }]);
  }
  const targets: AiFindingTarget[] = [];
  const errors: AiEditError[] = [];
  for (const [position, name] of columns.entries()) {
    const column = findColumnByName(original, table, name);
    if (column === null) {
      errors.push({
        code: "column-name-not-found",
        path: ["findings", index, "columns", position],
        at: `${at}.tables.${formatAiName(table.name)}.columns.${formatAiName(name)}`,
      });
    } else {
      targets.push({ tableId: table.id, columnId: column.id });
    }
  }
  return errors.length === 0 ? ok(targets) : err(errors);
}

/**
 * Resolves the table and column names of a `reportFindings` call against the
 * original document (AI-R35). Every unknown name across all findings is
 * reported, in input order; the turn-wide `findings-limit` is the backend's.
 */
export function buildAiFindings(
  original: SchemaDocument,
  input: AiFindingsInput,
): Result<readonly AiFinding[], readonly AiEditError[]> {
  const resolved = input.findings.map((finding, index) => ({
    finding,
    targets: resolveTargets(original, finding, index),
  }));
  const errors = resolved.flatMap(({ targets }) =>
    targets.isOk ? [] : targets.error,
  );
  if (errors.length > 0) {
    return err(errors);
  }
  return ok(
    resolved.flatMap(({ finding, targets }) =>
      targets.isOk
        ? [
            {
              kind: finding.kind,
              category: finding.category,
              title: finding.title,
              detail: finding.detail,
              targets: targets.value,
            },
          ]
        : [],
    ),
  );
}
