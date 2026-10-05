import { toNameKey } from "../../model/name-limits.js";
import { err } from "../../result.js";
import { assembleDocument } from "../shared/assemble-document.js";
import { parseDbmlWithDbmlCore } from "../shared/dbml-core-adapter.js";
import type {
  CoreDatabase,
  CoreEnum,
  CoreTableGroup,
} from "../shared/dbml-core-adapter-types.js";
import type {
  DraftDiagnostic,
  DraftEnum,
  DraftSubjectArea,
  ImportDraft,
} from "../shared/import-draft.js";
import { checkSourceLength } from "../shared/import-limits.js";
import type { Importer } from "../shared/import-types.js";
import { createLineStarts } from "../shared/source-location.js";
import { translateRefs } from "./dbml-relations.js";
import { locationOf } from "./dbml-columns.js";
import { translateTables } from "./dbml-tables.js";
import { toDbmlDatabaseType } from "./dbml-type-resolution.js";

function translateEnum(
  element: CoreEnum,
  index: number,
  diagnostics: DraftDiagnostic[],
): DraftEnum {
  const location = locationOf(element.token);
  if (element.values.some(({ note }) => note !== null)) {
    diagnostics.push({
      code: "comment-dropped",
      location,
      target: { kind: "enum", index },
    });
  }
  return {
    name: element.name,
    values: element.values.map(({ name }) => name),
    location,
  };
}

function translateGroup(
  group: CoreTableGroup,
  index: number,
  diagnostics: DraftDiagnostic[],
): DraftSubjectArea {
  const location = locationOf(group.token);
  const target = { kind: "subjectArea", index } as const;
  if (group.color !== null) {
    diagnostics.push({ code: "color-dropped", location, target });
  }
  if (group.note !== null) {
    diagnostics.push({ code: "comment-dropped", location, target });
  }
  return { name: group.name, location };
}

// A table belongs to the first group that lists it; a Map keeps names such as
// __proto__ away from any prototype.
function mapTablesToGroups(
  groups: readonly CoreTableGroup[],
): ReadonlyMap<string, string> {
  const subjectAreaByTable = new Map<string, string>();
  groups.forEach(({ name, tableNames }) => {
    tableNames
      .filter((tableName) => !subjectAreaByTable.has(tableName))
      .forEach((tableName) => subjectAreaByTable.set(tableName, name));
  });
  return subjectAreaByTable;
}

function reportDroppedBlocks(
  database: CoreDatabase,
): readonly DraftDiagnostic[] {
  return [
    ...(database.project.note === null
      ? []
      : [{ code: "comment-dropped", location: null, target: null } as const]),
    ...(database.records === null
      ? []
      : [
          {
            code: "data-statements-ignored",
            location: locationOf(database.records.token),
            target: null,
          } as const,
        ]),
  ];
}

function translateDatabase(
  database: CoreDatabase,
  source: string,
): ImportDraft {
  const diagnostics: DraftDiagnostic[] = [];
  const tableParts = translateTables(database.tables, {
    source,
    lineStarts: createLineStarts(source),
    databaseType: toDbmlDatabaseType(database.project.databaseType),
    enumNameKeys: new Set(database.enums.map(({ name }) => toNameKey(name))),
    subjectAreaByTable: mapTablesToGroups(database.tableGroups),
  });
  const relationParts = translateRefs(database.refs, database.tables);
  const enums = database.enums.map((element, index) =>
    translateEnum(element, index, diagnostics),
  );
  const subjectAreas = database.tableGroups.map((group, index) =>
    translateGroup(group, index, diagnostics),
  );
  return {
    name: database.project.name,
    tables: tableParts.tables,
    indexes: tableParts.indexes,
    relations: relationParts.relations,
    enums,
    subjectAreas,
    // Core notes have no name; generateDbml writes `note <n>` for each.
    notes: database.notes.map(({ content, token }) => ({
      text: content,
      location: locationOf(token),
    })),
    diagnostics: [
      ...tableParts.diagnostics,
      ...relationParts.diagnostics,
      ...diagnostics,
      ...reportDroppedBlocks(database),
    ],
  };
}

/** Imports a DBML file (import / export spec, section 7). */
export const importDbml: Importer = (source, options) => {
  const tooLarge = checkSourceLength(source);
  if (tooLarge !== null) {
    return err(tooLarge);
  }
  const parsed = parseDbmlWithDbmlCore(source);
  if (!parsed.isOk) {
    return err({ diagnostics: parsed.error });
  }
  return assembleDocument(translateDatabase(parsed.value, source), options);
};
