import type { Enum } from "../model/enum.js";
import type { GenerateId, NoteId, TableId } from "../model/ids.js";
import {
  createEnumId,
  createNoteId,
  createSubjectAreaId,
} from "../model/ids.js";
import type { Note } from "../model/note.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { SubjectArea } from "../model/subject-area.js";
import type { Operation, OperationOfType } from "../operations/operation.js";
import type { OperationPlan } from "./operation-plans-shared.js";
import {
  ELEMENT_SLOT,
  MISSING_ENUM_ID,
  MISSING_NOTE_ID,
  MISSING_SUBJECT_AREA_ID,
  MISSING_TABLE_ID,
  chooseFrom,
  chooseSeveral,
  duplicatedAdd,
  isFlagSet,
  pickAt,
  positionFrom,
  sortedById,
  tablesOf,
  variantOf,
} from "./operation-plans-shared.js";

const MAX_MOVE_COUNT = 4;
const MOVE_SPACING = 40;

function enumsOf(schema: SchemaDocument): readonly Enum[] {
  return sortedById(Object.values(schema.enums));
}

function subjectAreasOf(schema: SchemaDocument): readonly SubjectArea[] {
  return sortedById(Object.values(schema.subjectAreas));
}

function notesOf(schema: SchemaDocument): readonly Note[] {
  return sortedById(Object.values(schema.notes));
}

// A rename never fails, so a corrupted one is followed by a failing step.
export function resolveRenameSchema(plan: OperationPlan): Operation {
  const rename: Operation = { type: "renameSchema", name: plan.text };
  return plan.isCorrupted
    ? {
        type: "batch",
        operations: [
          rename,
          { type: "removeTable", tableId: MISSING_TABLE_ID },
        ],
      }
    : rename;
}

export function resolveAddEnum(
  schema: SchemaDocument,
  plan: OperationPlan,
  generateId: GenerateId,
): Operation {
  const added: Enum = {
    id: createEnumId(generateId),
    name: plan.text,
    values: isFlagSet(plan, 0) ? [] : [plan.text, "active"],
  };
  const existing = chooseFrom(enumsOf(schema), pickAt(plan, ELEMENT_SLOT));
  if (!plan.isCorrupted) {
    return { type: "addEnum", enum: added };
  }
  return existing === undefined
    ? duplicatedAdd({ type: "addEnum", enum: added })
    : { type: "addEnum", enum: { ...added, id: existing.id } };
}

export function resolveUpdateEnum(
  schema: SchemaDocument,
  plan: OperationPlan,
  generateId: GenerateId,
): Operation {
  const current = chooseFrom(enumsOf(schema), pickAt(plan, ELEMENT_SLOT));
  if (current === undefined && !plan.isCorrupted) {
    return resolveAddEnum(schema, plan, generateId);
  }
  const changes = {
    ...(isFlagSet(plan, 0) ? { name: plan.text } : {}),
    ...(isFlagSet(plan, 1) ? { values: [plan.text] } : {}),
  };
  const enumId =
    current === undefined || plan.isCorrupted ? MISSING_ENUM_ID : current.id;
  return { type: "updateEnum", enumId, changes };
}

function usedEnumIds(schema: SchemaDocument): ReadonlySet<string> {
  return new Set(
    Object.values(schema.columns).flatMap((column) =>
      column.type.kind === "enum" ? [column.type.enumId] : [],
    ),
  );
}

export function resolveRemoveEnum(
  schema: SchemaDocument,
  plan: OperationPlan,
  generateId: GenerateId,
): Operation {
  const usedIds = usedEnumIds(schema);
  const enums = enumsOf(schema);
  const pick = pickAt(plan, ELEMENT_SLOT);
  if (plan.isCorrupted) {
    const inUse = chooseFrom(
      enums.filter((element) => usedIds.has(element.id)),
      pick,
    );
    const isInUseVariant = variantOf(plan, 2) === 0 && inUse !== undefined;
    const enumId = isInUseVariant ? inUse.id : MISSING_ENUM_ID;
    return { type: "removeEnum", enumId };
  }
  const unused = chooseFrom(
    enums.filter((element) => !usedIds.has(element.id)),
    pick,
  );
  return unused === undefined
    ? resolveAddEnum(schema, plan, generateId)
    : { type: "removeEnum", enumId: unused.id };
}

export function resolveAddSubjectArea(
  schema: SchemaDocument,
  plan: OperationPlan,
  generateId: GenerateId,
): Operation {
  const added = { id: createSubjectAreaId(generateId), name: plan.text };
  if (!plan.isCorrupted) {
    return { type: "addSubjectArea", subjectArea: added };
  }
  const existing = chooseFrom(
    subjectAreasOf(schema),
    pickAt(plan, ELEMENT_SLOT),
  );
  return existing === undefined
    ? duplicatedAdd({ type: "addSubjectArea", subjectArea: added })
    : { type: "addSubjectArea", subjectArea: { ...added, id: existing.id } };
}

export function resolveUpdateSubjectArea(
  schema: SchemaDocument,
  plan: OperationPlan,
  generateId: GenerateId,
): Operation {
  const area = chooseFrom(subjectAreasOf(schema), pickAt(plan, ELEMENT_SLOT));
  if (area === undefined && !plan.isCorrupted) {
    return resolveAddSubjectArea(schema, plan, generateId);
  }
  const subjectAreaId =
    area === undefined || plan.isCorrupted ? MISSING_SUBJECT_AREA_ID : area.id;
  const changes = { name: plan.text };
  return { type: "updateSubjectArea", subjectAreaId, changes };
}

export function resolveRemoveSubjectArea(
  schema: SchemaDocument,
  plan: OperationPlan,
  generateId: GenerateId,
): Operation {
  if (plan.isCorrupted) {
    const subjectAreaId = MISSING_SUBJECT_AREA_ID;
    return { type: "removeSubjectArea", subjectAreaId };
  }
  const area = chooseFrom(subjectAreasOf(schema), pickAt(plan, ELEMENT_SLOT));
  return area === undefined
    ? resolveAddSubjectArea(schema, plan, generateId)
    : { type: "removeSubjectArea", subjectAreaId: area.id };
}

export function resolveAddNote(
  schema: SchemaDocument,
  plan: OperationPlan,
  generateId: GenerateId,
): Operation {
  const note: Note = {
    id: createNoteId(generateId),
    text: plan.text,
    position: positionFrom(plan),
  };
  if (!plan.isCorrupted) {
    return { type: "addNote", note };
  }
  const existing = chooseFrom(notesOf(schema), pickAt(plan, ELEMENT_SLOT));
  return existing === undefined
    ? duplicatedAdd({ type: "addNote", note })
    : { type: "addNote", note: { ...note, id: existing.id } };
}

export function resolveUpdateNote(
  schema: SchemaDocument,
  plan: OperationPlan,
  generateId: GenerateId,
): Operation {
  const note = chooseFrom(notesOf(schema), pickAt(plan, ELEMENT_SLOT));
  if (note === undefined && !plan.isCorrupted) {
    return resolveAddNote(schema, plan, generateId);
  }
  const noteId =
    note === undefined || plan.isCorrupted ? MISSING_NOTE_ID : note.id;
  return { type: "updateNote", noteId, changes: { text: plan.text } };
}

export function resolveRemoveNote(
  schema: SchemaDocument,
  plan: OperationPlan,
  generateId: GenerateId,
): Operation {
  if (plan.isCorrupted) {
    return { type: "removeNote", noteId: MISSING_NOTE_ID };
  }
  const note = chooseFrom(notesOf(schema), pickAt(plan, ELEMENT_SLOT));
  return note === undefined
    ? resolveAddNote(schema, plan, generateId)
    : { type: "removeNote", noteId: note.id };
}

// Moves a few tables and notes; a set first flag moves the first element a
// second time, and a corrupted plan also moves a missing element.
export function resolveMoveElements(
  schema: SchemaDocument,
  plan: OperationPlan,
): Operation {
  const movable: readonly (TableId | NoteId)[] = [
    ...tablesOf(schema).map((table) => table.id),
    ...notesOf(schema).map((note) => note.id),
  ];
  const count = pickAt(plan, ELEMENT_SLOT) % MAX_MOVE_COUNT;
  const chosen = chooseSeveral(movable, pickAt(plan, 3), count);
  const repeated = isFlagSet(plan, 0) ? chosen.slice(0, 1) : [];
  const missing = isFlagSet(plan, 1) ? MISSING_NOTE_ID : MISSING_TABLE_ID;
  const elementIds = [
    ...chosen,
    ...repeated,
    ...(plan.isCorrupted ? [missing] : []),
  ];
  const { x, y } = positionFrom(plan);
  const moves: OperationOfType<"moveElements">["moves"] = elementIds.map(
    (elementId, order) => ({
      elementId,
      position: { x: x + order * MOVE_SPACING, y },
    }),
  );
  return { type: "moveElements", moves };
}
