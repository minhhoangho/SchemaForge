"use client";

import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import type { RelationDraftKind } from "../../lib/to-relation-draft";
import { DialogRadioField } from "./dialog-radio-field";
import { ForeignKeyFields } from "./foreign-key-fields";
import { JunctionNameField } from "./junction-name-field";
import type { RelationFieldsProps } from "./relation-dialog-fields";
import { RelationTablesField } from "./relation-tables-field";
import { useRelationFieldErrors } from "./use-relation-field-errors";
import type { RelationFieldErrors } from "./use-relation-field-errors";

const KINDS = [
  "oneToMany",
  "oneToOne",
  "manyToMany",
] as const satisfies readonly RelationDraftKind[];

const MESSAGE_SEPARATOR = " ";

function validationSummaryOf(fieldErrors: RelationFieldErrors): string {
  return [
    fieldErrors.tables,
    fieldErrors.referencedColumns,
    fieldErrors.columnPairs,
  ]
    .map((view) => view.validationText)
    .filter((text) => text !== undefined)
    .join(MESSAGE_SEPARATOR);
}

/** Tables, kind, and the fields that the chosen kind needs. */
export function RelationDraftFields(props: RelationFieldsProps): JSX.Element {
  const { t } = useTranslation("editor");
  const { draft, onChange } = props;
  const fieldErrors = useRelationFieldErrors(props);

  return (
    <>
      {/* Validation messages appear while focus stays on the control that
          caused them, so one polite region announces them. The visible copies
          carry no role, which keeps each message from being read twice. */}
      <p role="status" className="sr-only">
        {validationSummaryOf(fieldErrors)}
      </p>
      <RelationTablesField
        {...props}
        errorView={fieldErrors.tables}
        targetKeyMissingId={
          fieldErrors.isTargetKeyMissing
            ? fieldErrors.referencedColumns.validationId
            : undefined
        }
      />
      <DialogRadioField
        label={t("relationDialog.kindLabel")}
        value={draft.kind}
        options={KINDS.map((kind) => ({
          value: kind,
          label: t(`relationDialog.kind.${kind}`),
        }))}
        onChange={(value) => {
          const kind = KINDS.find((candidate) => candidate === value);
          if (kind !== undefined) {
            onChange({ ...draft, kind });
          }
        }}
      />
      {draft.kind === "manyToMany" ? (
        <JunctionNameField {...props} />
      ) : (
        <ForeignKeyFields {...props} fieldErrors={fieldErrors} />
      )}
    </>
  );
}
