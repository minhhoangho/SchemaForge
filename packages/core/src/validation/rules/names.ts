import { sortByPathThenCode } from "../../document-path.js";
import type { DocumentPath } from "../../document-path.js";
import {
  MAX_NAME_BYTES,
  toNameKey,
  utf8ByteLength,
} from "../../model/name-limits.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { Issue, IssueCode } from "../issue-codes.js";

// U+0000-U+001F and U+007F (DEL) are control characters, forbidden anywhere in a name.
const MAX_LOW_CONTROL_CODE_POINT = 0x1f;
const DELETE_CODE_POINT = 0x7f;

function isControlCharacter(character: string): boolean {
  const codePoint = character.codePointAt(0);
  return (
    codePoint !== undefined &&
    (codePoint <= MAX_LOW_CONTROL_CODE_POINT || codePoint === DELETE_CODE_POINT)
  );
}

function hasInvalidNameCharacters(name: string): boolean {
  if (name !== name.trim()) {
    return true;
  }
  for (const character of name) {
    if (isControlCharacter(character)) {
      return true;
    }
  }
  return false;
}

// An empty name is reported alone: the other checks are meaningless on "".
function findNameIssueCodes(name: string): readonly IssueCode[] {
  if (name.length === 0) {
    return ["name-empty"];
  }
  const codes: IssueCode[] = [];
  if (hasInvalidNameCharacters(name)) {
    codes.push("name-invalid");
  }
  if (utf8ByteLength(name) > MAX_NAME_BYTES) {
    codes.push("name-too-long");
  }
  return codes;
}

function findNameIssuesAt(name: string, path: DocumentPath): readonly Issue[] {
  return findNameIssueCodes(name).map((code) => ({ code, path }));
}

function validateSchemaName(schema: SchemaDocument): readonly Issue[] {
  return schema.name.length === 0
    ? [{ code: "name-empty", path: ["name"] }]
    : [];
}

type NamedElement = {
  readonly id: string;
  readonly name: string;
};

// Takes the already-extracted elements (not the map) so the caller keeps the
// map's precise key type; Object.values on a generic Record collapses to unknown.
function validateElementNames(
  elements: readonly NamedElement[],
  mapKey: string,
): readonly Issue[] {
  const issues: Issue[] = [];
  for (const element of elements) {
    issues.push(
      ...findNameIssuesAt(element.name, [mapKey, element.id, "name"]),
    );
  }
  return issues;
}

function validateEnumValueNames(schema: SchemaDocument): readonly Issue[] {
  const issues: Issue[] = [];
  for (const enumDefinition of Object.values(schema.enums)) {
    enumDefinition.values.forEach((value, index) => {
      issues.push(
        ...findNameIssuesAt(value, [
          "enums",
          enumDefinition.id,
          "values",
          index,
        ]),
      );
    });
  }
  return issues;
}

type DuplicateCandidate = {
  readonly nameKey: string;
  readonly code: IssueCode;
  readonly path: DocumentPath;
};

// Names compared as equal (case-insensitively) form a group; an empty name
// never joins a group, and every member of a group of two or more is flagged.
function findDuplicateIssues(
  candidates: readonly DuplicateCandidate[],
): readonly Issue[] {
  const groupsByNameKey = new Map<string, DuplicateCandidate[]>();
  for (const candidate of candidates) {
    if (candidate.nameKey.length === 0) {
      continue;
    }
    const group = groupsByNameKey.get(candidate.nameKey);
    if (group === undefined) {
      groupsByNameKey.set(candidate.nameKey, [candidate]);
    } else {
      group.push(candidate);
    }
  }

  const issues: Issue[] = [];
  for (const group of groupsByNameKey.values()) {
    if (group.length < 2) {
      continue;
    }
    issues.push(...group.map(({ code, path }) => ({ code, path })));
  }
  return issues;
}

// Tables and enums share one naming space: a table can clash with an enum.
function findTableAndEnumDuplicates(schema: SchemaDocument): readonly Issue[] {
  const tableCandidates = Object.values(schema.tables).map(
    (table): DuplicateCandidate => ({
      nameKey: toNameKey(table.name),
      code: "table-name-duplicate",
      path: ["tables", table.id, "name"],
    }),
  );
  const enumCandidates = Object.values(schema.enums).map(
    (enumDefinition): DuplicateCandidate => ({
      nameKey: toNameKey(enumDefinition.name),
      code: "enum-name-duplicate",
      path: ["enums", enumDefinition.id, "name"],
    }),
  );
  return findDuplicateIssues([...tableCandidates, ...enumCandidates]);
}

function findColumnDuplicates(schema: SchemaDocument): readonly Issue[] {
  const issues: Issue[] = [];
  for (const table of Object.values(schema.tables)) {
    const candidates = Object.values(schema.columns)
      .filter((column) => column.tableId === table.id)
      .map((column): DuplicateCandidate => ({
        nameKey: toNameKey(column.name),
        code: "column-name-duplicate",
        path: ["columns", column.id, "name"],
      }));
    issues.push(...findDuplicateIssues(candidates));
  }
  return issues;
}

function findIndexDuplicates(schema: SchemaDocument): readonly Issue[] {
  const candidates = Object.values(schema.indexes).map(
    (index): DuplicateCandidate => ({
      nameKey: toNameKey(index.name),
      code: "index-name-duplicate",
      path: ["indexes", index.id, "name"],
    }),
  );
  return findDuplicateIssues(candidates);
}

function findSubjectAreaDuplicates(schema: SchemaDocument): readonly Issue[] {
  const candidates = Object.values(schema.subjectAreas).map(
    (subjectArea): DuplicateCandidate => ({
      nameKey: toNameKey(subjectArea.name),
      code: "subject-area-name-duplicate",
      path: ["subjectAreas", subjectArea.id, "name"],
    }),
  );
  return findDuplicateIssues(candidates);
}

export function validateNames(schema: SchemaDocument): readonly Issue[] {
  const issues: Issue[] = [
    ...validateSchemaName(schema),
    ...validateElementNames(Object.values(schema.tables), "tables"),
    ...validateElementNames(Object.values(schema.columns), "columns"),
    ...validateElementNames(Object.values(schema.enums), "enums"),
    ...validateElementNames(Object.values(schema.indexes), "indexes"),
    ...validateElementNames(Object.values(schema.subjectAreas), "subjectAreas"),
    ...validateEnumValueNames(schema),
    ...findTableAndEnumDuplicates(schema),
    ...findColumnDuplicates(schema),
    ...findIndexDuplicates(schema),
    ...findSubjectAreaDuplicates(schema),
  ];
  return sortByPathThenCode(issues);
}
