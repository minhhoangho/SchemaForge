// Migrations run on JSON that has not been shape-checked yet, so they narrow
// from unknown only as much as this loose type allows: core keeps no type for
// past versions of the document.
export type MigrationStep = (
  document: Readonly<Record<string, unknown>>,
) => Readonly<Record<string, unknown>>;

// Element i migrates version i + 1 to i + 2, so this always holds
// CURRENT_SCHEMA_VERSION - 1 steps.
export const MIGRATION_STEPS: readonly MigrationStep[] = [];

// Applies steps[version - 1..] in order, writing the new version into the
// result after each step.
export function migrateDocument(
  document: Readonly<Record<string, unknown>>,
  version: number,
  steps: readonly MigrationStep[],
): Readonly<Record<string, unknown>> {
  let migrated = document;
  let migratedVersion = version;
  for (let index = version - 1; index < steps.length; index += 1) {
    const step = steps[index];
    if (step === undefined) {
      break;
    }
    migratedVersion += 1;
    migrated = { ...step(migrated), version: migratedVersion };
  }
  return migrated;
}
