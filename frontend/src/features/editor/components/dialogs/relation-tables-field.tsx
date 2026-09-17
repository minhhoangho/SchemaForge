"use client";

import { sortTables } from "@schemaforge/core";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import {
  changeTargetTable,
  lookup,
  swapRelationDraft,
} from "../../lib/to-relation-draft";
import { DialogSelectField } from "./dialog-select-field";
import { FieldErrorMessage } from "./field-error-message";
import { describedByOf, joinIds } from "./relation-dialog-fields";
import type { RelationSectionProps } from "./relation-dialog-fields";

type RelationTablesFieldProps = RelationSectionProps & {
  // Set when the referenced table offers nothing to reference; that message
  // sits under the referenced columns but explains this select too.
  readonly targetKeyMissingId: string | undefined;
};

/** The foreign key table with "Swap tables", and the referenced table select. */
export function RelationTablesField({
  document,
  draft,
  onChange,
  errorView,
  targetKeyMissingId,
}: RelationTablesFieldProps): JSX.Element {
  const { t } = useTranslation("editor");
  const describedBy = joinIds([describedByOf(errorView), targetKeyMissingId]);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          <span className="text-muted-foreground">
            {t("relationDialog.fromTable")}
          </span>{" "}
          <span className="font-medium">
            {document.tables[draft.fromTableId]?.name}
          </span>
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            onChange(swapRelationDraft(document, draft));
          }}
        >
          {t("relationDialog.swap")}
        </Button>
      </div>
      <DialogSelectField
        label={t("relationDialog.toTable")}
        value={draft.toTableId}
        options={sortTables(document).map((table) => ({
          value: table.id,
          label: table.name,
        }))}
        onChange={(value) => {
          const table = lookup(document.tables, value);
          if (table !== undefined) {
            onChange(changeTargetTable(document, draft, table.id));
          }
        }}
        describedBy={describedBy}
        isInvalid={describedBy !== undefined}
      />
      <FieldErrorMessage view={errorView} />
    </div>
  );
}
