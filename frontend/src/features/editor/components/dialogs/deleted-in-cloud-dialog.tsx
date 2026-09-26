"use client";

import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

import type { CloudResolution } from "../../hooks/use-cloud-resolution";

export type DeletedInCloudDialogProps = {
  readonly open: boolean;
  readonly resolution: Pick<
    CloudResolution,
    "isBusy" | "recreateInCloud" | "removeFromBrowser"
  >;
  readonly onClose: () => void;
  readonly onReturnFocus: () => void;
};

/**
 * Asks what happens to a schema that was edited here after it was deleted in
 * the cloud (spec section 7, "Xung đột").
 */
export function DeletedInCloudDialog({
  open,
  resolution,
  onClose,
  onReturnFocus,
}: DeletedInCloudDialogProps): JSX.Element {
  const { t } = useTranslation(["sync", "common"]);
  const { isBusy } = resolution;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          // The workspace names where focus goes back to (see ConflictDialog).
          event.preventDefault();
          onReturnFocus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deletedInCloudDialog.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("deletedInCloudDialog.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common:actions.close")}</AlertDialogCancel>
          <Button
            variant="outline"
            disabled={isBusy}
            onClick={() => {
              // The hook reports its own failures.
              void resolution.recreateInCloud();
            }}
          >
            {t("deletedInCloudDialog.recreate")}
          </Button>
          <Button
            variant="destructive"
            disabled={isBusy}
            onClick={() => {
              // The hook reports its own failures.
              void resolution.removeFromBrowser();
            }}
          >
            {t("deletedInCloudDialog.removeLocal")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
