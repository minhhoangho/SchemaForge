"use client";

import type { JSX } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type DeleteSchemaDialogProps = {
  readonly open: boolean;
  // null for a row whose metadata cannot be read, so it has no name to show.
  readonly schemaName: string | null;
  readonly onOpenChange: (open: boolean) => void;
  // Closes the dialog itself once the delete has finished.
  readonly onConfirm: () => Promise<void>;
  readonly onReturnFocus: () => void;
};

export function DeleteSchemaDialog({
  open,
  schemaName,
  onOpenChange,
  onConfirm,
  onReturnFocus,
}: DeleteSchemaDialogProps): JSX.Element {
  const { t } = useTranslation(["schemaList", "common"]);
  const [isConfirming, setIsConfirming] = useState(false);

  async function handleConfirm(): Promise<void> {
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          // Opened from a row menu, not an AlertDialogTrigger, so the screen
          // names where focus goes back to.
          event.preventDefault();
          onReturnFocus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            {schemaName === null
              ? t("delete.unreadableTitle")
              : t("delete.title", { name: schemaName })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("delete.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isConfirming}
            onClick={(event) => {
              // Radix would close at once; the dialog stays open until the
              // delete settles so focus can go to the right place afterwards.
              event.preventDefault();
              void handleConfirm();
            }}
          >
            {t("delete.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
