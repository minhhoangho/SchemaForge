// The narrow, readonly model that dbml-core-adapter.ts reads out of @dbml/core. Only the
// adapter and the sql and dbml importers use it; field names follow the probe in
// dbml-core-adapter.probe.test.ts.
import type { Result } from "../../result.js";
import type { ImportDiagnostic, SourceLocation } from "./import-types.js";

export type CoreParseResult<T> = Result<T, readonly ImportDiagnostic[]>;

export type CoreToken = {
  readonly start: SourceLocation;
  readonly end: SourceLocation;
};

export type CoreDefaultValue = {
  readonly type: "string" | "number" | "boolean" | "expression";
  readonly value: string;
};

export type CoreCheck = {
  readonly name: string | null;
  readonly expression: string;
  readonly token: CoreToken | null;
};

export type CoreField = {
  readonly name: string;
  /** As the parser returns it: dbml loses the quotes, postgres drops "with time zone". */
  readonly typeName: string;
  readonly isPrimaryKey: boolean;
  readonly isUnique: boolean;
  readonly isNotNull: boolean;
  readonly isIncrement: boolean;
  readonly defaultValue: CoreDefaultValue | null;
  readonly note: string | null;
  readonly checks: readonly CoreCheck[];
  readonly token: CoreToken | null;
};

export type CoreIndexColumn = {
  readonly value: string;
  readonly isExpression: boolean;
};

export type CoreIndex = {
  readonly name: string | null;
  readonly columns: readonly CoreIndexColumn[];
  readonly isUnique: boolean;
  readonly isPrimaryKey: boolean;
  readonly type: string | null;
  readonly note: string | null;
  readonly token: CoreToken | null;
};

export type CoreTable = {
  readonly name: string;
  readonly schemaName: string | null;
  readonly note: string | null;
  readonly headerColor: string | null;
  readonly fields: readonly CoreField[];
  readonly indexes: readonly CoreIndex[];
  readonly checks: readonly CoreCheck[];
  readonly token: CoreToken | null;
};

export type CoreEndpoint = {
  readonly schemaName: string | null;
  readonly tableName: string;
  readonly columnNames: readonly string[];
  readonly relation: "1" | "*";
};

export type CoreRef = {
  readonly name: string | null;
  readonly color: string | null;
  readonly endpoints: readonly CoreEndpoint[];
  readonly onDelete: string | null;
  readonly onUpdate: string | null;
  readonly token: CoreToken | null;
};

export type CoreEnum = {
  readonly name: string;
  readonly values: readonly {
    readonly name: string;
    readonly note: string | null;
  }[];
  readonly token: CoreToken | null;
};

export type CoreTableGroup = {
  readonly name: string;
  readonly tableNames: readonly string[];
  readonly note: string | null;
  readonly color: string | null;
  readonly token: CoreToken | null;
};

export type CoreDatabase = {
  readonly project: {
    readonly name: string | null;
    readonly databaseType: string | null;
    readonly note: string | null;
  };
  /** Tables, refs, enums and groups of every schema, in source order. */
  readonly tables: readonly CoreTable[];
  readonly refs: readonly CoreRef[];
  readonly enums: readonly CoreEnum[];
  readonly tableGroups: readonly CoreTableGroup[];
  readonly notes: readonly {
    readonly content: string;
    readonly token: CoreToken | null;
  }[];
  /** The first Records block, or null when there is none. */
  readonly records: { readonly token: CoreToken | null } | null;
};
