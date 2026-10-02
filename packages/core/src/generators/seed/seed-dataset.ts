import { z } from "zod";

import type { DocumentPath } from "../../document-path.js";
import type { StructuralError } from "../../error-codes.js";
import { columnIdShape, tableIdShape } from "../../model/ids.js";
import type { ColumnId, TableId } from "../../model/ids.js";
import { toStructuralErrors } from "../../parse/zod-issues.js";
import { err, ok } from "../../result.js";
import type { Result } from "../../result.js";
import type { JsonValue } from "../shared/json-representation.js";

// A missing key means the database fills in the column's default.
export type SeedRow = Readonly<Partial<Record<ColumnId, JsonValue>>>;

export type SeedDataset = {
  // In load order.
  readonly tables: readonly {
    readonly tableId: TableId;
    readonly rows: readonly SeedRow[];
  }[];
};

export const SEED_ISSUE_CODES = [
  "seed-value-invalid",
  "seed-value-null",
  "seed-unique-violation",
  "seed-foreign-key-missing",
  "seed-order-invalid",
] as const;

export type SeedIssueCode = (typeof SEED_ISSUE_CODES)[number];

export type SeedIssue = {
  readonly code: SeedIssueCode;
  readonly path: DocumentPath;
};

// SQL Server accepts at most 1000 rows in one VALUES list.
export const SEED_ROWS_PER_TABLE_MAXIMUM = 1000;

// The root has depth 0 and each nested array or object adds one. The deepest
// container `buildSeedDataset` writes (a json column's `{ value: n }`) is at 5.
export const SEED_DATASET_MAX_DEPTH = 64;

const SEED_MAXIMUM = 0xffffffff;

export type SeedDatasetOptions = {
  readonly rowsPerTable: number;
  readonly seed: number;
};

function isIntegerBetween(
  value: number,
  minimum: number,
  maximum: number,
): boolean {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

/** An option outside its domain is a programmer error (spec section 1). */
export function assertSeedDatasetOptions(options: SeedDatasetOptions): void {
  if (!isIntegerBetween(options.rowsPerTable, 1, SEED_ROWS_PER_TABLE_MAXIMUM)) {
    throw new RangeError(
      `rowsPerTable must be an integer from 1 to ${String(SEED_ROWS_PER_TABLE_MAXIMUM)}, got ${String(options.rowsPerTable)}`,
    );
  }
  if (!isIntegerBetween(options.seed, 0, SEED_MAXIMUM)) {
    throw new RangeError(
      `seed must be an unsigned 32-bit integer, got ${String(options.seed)}`,
    );
  }
}

const seedDatasetShape = z.strictObject({
  tables: z.array(
    z.strictObject({
      tableId: tableIdShape,
      rows: z
        .array(z.partialRecord(columnIdShape, z.json()))
        .max(SEED_ROWS_PER_TABLE_MAXIMUM),
    }),
  ),
});

type PendingNode = {
  readonly value: unknown;
  readonly path: DocumentPath;
  readonly depth: number;
};

function listChildren(value: object): readonly [string | number, unknown][] {
  return Array.isArray(value)
    ? value.map((child: unknown, index) => [index, child])
    : Object.entries(value);
}

// Explicit stack instead of recursion, so input nested far past the limit
// cannot overflow the call stack. Children are pushed in reverse so the first
// container past the limit in reading order is reported.
function findTooDeepPath(input: unknown): DocumentPath | null {
  const stack: PendingNode[] = [{ value: input, path: [], depth: 0 }];
  for (let node = stack.pop(); node !== undefined; node = stack.pop()) {
    if (typeof node.value !== "object" || node.value === null) {
      continue;
    }
    if (node.depth > SEED_DATASET_MAX_DEPTH) {
      return node.path;
    }
    const { path, depth } = node;
    const children = listChildren(node.value).map(([key, child]) => ({
      value: child,
      path: [...path, key],
      depth: depth + 1,
    }));
    stack.push(...children.toReversed());
  }
  return null;
}

/**
 * Checks only the shape of unknown input (Vấn đề 19); whether its tables,
 * columns and values fit a schema is `validateSeedDataset`'s job. Depth is
 * checked before Zod, which recurses once per nesting level.
 */
export function parseSeedDataset(
  input: unknown,
): Result<SeedDataset, readonly StructuralError[]> {
  const tooDeepPath = findTooDeepPath(input);
  if (tooDeepPath !== null) {
    return err([{ code: "invalid-shape", path: tooDeepPath }]);
  }
  const parsed = seedDatasetShape.safeParse(input);
  return parsed.success
    ? ok(parsed.data)
    : err(toStructuralErrors(parsed.error.issues));
}
