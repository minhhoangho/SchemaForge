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

function isInside(inner: CoreToken, outer: CoreToken | null): boolean {
  return (
    outer !== null &&
    isAtOrBefore(outer.start, inner.start) &&
    isAtOrBefore(inner.end, outer.end)
  );
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
  tables: readonly CoreTable[],
): DraftRelation {
  const isInline =
    ref.token !== null &&
    tables.some(
      (table) => ref.token !== null && isInside(ref.token, table.token),
    );
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
    relations.push(toRelation(ref, first, second, tables));
  });
  return { relations, diagnostics };
}
