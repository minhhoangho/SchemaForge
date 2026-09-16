"use client";

import type { Column, ColumnId } from "@schemaforge/core";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  Trash2Icon,
} from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { useEditorStore } from "../../../state/use-editor-store";
import { CommittedTextField } from "../../committed-text-field";
import { ColumnDetails } from "./column-details";
import { ColumnTypeCombobox } from "./column-type-combobox";
import { IconActionButton } from "./icon-action-button";
import { LabeledCheckbox } from "./labeled-checkbox";
import { useDisplayName } from "./use-display-name";
import type { FieldErrorMessageOf } from "./use-field-error-message";
import type { MoveDirection } from "./list-move-focus";
import { controlId } from "./list-move-focus";

type ColumnItemProps = {
  readonly columnId: ColumnId;
  readonly baseId: string;
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly isPrimaryKey: boolean;
  readonly hasDetailIssues: boolean;
  readonly errorMessageOf: FieldErrorMessageOf;
  readonly onTogglePrimaryKey: (isChecked: boolean) => void;
  readonly onMove: (direction: MoveDirection) => void;
  readonly onRemove: () => void;
};

// Issue fields, as `useFieldErrorMessage` names them, and path segments.
const NAME_FIELD = "name";
const NULLABLE_FIELD = "isNullable";
const UNIQUE_FIELD = "isUnique";
const AUTO_INCREMENT_FIELD = "isAutoIncrement";
const COLUMNS_SEGMENT = "columns";

type ColumnFlag =
  typeof NULLABLE_FIELD | typeof UNIQUE_FIELD | typeof AUTO_INCREMENT_FIELD;

type ColumnFlagsProps = Pick<
  ColumnItemProps,
  "baseId" | "isPrimaryKey" | "errorMessageOf" | "onTogglePrimaryKey"
> & { readonly column: Column };

function ColumnFlags({
  column,
  baseId,
  isPrimaryKey,
  errorMessageOf,
  onTogglePrimaryKey,
}: ColumnFlagsProps): JSX.Element {
  const { t } = useTranslation("editor");
  const dispatch = useEditorStore((state) => state.dispatch);

  function toggle(flag: ColumnFlag, isChecked: boolean): void {
    dispatch({
      type: "updateColumn",
      columnId: column.id,
      changes: { [flag]: isChecked },
    });
  }

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      <LabeledCheckbox
        id={controlId(baseId, column.id, "nullable")}
        label={t("tablePanel.columns.nullable")}
        isChecked={column.isNullable}
        focusPath={[COLUMNS_SEGMENT, column.id, NULLABLE_FIELD]}
        errorMessage={errorMessageOf(column.id, NULLABLE_FIELD)}
        onCheckedChange={(isChecked) => {
          toggle("isNullable", isChecked);
        }}
      />
      <LabeledCheckbox
        id={controlId(baseId, column.id, "primaryKey")}
        label={t("tablePanel.columns.primaryKey")}
        isChecked={isPrimaryKey}
        onCheckedChange={onTogglePrimaryKey}
      />
      <LabeledCheckbox
        id={controlId(baseId, column.id, "unique")}
        label={t("tablePanel.columns.unique")}
        isChecked={column.isUnique}
        focusPath={[COLUMNS_SEGMENT, column.id, UNIQUE_FIELD]}
        onCheckedChange={(isChecked) => {
          toggle("isUnique", isChecked);
        }}
      />
      <LabeledCheckbox
        id={controlId(baseId, column.id, "autoIncrement")}
        label={t("tablePanel.columns.autoIncrement")}
        isChecked={column.isAutoIncrement}
        focusPath={[COLUMNS_SEGMENT, column.id, AUTO_INCREMENT_FIELD]}
        errorMessage={errorMessageOf(column.id, AUTO_INCREMENT_FIELD)}
        onCheckedChange={(isChecked) => {
          toggle("isAutoIncrement", isChecked);
        }}
      />
    </div>
  );
}

type ColumnActionsProps = Pick<
  ColumnItemProps,
  "baseId" | "isFirst" | "isLast" | "onMove" | "onRemove"
> & { readonly column: Column };

function ColumnActions({
  column,
  baseId,
  isFirst,
  isLast,
  onMove,
  onRemove,
}: ColumnActionsProps): JSX.Element {
  const { t } = useTranslation("editor");
  const displayName = useDisplayName();
  const values = { column: displayName(column.name) };

  return (
    <div className="flex items-center gap-1">
      <IconActionButton
        id={controlId(baseId, column.id, "moveUp")}
        label={t("tablePanel.columns.moveUp", values)}
        icon={<ArrowUpIcon aria-hidden />}
        isDisabled={isFirst}
        onClick={() => {
          onMove("up");
        }}
      />
      <IconActionButton
        id={controlId(baseId, column.id, "moveDown")}
        label={t("tablePanel.columns.moveDown", values)}
        icon={<ArrowDownIcon aria-hidden />}
        isDisabled={isLast}
        onClick={() => {
          onMove("down");
        }}
      />
      <IconActionButton
        id={controlId(baseId, column.id, "remove")}
        label={t("tablePanel.columns.remove", values)}
        icon={<Trash2Icon aria-hidden />}
        onClick={onRemove}
      />
    </div>
  );
}

/**
 * Whether the details of a column are open. They open by themselves when an
 * issue appears in them, so its message is visible and a focus request finds
 * the field; the user can still close them afterwards.
 */
function useDetailsExpansion(
  hasDetailIssues: boolean,
): readonly [boolean, () => void] {
  const [isExpanded, setIsExpanded] = useState(hasDetailIssues);
  const [hasPreviousDetailIssues, setHasPreviousDetailIssues] =
    useState(hasDetailIssues);
  // Adjusting state during render when a prop changes (react.dev "You Might
  // Not Need an Effect"), so the details never render closed first.
  if (hasDetailIssues !== hasPreviousDetailIssues) {
    setHasPreviousDetailIssues(hasDetailIssues);
    if (hasDetailIssues) {
      setIsExpanded(true);
    }
  }
  const toggle = (): void => {
    setIsExpanded((isCurrentlyExpanded) => !isCurrentlyExpanded);
  };
  return [isExpanded, toggle];
}

/**
 * One column row: name, type, the four flags, move and remove buttons, and a
 * "Details" toggle for type parameters, default value and comment. The row is
 * a group named after the column, so the repeated field labels keep their
 * context for screen reader users.
 */
export function ColumnItem(props: ColumnItemProps): JSX.Element | null {
  const { columnId, baseId, hasDetailIssues, errorMessageOf } = props;
  const { t } = useTranslation("editor");
  const displayName = useDisplayName();
  const column = useEditorStore((state) => state.document.columns[columnId]);
  const dispatch = useEditorStore((state) => state.dispatch);
  const [isExpanded, toggleExpanded] = useDetailsExpansion(hasDetailIssues);
  const detailsId = controlId(baseId, columnId, "details");

  if (column === undefined) {
    return null;
  }

  return (
    <li>
      <fieldset className="grid gap-2 rounded-md border border-border p-2">
        <legend className="sr-only">{displayName(column.name)}</legend>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <CommittedTextField
              id={controlId(baseId, columnId, "name")}
              label={t("tablePanel.columns.nameLabel")}
              isLabelHidden
              value={column.name}
              focusPath={[COLUMNS_SEGMENT, columnId, NAME_FIELD]}
              errorMessage={errorMessageOf(columnId, NAME_FIELD)}
              onCommit={(name) => {
                dispatch({ type: "updateColumn", columnId, changes: { name } });
              }}
            />
          </div>
          <ColumnTypeCombobox columnId={columnId} />
        </div>
        <ColumnFlags {...props} column={column} />
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={isExpanded}
            aria-controls={detailsId}
            onClick={toggleExpanded}
          >
            {isExpanded ? (
              <ChevronDownIcon aria-hidden />
            ) : (
              <ChevronRightIcon aria-hidden />
            )}
            {hasDetailIssues
              ? t("tablePanel.columns.detailsHasIssues")
              : t("tablePanel.columns.details")}
          </Button>
          <ColumnActions {...props} column={column} />
        </div>
        <div id={detailsId} hidden={!isExpanded}>
          {isExpanded && <ColumnDetails columnId={columnId} />}
        </div>
      </fieldset>
    </li>
  );
}
