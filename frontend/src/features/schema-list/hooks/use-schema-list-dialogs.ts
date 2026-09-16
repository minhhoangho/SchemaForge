"use client";

import type { RefObject } from "react";
import { useRef, useState } from "react";

import type { SchemaRecord } from "@/lib/storage/records";
import type { SchemaListEntry } from "@/lib/storage/schema-repository";

export type SchemaListDialogTarget =
  | { readonly kind: "create" }
  | { readonly kind: "rename"; readonly schema: SchemaRecord }
  | { readonly kind: "delete"; readonly entry: SchemaListEntry };

export type SchemaListDialogs = {
  // The target outlives isOpen so a closing dialog keeps its text while Radix
  // plays the exit animation.
  readonly target: SchemaListDialogTarget;
  readonly isOpen: boolean;
  readonly open: (
    target: SchemaListDialogTarget,
    trigger: HTMLElement | null,
  ) => void;
  readonly setOpen: (isOpen: boolean) => void;
  // For a close that removed the element that opened the dialog.
  readonly closeToHeading: () => void;
  readonly returnFocus: () => void;
};

type DialogState = {
  readonly target: SchemaListDialogTarget;
  readonly isOpen: boolean;
};

/**
 * Which dialog of the list screen is open, and where focus goes when it
 * closes. The dialogs open from buttons and row menus rather than from a
 * Radix trigger, so Radix cannot return focus by itself.
 */
export function useSchemaListDialogs(
  headingRef: RefObject<HTMLHeadingElement | null>,
): SchemaListDialogs {
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<DialogState>({
    target: { kind: "create" },
    isOpen: false,
  });

  function setOpen(isOpen: boolean): void {
    setState((current) => ({ ...current, isOpen }));
  }

  return {
    target: state.target,
    isOpen: state.isOpen,
    open: (target, trigger) => {
      returnFocusRef.current = trigger;
      setState({ target, isOpen: true });
    },
    setOpen,
    closeToHeading: () => {
      returnFocusRef.current = null;
      setOpen(false);
    },
    returnFocus: () => {
      const element = returnFocusRef.current;
      if (element?.isConnected === true) {
        element.focus();
        return;
      }
      headingRef.current?.focus();
    },
  };
}
