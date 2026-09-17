"use client";

import type { JSX } from "react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { Dialog, DialogContent } from "@/components/ui/dialog";

import type { RelationDraft } from "../../lib/to-relation-draft";
import { RelationDraftForm } from "./relation-draft-form";

const FLOW_NODE_SELECTOR = ".react-flow__node";
const FLOW_ROOT_SELECTOR = ".react-flow";
const FOCUSABLE_SELECTOR = "[tabindex]";
const INVALID_CONTROL_SELECTOR = '[aria-invalid="true"]';

function findTableNode(tableId: string | null): HTMLElement | undefined {
  if (tableId === null) {
    return undefined;
  }
  // Matching on dataset avoids building a selector from a user-chosen id.
  return [...document.querySelectorAll<HTMLElement>(FLOW_NODE_SELECTOR)].find(
    (node) => node.dataset.id === tableId,
  );
}

/**
 * Where focus goes after a drag-opened dialog closes: the node the drag
 * started from, or, when that node is gone, the focusable region holding the
 * canvas, so focus never falls back to the page body.
 */
function findDragReturnTarget(tableId: string | null): HTMLElement | undefined {
  return (
    findTableNode(tableId) ??
    document
      .querySelector(FLOW_ROOT_SELECTOR)
      ?.closest<HTMLElement>(FOCUSABLE_SELECTOR) ??
    undefined
  );
}

function isFocusableOpener(element: Element | null): element is HTMLElement {
  return (
    element instanceof HTMLElement &&
    element !== document.body &&
    element.isConnected
  );
}

type CreateRelationDialogProps = {
  readonly draft: RelationDraft | null;
  readonly onClose: () => void;
};

/** Creates a one-to-many, one-to-one or many-to-many relation from a draft. */
export function CreateRelationDialog({
  draft,
  onClose,
}: CreateRelationDialogProps): JSX.Element {
  const { t } = useTranslation("common");
  const submitRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);
  const sourceTableIdRef = useRef<string | null>(null);

  return (
    <Dialog
      open={draft !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      <DialogContent
        ref={contentRef}
        closeLabel={t("actions.close")}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md"
        onOpenAutoFocus={(event) => {
          openerRef.current = document.activeElement;
          sourceTableIdRef.current = draft?.fromTableId ?? null;
          // The defaults are meant to be accepted with Enter, so focus starts
          // on the confirm button. While it is disabled, focus starts on the
          // first invalid control, whose description says what blocks it.
          event.preventDefault();
          if (submitRef.current !== null && !submitRef.current.disabled) {
            submitRef.current.focus();
            return;
          }
          const firstInvalid =
            contentRef.current?.querySelector<HTMLElement>(
              INVALID_CONTROL_SELECTOR,
            ) ?? contentRef.current;
          firstInvalid?.focus();
        }}
        onCloseAutoFocus={(event) => {
          // Opened by a button, Radix returns focus to it. Opened by a drag,
          // nothing had focus, so the node the drag started from takes it.
          if (isFocusableOpener(openerRef.current)) {
            return;
          }
          const target = findDragReturnTarget(sourceTableIdRef.current);
          if (target !== undefined) {
            event.preventDefault();
            target.focus();
          }
        }}
      >
        {draft !== null && (
          <RelationDraftForm
            initialDraft={draft}
            submitRef={submitRef}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
