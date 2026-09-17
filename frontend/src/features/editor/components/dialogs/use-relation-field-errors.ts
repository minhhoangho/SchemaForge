import type { OperationError } from "@schemaforge/core";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import type { RelationDraftError } from "../../lib/build-relation-operation";
import type {
  FieldErrorView,
  RelationFieldsProps,
} from "./relation-dialog-fields";

export type RelationErrorField = "tables" | "referencedColumns" | "columnPairs";

export type RelationFieldErrors = Readonly<
  Record<RelationErrorField, FieldErrorView>
> & {
  // A one-to-many or one-to-one draft with nothing to reference: the message
  // sits under the referenced columns but also explains the referenced table.
  readonly isTargetKeyMissing: boolean;
};

const MESSAGE_SEPARATOR = " ";

function joinMessages(
  messages: readonly (string | undefined)[],
): string | undefined {
  const present = messages.filter((message) => message !== undefined);
  return present.length === 0 ? undefined : present.join(MESSAGE_SEPARATOR);
}

function hasError(
  errors: readonly RelationDraftError[],
  field: RelationDraftError["field"],
  reason: RelationDraftError["reason"],
): boolean {
  return errors.some(
    (error) => error.field === field && error.reason === reason,
  );
}

/** The field that shows an error core returned, read from its path. */
export function errorFieldOfOperationError(
  error: OperationError,
): RelationErrorField {
  // Core never rejects a junction table name (a bad one is a schema issue),
  // so only referenced columns and tables can be named here.
  const [firstSegment] = error.path;
  return firstSegment === "referencedColumnIds"
    ? "referencedColumns"
    : "tables";
}

type ValidationTexts = Readonly<Record<RelationErrorField, string | undefined>>;

function useValidationTexts({
  draft,
  errors,
}: RelationFieldsProps): ValidationTexts {
  const { t } = useTranslation("editor");
  const isManyToMany = draft.kind === "manyToMany";
  const isKeyMissing = hasError(
    errors,
    "referencedColumnIds",
    "primary-key-missing",
  );

  return {
    tables:
      isManyToMany && isKeyMissing
        ? t("relationDialog.errors.primaryKeyMissingManyToMany")
        : undefined,
    referencedColumns: joinMessages([
      !isManyToMany && isKeyMissing
        ? t("relationDialog.errors.primaryKeyMissing")
        : undefined,
      hasError(errors, "referencedColumnIds", "duplicate-column")
        ? t("relationDialog.errors.duplicateColumn")
        : undefined,
    ]),
    columnPairs: joinMessages([
      hasError(errors, "columnPairs", "unmatched-column")
        ? t("relationDialog.errors.unmatchedColumn")
        : undefined,
      hasError(errors, "columnPairs", "duplicate-column")
        ? t("relationDialog.errors.duplicateColumn")
        : undefined,
    ]),
  };
}

/**
 * Places each message under its field. Validation errors come from the draft;
 * an error core returned goes under the field its path names, or under the
 * tables when the path names no field of the dialog.
 */
export function useRelationFieldErrors(
  props: RelationFieldsProps,
): RelationFieldErrors {
  const { t } = useTranslation("errors");
  const baseId = useId();
  const validationTexts = useValidationTexts(props);
  const { buildError, draft, errors } = props;
  const submitField =
    buildError === null ? null : errorFieldOfOperationError(buildError);

  function viewOf(field: RelationErrorField): FieldErrorView {
    return {
      validationId: `${baseId}-${field}-validation`,
      validationText: validationTexts[field],
      submitId: `${baseId}-${field}-submit`,
      submitText:
        buildError !== null && submitField === field
          ? t(`codes.${buildError.code}`)
          : undefined,
    };
  }

  return {
    tables: viewOf("tables"),
    referencedColumns: viewOf("referencedColumns"),
    columnPairs: viewOf("columnPairs"),
    isTargetKeyMissing:
      draft.kind !== "manyToMany" &&
      hasError(errors, "referencedColumnIds", "primary-key-missing"),
  };
}
