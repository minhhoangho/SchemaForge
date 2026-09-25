"use client";

import type { JSX } from "react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export type UploadCandidate = { readonly id: string; readonly name: string };

export type UploadSchemasDialogProps = {
  readonly isOpen: boolean;
  readonly candidates: readonly UploadCandidate[];
  readonly isUploading: boolean;
  readonly onUpload: (schemaIds: readonly string[]) => void;
  readonly onLater: () => void;
};

type UploadFormProps = Omit<UploadSchemasDialogProps, "isOpen">;

// Lives inside DialogContent, which unmounts on close, so every opening
// starts again with every schema selected.
function UploadForm({
  candidates,
  isUploading,
  onUpload,
  onLater,
}: UploadFormProps): JSX.Element {
  const { t } = useTranslation("sync");
  const idPrefix = useId();
  const [uncheckedIds, setUncheckedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const selectedIds = candidates
    .map((candidate) => candidate.id)
    .filter((id) => !uncheckedIds.has(id));

  function toggle(schemaId: string, isChecked: boolean): void {
    setUncheckedIds((current) => {
      const next = new Set(current);
      if (isChecked) {
        next.delete(schemaId);
      } else {
        next.add(schemaId);
      }
      return next;
    });
  }

  return (
    <form
      className="grid gap-4"
      aria-busy={isUploading}
      onSubmit={(event) => {
        event.preventDefault();
        onUpload(selectedIds);
      }}
    >
      <fieldset className="grid gap-2" disabled={isUploading}>
        <legend className="mb-2 font-medium">
          {t("uploadDialog.listLabel")}
        </legend>
        {candidates.map((candidate) => {
          const checkboxId = `${idPrefix}-${candidate.id}`;
          return (
            <div key={candidate.id} className="flex min-h-6 items-center gap-2">
              <Checkbox
                id={checkboxId}
                checked={!uncheckedIds.has(candidate.id)}
                disabled={isUploading}
                onCheckedChange={(checked) => {
                  toggle(candidate.id, checked === true);
                }}
              />
              <Label htmlFor={checkboxId}>{candidate.name}</Label>
            </div>
          );
        })}
      </fieldset>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={isUploading}
          onClick={onLater}
        >
          {t("uploadDialog.later")}
        </Button>
        <Button
          type="submit"
          disabled={isUploading || selectedIds.length === 0}
        >
          {t("uploadDialog.submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function UploadSchemasDialog({
  isOpen,
  onLater,
  ...formProps
}: UploadSchemasDialogProps): JSX.Element {
  const { t } = useTranslation(["sync", "common"]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(isNowOpen) => {
        // Escape and the close button would otherwise abandon a running
        // upload's result.
        if (!isNowOpen && !formProps.isUploading) {
          onLater();
        }
      }}
    >
      <DialogContent closeLabel={t("common:actions.close")}>
        <DialogHeader>
          <DialogTitle>{t("sync:uploadDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("sync:uploadDialog.description")}
          </DialogDescription>
        </DialogHeader>
        <UploadForm {...formProps} onLater={onLater} />
      </DialogContent>
    </Dialog>
  );
}
