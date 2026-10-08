import type { ReferentialAction } from "../../model/relation.js";
import type {
  CoreEndpoint,
  CoreRef,
  CoreTable,
  CoreToken,
} from "../shared/dbml-core-adapter-types.js";
import type { DraftDiagnostic, DraftRelation } from "../shared/import-draft.js";
import type { SourceLocation } from "../shared/import-types.js";
import { locationOf } from "./dbml-columns.js";

export type RelationDraftParts = {
  readonly relations: readonly DraftRelation[];
  readonly diagnostics: readonly DraftDiagnostic[];
};

const REFERENTIAL_ACTIONS: ReadonlyMap<string, ReferentialAction> = new Map([
  ["cascade", "cascade"],
  ["restrict", "restrict"],
  ["set null", "setNull"],
  ["set default", "setDefault"],
  ["no action", "noAction"],
]);

function toAction(keyword: string | null): ReferentialAction {
  return REFERENTIAL_ACTIONS.get(keyword?.toLowerCase() ?? "") ?? "noAction";
}

function isAtOrBefore(a: SourceLocation, b: SourceLocation): boolean {
  return a.line < b.line || (a.line === b.line && a.column <= b.column);
}

function compareLocations(a: SourceLocation, b: SourceLocation): number {
  return a.line - b.line || a.column - b.column;
}

// The table tokens by start, each with the furthest end among it and the
// tables that start before it, so whether a ref lies inside some table is a
// binary search instead of a scan of every table (spec section 1).
type TableSpan = {
  readonly start: SourceLocation;
  readonly furthestEnd: SourceLocation;
};

function createTableSpans(tables: readonly CoreTable[]): readonly TableSpan[] {
  const tokens = tables
    .flatMap(({ token }) => (token === null ? [] : [token]))
    .toSorted((a, b) => compareLocations(a.start, b.start));
  const spans: TableSpan[] = [];
  tokens.forEach(({ start, end }) => {
    const previous = spans.at(-1)?.furthestEnd ?? end;
    const furthestEnd = isAtOrBefore(previous, end) ? end : previous;
    spans.push({ start, furthestEnd });
  });
  return spans;
}

function isInsideAnyTable(
  inner: CoreToken,
  spans: readonly TableSpan[],
): boolean {
  // The number of tables that start at or before the ref.
  let low = 0;
  let high = spans.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const span = spans[middle];
    if (span !== undefined && isAtOrBefore(span.start, inner.start)) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  const span = spans[low - 1];
  return span !== undefined && isAtOrBefore(inner.end, span.furthestEnd);
}

/**
 * The foreign key side is `from`: the `*` end of `>` and `<`. For `-` it is
 * the left end, but an inline `ref:` lists the referenced end first, so there
 * it is the column's own (second) end.
 */
function orderEndpoints(
  first: CoreEndpoint,
  second: CoreEndpoint,
  isInline: boolean,
): readonly [CoreEndpoint, CoreEndpoint] {
  if (first.relation !== second.relation) {
    return first.relation === "*" ? [first, second] : [second, first];
  }
  return isInline ? [second, first] : [first, second];
}

function toRelation(
  ref: CoreRef,
  first: CoreEndpoint,
  second: CoreEndpoint,
  spans: readonly TableSpan[],
): DraftRelation {
  const isInline = ref.token !== null && isInsideAnyTable(ref.token, spans);
  const [from, to] = orderEndpoints(first, second, isInline);
  return {
    fromTableName: from.tableName,
    toTableName: to.tableName,
    // The parser rejects ends with different column counts.
    columnPairs: from.columnNames.map((fromColumnName, position) => ({
      fromColumnName,
      toColumnName: to.columnNames[position] ?? "",
    })),
    kind: first.relation === second.relation ? "oneToOne" : "oneToMany",
    onDelete: toAction(ref.onDelete),
    onUpdate: toAction(ref.onUpdate),
    location: locationOf(ref.token),
  };
}

/** `Ref` blocks and inline `ref:` settings (spec section 7); `<>` is dropped. */
export function translateRefs(
  refs: readonly CoreRef[],
  tables: readonly CoreTable[],
): RelationDraftParts {
  const spans = createTableSpans(tables);
  const relations: DraftRelation[] = [];
  const diagnostics: DraftDiagnostic[] = [];
  refs.forEach((ref) => {
    const location = locationOf(ref.token);
    const [first, second] = ref.endpoints;
    if (first === undefined || second === undefined) {
      diagnostics.push({ code: "reference-not-found", location, target: null });
      return;
    }
    if (first.relation === "*" && second.relation === "*") {
      diagnostics.push({
        code: "many-to-many-not-supported",
        location,
        target: null,
      });
      return;
    }
    if (ref.color !== null) {
      const target = { kind: "relation", index: relations.length } as const;
      diagnostics.push({ code: "color-dropped", location, target });
    }
    relations.push(toRelation(ref, first, second, spans));
  });
  return { relations, diagnostics };
}
