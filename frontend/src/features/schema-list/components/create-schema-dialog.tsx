"use client";

import type { JSX } from "react";
import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CreateSchemaDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onCreate: (name: string) => Promise<void>;
  readonly onReturnFocus: () => void;
};

type CreateSchemaFormProps = Pick<CreateSchemaDialogProps, "onCreate">;

// Lives inside DialogContent, which unmounts on close, so every opening starts
// with an empty field and no error.
function CreateSchemaForm({ onCreate }: CreateSchemaFormProps): JSX.Element {
  const { t } = useTranslation("schemaList");
  const fieldId = useId();
  const errorId = useId();
  const fieldRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isNameBlank = name.trim() === "";
  const shouldShowError = hasTriedSubmit && isNameBlank;

  async function handleSubmit(): Promise<void> {
    setHasTriedSubmit(true);
    if (isNameBlank) {
      // A click on the submit button would leave focus there, where the error
      // linked to the field is never read; focusing the field announces it.
      fieldRef.current?.focus();
      return;
    }
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    try {
      await onCreate(name.trim());
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <DialogHeader>
        <DialogTitle>{t("create.dialogTitle")}</DialogTitle>
        <DialogDescription>{t("create.description")}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor={fieldId}>{t("create.nameLabel")}</Label>
        <Input
          ref={fieldRef}
          id={fieldId}
          value={name}
          required
          autoComplete="off"
          aria-invalid={shouldShowError}
          aria-describedby={shouldShowError ? errorId : undefined}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
        {shouldShowError && (
          <p id={errorId} className="text-sm text-destructive">
            {t("nameRequired")}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isSubmitting}>
          {t("create.submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function CreateSchemaDialog({
  open,
  onOpenChange,
  onCreate,
  onReturnFocus,
}: CreateSchemaDialogProps): JSX.Element {
  const { t } = useTranslation("common");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={t("actions.close")}
        onCloseAutoFocus={(event) => {
          // Without a DialogTrigger Radix has nowhere to return focus, so the
          // screen names the element that opened the dialog.
          event.preventDefault();
          onReturnFocus();
        }}
      >
        <CreateSchemaForm onCreate={onCreate} />
      </DialogContent>
    </Dialog>
  );
}
