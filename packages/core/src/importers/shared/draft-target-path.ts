import type { DocumentPath } from "../../document-path.js";
import type { AssignedIds } from "./assign-import-ids.js";
import type { DraftTarget, ImportDraft } from "./import-draft.js";
import { elementAt } from "./resolve-references.js";

function toElementPath(
  mapName: string,
  id: string | undefined,
): DocumentPath | null {
  return id === undefined ? null : [mapName, id];
}

// A target past the end of the draft throws in elementAt; a dropped element
// has no id and maps to null.
function findTargetElement(
  target: DraftTarget,
  draft: ImportDraft,
  ids: AssignedIds,
): DocumentPath | null {
  switch (target.kind) {
    case "table":
      return ["tables", elementAt(ids.tables, target.tableIndex)];
    case "column":
      elementAt(
        elementAt(draft.tables, target.tableIndex).columns,
        target.columnIndex,
      );
      return toElementPath(
        "columns",
        elementAt(ids.columnsByDraft, target.tableIndex).get(
          target.columnIndex,
        ),
      );
    case "index":
      elementAt(draft.indexes, target.index);
      return toElementPath("indexes", ids.indexesByDraft.get(target.index));
    case "relation":
      elementAt(draft.relations, target.index);
      return toElementPath("relations", ids.relationsByDraft.get(target.index));
    case "enum":
      return ["enums", elementAt(ids.enums, target.index)];
    case "subjectArea":
      return ["subjectAreas", elementAt(ids.subjectAreas, target.index)];
    case "note":
      return ["notes", elementAt(ids.notes, target.index)];
    default: {
      const unreachable: never = target;
      return unreachable;
    }
  }
}

/**
 * The document path of a draft diagnostic's target (plan Task 2, `path`
 * column), with `field` as the last segment; null for no target or a dropped
 * element.
 */
export function toDocumentPath(
  target: DraftTarget | null,
  draft: ImportDraft,
  ids: AssignedIds,
): DocumentPath | null {
  if (target === null) {
    return null;
  }
  const element = findTargetElement(target, draft, ids);
  return element === null || target.field === undefined
    ? element
    : [...element, target.field];
}
