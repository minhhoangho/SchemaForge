import type { ColumnDefault } from "../../model/column-default.js";
import type { ColumnType } from "../../model/column-type.js";
import type { ReferentialAction, RelationKind } from "../../model/relation.js";
import type { ImportDiagnosticCode } from "./import-diagnostic-codes.js";
import type { SourceLocation } from "./import-types.js";

// The draft mirrors the model with names in place of ids, so each format only
// translates its syntax tree; resolving names and assigning ids happen once.

export type DraftColumnType =
  | Exclude<ColumnType, { readonly kind: "enum" }>
  | { readonly kind: "enum"; readonly enumName: string };

export type DraftColumn = {
  readonly name: string;
  readonly type: DraftColumnType;
  readonly isNullable: boolean;
  readonly isUnique: boolean;
  readonly isAutoIncrement: boolean;
  readonly defaultValue: ColumnDefault | null;
  readonly comment: string;
  readonly location: SourceLocation | null;
};

export type DraftTable = {
  readonly name: string;
  readonly comment: string;
  readonly subjectAreaName: string | null;
  readonly columns: readonly DraftColumn[];
  readonly primaryKeyColumnNames: readonly string[];
  readonly location: SourceLocation | null;
};

export type DraftIndex = {
  readonly tableName: string;
  // null means the name comes from suggestIndexName when the document is built.
  readonly name: string | null;
  readonly columnNames: readonly string[];
  readonly isUnique: boolean;
  readonly location: SourceLocation | null;
};

export type DraftRelation = {
  readonly fromTableName: string;
  readonly toTableName: string;
  readonly columnPairs: readonly {
    readonly fromColumnName: string;
    readonly toColumnName: string;
  }[];
  readonly kind: RelationKind;
  readonly onDelete: ReferentialAction;
  readonly onUpdate: ReferentialAction;
  readonly location: SourceLocation | null;
};

export type DraftEnum = {
  readonly name: string;
  readonly values: readonly string[];
  readonly location: SourceLocation | null;
};

export type DraftSubjectArea = {
  readonly name: string;
  readonly location: SourceLocation | null;
};

export type DraftNote = {
  readonly text: string;
  readonly location: SourceLocation | null;
};

/** An element by its position in the draft arrays; field is the last path segment. */
export type DraftTarget =
  | {
      readonly kind: "table";
      readonly tableIndex: number;
      readonly field?: string;
    }
  | {
      readonly kind: "column";
      readonly tableIndex: number;
      readonly columnIndex: number;
      readonly field?: string;
    }
  | {
      readonly kind: "index" | "relation" | "enum" | "subjectArea" | "note";
      readonly index: number;
      readonly field?: string;
    };

export type DraftDiagnostic = {
  readonly code: ImportDiagnosticCode;
  readonly location: SourceLocation | null;
  readonly target: DraftTarget | null;
};

export type ImportDraft = {
  readonly name: string | null;
  readonly tables: readonly DraftTable[];
  readonly indexes: readonly DraftIndex[];
  readonly relations: readonly DraftRelation[];
  readonly enums: readonly DraftEnum[];
  readonly subjectAreas: readonly DraftSubjectArea[];
  readonly notes: readonly DraftNote[];
  readonly diagnostics: readonly DraftDiagnostic[];
};
