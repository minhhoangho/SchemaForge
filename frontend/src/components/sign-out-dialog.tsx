"use client";

import type { JSX } from "react";
import { useRef } from "react";
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

import type { SignOutFlowState } from "./use-sign-out-flow";

export type SignOutDialogProps = {
  readonly state: SignOutFlowState;
  readonly onTrySync: () => void;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly onReturnFocus: () => void;
};

function readUnsyncedCount(state: SignOutFlowState): number | null {
  return state.kind === "confirming" || state.kind === "syncing"
    ? state.unsyncedCount
    : null;
}

/**
 * Warns that signing out drops schema changes that never reached the cloud
 * (spec section 7, step 1), offers one more sync attempt, and stays open while
 * the sign-out runs so the wait for every schema lock is visible.
 */
export function SignOutDialog({
  state,
  onTrySync,
  onConfirm,
  onCancel,
  onReturnFocus,
}: SignOutDialogProps): JSX.Element {
  const { t } = useTranslation("sync");
  const unsyncedCount = readUnsyncedCount(state);
  // signing-out carries no count, so the description keeps the last one the
  // user was shown instead of flipping to another message mid-sign-out.
  const lastCountRef = useRef(0);
  if (unsyncedCount !== null) {
    lastCountRef.current = unsyncedCount;
  }
  if (state.kind === "idle") {
    lastCountRef.current = 0;
  }
  const shownCount = unsyncedCount ?? lastCountRef.current;
  const isBusy = state.kind === "syncing" || state.kind === "signing-out";
  const busyKey = state.kind === "syncing" ? "syncing" : "signingOut";

  return (
    <AlertDialog
      open={state.kind !== "idle" && state.kind !== "counting"}
      onOpenChange={(isOpen) => {
        // Escape and a click outside both mean "Cancel"; a running step keeps
        // the dialog open until it reports its result.
        if (!isOpen && !isBusy) {
          onCancel();
        }
      }}
    >
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          // The menu names where focus goes back to, because the button that
          // opened this dialog is gone once the sign-out succeeds.
          event.preventDefault();
          onReturnFocus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{t("signOutDialog.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {shownCount === 0
              ? t("signOutDialog.allSynced")
              : t("signOutDialog.description", { count: shownCount })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {isBusy ? <p role="status">{t(`signOutDialog.${busyKey}`)}</p> : null}
        <AlertDialogFooter>
          {/* Radix focuses this button when the dialog opens, so the warning is
              announced; without it nothing inside the dialog takes focus. */}
          <AlertDialogCancel disabled={isBusy}>
            {t("signOutDialog.cancel")}
          </AlertDialogCancel>
          {shownCount === 0 ? null : (
            <Button variant="outline" disabled={isBusy} onClick={onTrySync}>
              {t("signOutDialog.trySync")}
            </Button>
          )}
          <Button
            variant={shownCount === 0 ? "default" : "destructive"}
            disabled={isBusy}
            onClick={onConfirm}
          >
            {shownCount === 0
              ? t("signOutDialog.signOut")
              : t("signOutDialog.signOutAnyway")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
