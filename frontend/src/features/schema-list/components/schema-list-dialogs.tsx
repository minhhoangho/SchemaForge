"use client";

import type { JSX } from "react";

import type { SchemaActions } from "@/features/schema-list/hooks/use-schema-actions";
import { getSchemaListEntryId } from "@/features/schema-list/hooks/use-schema-list";
import type { SchemaListDialogs as SchemaListDialogsState } from "@/features/schema-list/hooks/use-schema-list-dialogs";

import { CreateSchemaDialog } from "./create-schema-dialog";
import { DeleteSchemaDialog } from "./delete-schema-dialog";
import { RenameSchemaDialog } from "./rename-schema-dialog";

type SchemaListDialogsProps = {
  readonly dialogs: SchemaListDialogsState;
  readonly actions: SchemaActions;
};

export function SchemaListDialogs({
  dialogs,
  actions,
}: SchemaListDialogsProps): JSX.Element {
  const { target, isOpen, setOpen, returnFocus } = dialogs;

  return (
    <>
      <CreateSchemaDialog
        open={isOpen && target.kind === "create"}
        onOpenChange={setOpen}
        onCreate={actions.createSchema}
        onReturnFocus={returnFocus}
      />
      <RenameSchemaDialog
        open={isOpen && target.kind === "rename"}
        currentName={target.kind === "rename" ? target.schema.name : ""}
        onOpenChange={setOpen}
        onRename={async (name) => {
          if (target.kind !== "rename") {
            return;
          }
          await actions.renameSchema(target.schema.id, name);
          setOpen(false);
        }}
        onReturnFocus={returnFocus}
      />
      <DeleteSchemaDialog
        open={isOpen && target.kind === "delete"}
        schemaName={
          target.kind === "delete" && target.entry.kind === "readable"
            ? target.entry.schema.name
            : null
        }
        onOpenChange={setOpen}
        onConfirm={async () => {
          if (target.kind !== "delete") {
            return;
          }
          // Awaited rather than fired: focus can only go back to the row's
          // trigger if the row survives, and only the outcome tells us that.
          // The live list may still show a deleted row for a moment, so
          // isConnected alone would send focus to an element about to vanish.
          const isDeleted = await actions.deleteSchema(
            getSchemaListEntryId(target.entry),
          );
          if (isDeleted) {
            dialogs.closeToHeading();
            return;
          }
          setOpen(false);
        }}
        onReturnFocus={returnFocus}
      />
    </>
  );
}
