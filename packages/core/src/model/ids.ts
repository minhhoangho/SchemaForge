import { z } from "zod";

export const MAX_ID_LENGTH = 64;

const TOKEN_CHARACTERS = "[A-Za-z0-9_-]";

const TABLE_ID_PREFIX = "tbl_";
const COLUMN_ID_PREFIX = "col_";
const RELATION_ID_PREFIX = "rel_";
const INDEX_ID_PREFIX = "idx_";
const ENUM_ID_PREFIX = "enum_";
const SUBJECT_AREA_ID_PREFIX = "area_";
const NOTE_ID_PREFIX = "note_";

// ZodTemplateLiteral has no max(), so the whole-id length limit lives in the token pattern.
function idShape<Prefix extends string>(
  prefix: Prefix,
): z.ZodTemplateLiteral<`${Prefix}${string}`> {
  const maxTokenLength = String(MAX_ID_LENGTH - prefix.length);
  const tokenPattern = new RegExp(`^${TOKEN_CHARACTERS}{1,${maxTokenLength}}$`);
  return z.templateLiteral([prefix, z.string().regex(tokenPattern)]);
}

export const tableIdShape = idShape(TABLE_ID_PREFIX);
export const columnIdShape = idShape(COLUMN_ID_PREFIX);
export const relationIdShape = idShape(RELATION_ID_PREFIX);
export const indexIdShape = idShape(INDEX_ID_PREFIX);
export const enumIdShape = idShape(ENUM_ID_PREFIX);
export const subjectAreaIdShape = idShape(SUBJECT_AREA_ID_PREFIX);
export const noteIdShape = idShape(NOTE_ID_PREFIX);

export type TableId = z.infer<typeof tableIdShape>;
export type ColumnId = z.infer<typeof columnIdShape>;
export type RelationId = z.infer<typeof relationIdShape>;
export type IndexId = z.infer<typeof indexIdShape>;
export type EnumId = z.infer<typeof enumIdShape>;
export type SubjectAreaId = z.infer<typeof subjectAreaIdShape>;
export type NoteId = z.infer<typeof noteIdShape>;

/** Returns a token that is unique within a document. */
export type GenerateId = () => string;

// A token outside the spec's assumptions is a bug in the injected generator, not an expected failure.
function createId<Id extends string>(
  prefix: string,
  shape: z.ZodType<Id>,
  generateId: GenerateId,
): Id {
  const candidate = `${prefix}${generateId()}`;
  const parsed = shape.safeParse(candidate);
  if (!parsed.success) {
    throw new Error(
      `Id generator returned an invalid token: ${JSON.stringify(candidate)}`,
    );
  }
  return parsed.data;
}

export function createTableId(generateId: GenerateId): TableId {
  return createId(TABLE_ID_PREFIX, tableIdShape, generateId);
}

export function createColumnId(generateId: GenerateId): ColumnId {
  return createId(COLUMN_ID_PREFIX, columnIdShape, generateId);
}

export function createRelationId(generateId: GenerateId): RelationId {
  return createId(RELATION_ID_PREFIX, relationIdShape, generateId);
}

export function createIndexId(generateId: GenerateId): IndexId {
  return createId(INDEX_ID_PREFIX, indexIdShape, generateId);
}

export function createEnumId(generateId: GenerateId): EnumId {
  return createId(ENUM_ID_PREFIX, enumIdShape, generateId);
}

export function createSubjectAreaId(generateId: GenerateId): SubjectAreaId {
  return createId(SUBJECT_AREA_ID_PREFIX, subjectAreaIdShape, generateId);
}

export function createNoteId(generateId: GenerateId): NoteId {
  return createId(NOTE_ID_PREFIX, noteIdShape, generateId);
}

export function isTableId(value: string): value is TableId {
  return tableIdShape.safeParse(value).success;
}

export function isNoteId(value: string): value is NoteId {
  return noteIdShape.safeParse(value).success;
}
