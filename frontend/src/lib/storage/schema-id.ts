// The lowercase form produced by crypto.randomUUID(). Dexie keys are
// case-sensitive, so an uppercase id could never match a stored schema.
const SCHEMA_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Imported by the editor route's Server Component, so this module must not
// import Dexie or Zod.
export function isSchemaId(value: string): boolean {
  return SCHEMA_ID_PATTERN.test(value);
}
