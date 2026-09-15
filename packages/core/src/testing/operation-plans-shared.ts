import type { ColumnType } from "../model/column-type.js";
import type { Column } from "../model/column.js";
import type {
  ColumnId,
  EnumId,
  IndexId,
  NoteId,
  RelationId,
  SubjectAreaId,
  TableId,
} from "../model/ids.js";
import type { Position } from "../model/position.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Table } from "../model/table.js";
import type { Operation, OperationType } from "../operations/operation.js";

/**
 * An abstract intent for one operation, independent of any schema. The same
 * plan resolves to a concrete operation on whatever schema it is applied to:
 * `picks` choose among the elements that exist (modulo their count), `text`
 * supplies names and values, and `flags` toggle optional parts. A corrupted
 * plan resolves to an operation that breaks one of the operation's
 * conditions. `steps` is used only by `batch` plans.
 */
export type OperationPlan = {
  readonly type: OperationType;
  readonly picks: readonly number[];
  readonly text: string;
  readonly flags: readonly boolean[];
  readonly isCorrupted: boolean;
  readonly steps: readonly OperationPlan[];
};

// The counter id generator only produces digits, so these ids never collide
// with a generated one.
const MISSING_TOKEN = "missing";
export const MISSING_TABLE_ID: TableId = `tbl_${MISSING_TOKEN}`;
export const MISSING_COLUMN_ID: ColumnId = `col_${MISSING_TOKEN}`;
export const MISSING_RELATION_ID: RelationId = `rel_${MISSING_TOKEN}`;
export const MISSING_INDEX_ID: IndexId = `idx_${MISSING_TOKEN}`;
export const MISSING_ENUM_ID: EnumId = `enum_${MISSING_TOKEN}`;
export const MISSING_SUBJECT_AREA_ID: SubjectAreaId = `area_${MISSING_TOKEN}`;
export const MISSING_NOTE_ID: NoteId = `note_${MISSING_TOKEN}`;

/** The pick that chooses the main element an operation targets. */
export const ELEMENT_SLOT = 2;

/** The pick that chooses which condition a corrupted plan breaks. */
export const CORRUPTION_SLOT = 5;

const POSITION_OFFSET = 500;

/** The pick at `slot`, or 0 when the plan has fewer picks. */
export function pickAt(plan: OperationPlan, slot: number): number {
  return plan.picks[slot] ?? 0;
}

/** The flag at `slot`, or false when the plan has fewer flags. */
export function isFlagSet(plan: OperationPlan, slot: number): boolean {
  return plan.flags[slot] ?? false;
}

/** Which of `variantCount` corruptions a corrupted plan applies. */
export function variantOf(plan: OperationPlan, variantCount: number): number {
  return pickAt(plan, CORRUPTION_SLOT) % variantCount;
}

/** The element at `pick` modulo the list length, or undefined for an empty list. */
export function chooseFrom<Element>(
  elements: readonly Element[],
  pick: number,
): Element | undefined {
  return elements.length === 0 ? undefined : elements[pick % elements.length];
}

/** Up to `count` distinct elements starting at `pick`, wrapping around. */
export function chooseSeveral<Element>(
  elements: readonly Element[],
  pick: number,
  count: number,
): readonly Element[] {
  const start = elements.length === 0 ? 0 : pick % elements.length;
  return [...elements.slice(start), ...elements.slice(0, start)].slice(
    0,
    count,
  );
}

export function positionFrom(plan: OperationPlan): Position {
  return {
    x: pickAt(plan, 0) - POSITION_OFFSET,
    y: pickAt(plan, 1) - POSITION_OFFSET,
  };
}

/** Adding the same element twice: the second step always fails. */
export function duplicatedAdd(operation: Operation): Operation {
  return { type: "batch", operations: [operation, operation] };
}

// `<` and `>` compare code units, so resolution never depends on map key order.
export function sortedById<Element extends { readonly id: string }>(
  elements: readonly Element[],
): readonly Element[] {
  return elements.toSorted((left, right) => {
    if (left.id < right.id) {
      return -1;
    }
    return left.id > right.id ? 1 : 0;
  });
}

export function tablesOf(schema: SchemaDocument): readonly Table[] {
  return sortedById(Object.values(schema.tables));
}

export function tablesWithColumns(schema: SchemaDocument): readonly Table[] {
  return tablesOf(schema).filter((table) => table.columnIds.length > 0);
}

export function columnsOf(schema: SchemaDocument): readonly Column[] {
  return sortedById(Object.values(schema.columns));
}

/** A column of any table other than `table`, if one exists. */
export function columnOutside(
  schema: SchemaDocument,
  table: Table,
  pick: number,
): Column | undefined {
  return chooseFrom(
    columnsOf(schema).filter((column) => column.tableId !== table.id),
    pick,
  );
}

const FIXED_COLUMN_TYPES: readonly ColumnType[] = [
  { kind: "integer" },
  { kind: "bigint" },
  { kind: "varchar", length: 255 },
  { kind: "text" },
  { kind: "uuid" },
  { kind: "boolean" },
  { kind: "timestamptz" },
  // Scale above precision: a semantic issue, still a valid shape.
  { kind: "decimal", precision: 3, scale: 5 },
  { kind: "custom", name: "geometry" },
];

/** A column type; every existing enum adds one more choice. */
export function columnTypeFor(
  schema: SchemaDocument,
  pick: number,
): ColumnType {
  const enumTypes = sortedById(Object.values(schema.enums)).map(
    (element): ColumnType => ({ kind: "enum", enumId: element.id }),
  );
  return (
    chooseFrom([...FIXED_COLUMN_TYPES, ...enumTypes], pick) ?? {
      kind: "integer",
    }
  );
}
