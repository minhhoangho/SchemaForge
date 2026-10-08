import type { SqlDialect } from "../../generators/shared/generator-types.js";
import type {
  DraftDiagnostic,
  DraftEnum,
  DraftIndex,
  DraftTable,
} from "../shared/import-draft.js";
import type { SqlAddedUniqueConstraint } from "./sql-table-keys.js";
import type { SqlElementLocations } from "./sql-element-locations.js";
import type { SqlIndexDefinition } from "./sql-index-definitions.js";
import type { SqlOverrides } from "./sql-draft-overrides.js";

/** Filled in source order, so positions in these arrays are draft positions. */
export type SqlDraftParts = {
  readonly tables: DraftTable[];
  readonly indexes: DraftIndex[];
  readonly enums: DraftEnum[];
  readonly diagnostics: DraftDiagnostic[];
};

export type SqlDraftContext = {
  readonly dialect: SqlDialect;
  readonly locations: SqlElementLocations;
  // Name keys of the enums a column type may name (PostgreSQL CREATE TYPE).
  readonly enumNameKeys: ReadonlySet<string>;
  // The names @dbml/core gives MySQL inline enums (`<table>_<column>_enum`).
  readonly inlineEnumNames: ReadonlySet<string>;
  readonly overrides: SqlOverrides;
  // Keyed by the name key of their table.
  readonly indexDefinitions: ReadonlyMap<string, readonly SqlIndexDefinition[]>;
  readonly addedUniqueConstraints: ReadonlyMap<
    string,
    readonly SqlAddedUniqueConstraint[]
  >;
  readonly parts: SqlDraftParts;
};
