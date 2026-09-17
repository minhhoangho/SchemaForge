"use client";

import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import type { ForeignKeyMode } from "../../lib/to-relation-draft";
import { ColumnPairsField } from "./column-pairs-field";
import { DialogRadioField } from "./dialog-radio-field";
import { ReferencedColumnsField } from "./referenced-columns-field";
import type { RelationFieldsProps } from "./relation-dialog-fields";
import type { RelationFieldErrors } from "./use-relation-field-errors";

const FOREIGN_KEY_MODES = [
  { mode: "new-columns", labelKey: "newColumns" },
  { mode: "existing-columns", labelKey: "existingColumns" },
] as const satisfies readonly {
  readonly mode: ForeignKeyMode;
  readonly labelKey: string;
}[];

type ForeignKeyFieldsProps = RelationFieldsProps & {
  readonly fieldErrors: RelationFieldErrors;
};

/** The fields of a one-to-many or one-to-one relation. */
export function ForeignKeyFields(props: ForeignKeyFieldsProps): JSX.Element {
  const { t } = useTranslation("editor");
  const { draft, onChange, fieldErrors } = props;

  return (
    <>
      <ReferencedColumnsField
        {...props}
        errorView={fieldErrors.referencedColumns}
      />
      <DialogRadioField
        label={t("relationDialog.foreignKeyMode.label")}
        value={draft.foreignKeyMode}
        options={FOREIGN_KEY_MODES.map(({ mode, labelKey }) => ({
          value: mode,
          label: t(`relationDialog.foreignKeyMode.${labelKey}`),
        }))}
        onChange={(value) => {
          const option = FOREIGN_KEY_MODES.find(({ mode }) => mode === value);
          if (option !== undefined) {
            onChange({ ...draft, foreignKeyMode: option.mode });
          }
        }}
      />
      {draft.foreignKeyMode === "existing-columns" && (
        <ColumnPairsField {...props} errorView={fieldErrors.columnPairs} />
      )}
    </>
  );
}
