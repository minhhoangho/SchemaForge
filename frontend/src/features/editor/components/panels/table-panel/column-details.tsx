"use client";

import type { Column, ColumnId, ColumnType } from "@schemaforge/core";
import type { JSX } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { useEditorStore } from "../../../state/use-editor-store";
import { CommittedTextArea } from "../../committed-text-area";
import { CommittedTextField } from "../../committed-text-field";
import { ColumnDefaultField } from "./column-default-field";
import type { FieldErrorMessageOf } from "./use-field-error-message";
import { useFieldErrorMessage } from "./use-field-error-message";

type ColumnDetailsProps = {
  readonly columnId: ColumnId;
};

// Issue fields, as `useFieldErrorMessage` names them.
const CUSTOM_NAME_FIELD = "type.name";
const DEFAULT_VALUE_FIELD = "defaultValue";
const COLUMNS_SEGMENT = "columns";
const TYPE_SEGMENT = "type";
const NAME_SEGMENT = "name";
const COMMENT_SEGMENT = "comment";
const WHOLE_NUMBER_PATTERN = /^\d+$/;
const MIN_LENGTH = 1;
const MIN_PRECISION = 1;
const MIN_SCALE = 0;

// Core accepts only whole numbers from these minimums (`column-type.ts`), so
// anything else is not dispatched and the field shows the stored value again.
function parseWholeNumber(value: string, minimum: number): number | null {
  const trimmed = value.trim();
  if (!WHOLE_NUMBER_PATTERN.test(trimmed)) {
    return null;
  }
  const parsed = Number(trimmed);
  return parsed >= minimum ? parsed : null;
}

type TypeParametersProps = {
  readonly column: Column;
  readonly baseId: string;
  readonly errorMessageOf: FieldErrorMessageOf;
  readonly onTypeChange: (type: ColumnType) => void;
};

function TypeParameters({
  column,
  baseId,
  errorMessageOf,
  onTypeChange,
}: TypeParametersProps): JSX.Element | null {
  const { t } = useTranslation("editor");
  const { type } = column;

  function numberField(
    field: "length" | "precision" | "scale",
    value: number,
    minimum: number,
    build: (parsed: number) => ColumnType,
  ): JSX.Element {
    return (
      <CommittedTextField
        id={`${baseId}-${field}`}
        label={t(`tablePanel.columns.${field}`)}
        value={String(value)}
        inputMode="numeric"
        focusPath={[COLUMNS_SEGMENT, column.id, TYPE_SEGMENT, field]}
        errorMessage={errorMessageOf(column.id, `type.${field}`)}
        onCommit={(text) => {
          const parsed = parseWholeNumber(text, minimum);
          if (parsed !== null) {
            onTypeChange(build(parsed));
          }
        }}
      />
    );
  }

  if (type.kind === "char" || type.kind === "varchar") {
    return numberField("length", type.length, MIN_LENGTH, (length) => ({
      kind: type.kind,
      length,
    }));
  }
  if (type.kind === "decimal") {
    return (
      <div className="grid grid-cols-2 gap-2">
        {numberField(
          "precision",
          type.precision,
          MIN_PRECISION,
          (precision) => ({
            ...type,
            precision,
          }),
        )}
        {numberField("scale", type.scale, MIN_SCALE, (scale) => ({
          ...type,
          scale,
        }))}
      </div>
    );
  }
  if (type.kind === "custom") {
    return (
      <CommittedTextField
        id={`${baseId}-custom-name`}
        label={t("tablePanel.columns.customTypeLabel")}
        value={type.name}
        focusPath={[COLUMNS_SEGMENT, column.id, TYPE_SEGMENT, NAME_SEGMENT]}
        errorMessage={errorMessageOf(column.id, CUSTOM_NAME_FIELD)}
        onCommit={(name) => {
          onTypeChange({ kind: "custom", name });
        }}
      />
    );
  }
  return null;
}

/**
 * The expandable part of a column row: type parameters, default value and
 * comment (spec section 2 "Cột").
 */
export function ColumnDetails({
  columnId,
}: ColumnDetailsProps): JSX.Element | null {
  const { t } = useTranslation("editor");
  const schema = useEditorStore((state) => state.document);
  const dispatch = useEditorStore((state) => state.dispatch);
  const errorMessageOf = useFieldErrorMessage(schema);
  const baseId = useId();

  const column = schema.columns[columnId];
  if (column === undefined) {
    return null;
  }

  return (
    <div className="grid gap-3 pt-1">
      <TypeParameters
        column={column}
        baseId={baseId}
        errorMessageOf={errorMessageOf}
        onTypeChange={(type) => {
          dispatch({ type: "updateColumn", columnId, changes: { type } });
        }}
      />
      <ColumnDefaultField
        column={column}
        errorMessage={errorMessageOf(columnId, DEFAULT_VALUE_FIELD)}
        onDefaultChange={(defaultValue) => {
          dispatch({
            type: "updateColumn",
            columnId,
            changes: { defaultValue },
          });
        }}
      />
      <CommittedTextArea
        id={`${baseId}-comment`}
        label={t("tablePanel.columns.comment")}
        value={column.comment}
        focusPath={[COLUMNS_SEGMENT, columnId, COMMENT_SEGMENT]}
        onCommit={(comment) => {
          dispatch({ type: "updateColumn", columnId, changes: { comment } });
        }}
      />
    </div>
  );
}
