"use client";

import type { OperationError } from "@schemaforge/core";
import type { JSX, RefObject } from "react";
import { useState } from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  buildRelationOperation,
  validateRelationDraft,
} from "../../lib/build-relation-operation";
import type { RelationDraft } from "../../lib/to-relation-draft";
import { useEditorStore } from "../../state/use-editor-store";
import { RelationDraftFields } from "./relation-draft-fields";

function generateId(): string {
  return crypto.randomUUID();
}

type RelationDraftFormProps = {
  readonly initialDraft: RelationDraft;
  readonly submitRef: RefObject<HTMLButtonElement | null>;
  readonly onClose: () => void;
};

/**
 * Edits a draft and dispatches it as one operation. It lives inside
 * DialogContent, which unmounts on close, so every opening starts from the
 * draft it was given.
 */
export function RelationDraftForm({
  initialDraft,
  submitRef,
  onClose,
}: RelationDraftFormProps): JSX.Element {
  const { t } = useTranslation("editor");
  const document = useEditorStore((state) => state.document);
  const dispatch = useEditorStore((state) => state.dispatch);
  const [draft, setDraft] = useState(initialDraft);
  const [buildError, setBuildError] = useState<OperationError | null>(null);
  const errors = validateRelationDraft(document, draft);
  const canSubmit = errors.length === 0;

  function submit(): void {
    if (!canSubmit) {
      return;
    }
    // Remove the previous alert first, so the same error shown again is a new
    // alert that screen readers announce again rather than unchanged text.
    flushSync(() => {
      setBuildError(null);
    });
    const built = buildRelationOperation(document, draft, generateId);
    // One dispatch is one history entry; a rejected one keeps the dialog open.
    const dispatched = built.isOk ? dispatch(built.value) : built;
    if (!dispatched.isOk) {
      setBuildError(dispatched.error);
      return;
    }
    onClose();
  }

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <DialogHeader>
        <DialogTitle>{t("relationDialog.title")}</DialogTitle>
        <DialogDescription>
          {t("relationDialog.description")}
          {/* Only promise Enter while it can actually confirm. */}
          {canSubmit && <> {t("relationDialog.enterHint")}</>}
        </DialogDescription>
      </DialogHeader>
      <RelationDraftFields
        document={document}
        draft={draft}
        errors={errors}
        buildError={buildError}
        onChange={(next) => {
          setDraft(next);
          setBuildError(null);
        }}
      />
      <DialogFooter>
        <Button ref={submitRef} type="submit" disabled={!canSubmit}>
          {t("relationDialog.submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}
