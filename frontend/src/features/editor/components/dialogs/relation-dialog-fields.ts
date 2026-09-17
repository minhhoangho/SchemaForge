import type {
  OperationError,
  SchemaDocument,
  TableId,
} from "@schemaforge/core";

import type { RelationDraftError } from "../../lib/build-relation-operation";
import type { RelationDraft } from "../../lib/to-relation-draft";

export type DialogOption = {
  readonly value: string;
  readonly label: string;
};

/** What every field of the create relation dialog reads and changes. */
export type RelationFieldsProps = {
  readonly document: SchemaDocument;
  readonly draft: RelationDraft;
  readonly errors: readonly RelationDraftError[];
  // The error core returned for the last confirmation, until the draft changes.
  readonly buildError: OperationError | null;
  readonly onChange: (draft: RelationDraft) => void;
};

/**
 * The messages under one field: a validation error that blocks confirmation,
 * and the error core returned when confirming. Each has its own id so a
 * control can point at whichever is shown.
 */
export type FieldErrorView = {
  readonly validationId: string;
  readonly validationText: string | undefined;
  readonly submitId: string;
  readonly submitText: string | undefined;
};

/** A field section and the messages shown under it. */
export type RelationSectionProps = RelationFieldsProps & {
  readonly errorView: FieldErrorView;
};

const ID_SEPARATOR = " ";

/** Joins the ids that are set into an `aria-describedby` value. */
export function joinIds(
  ids: readonly (string | undefined)[],
): string | undefined {
  const present = ids.filter((id) => id !== undefined);
  return present.length === 0 ? undefined : present.join(ID_SEPARATOR);
}

/** The ids of the messages a field currently shows. */
export function describedByOf(view: FieldErrorView): string | undefined {
  return joinIds([
    view.validationText === undefined ? undefined : view.validationId,
    view.submitText === undefined ? undefined : view.submitId,
  ]);
}

/** The columns of a table as select options, in the table's column order. */
export function columnOptions(
  document: SchemaDocument,
  tableId: TableId,
): readonly DialogOption[] {
  return (document.tables[tableId]?.columnIds ?? []).flatMap((columnId) => {
    const column = document.columns[columnId];
    return column === undefined
      ? []
      : [{ value: column.id, label: column.name }];
  });
}
