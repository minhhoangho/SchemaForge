"use client";

import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { isSelectionEmpty } from "../lib/selection";
import { useEditorStore } from "../state/use-editor-store";

export type SkipToPanelLinkProps = {
  readonly propertiesPanelId: string;
  readonly leftPanelId: string;
};

/**
 * Lets keyboard users skip the canvas: the first stop inside `<main>`, shown
 * only while focused. It leads to the properties panel, or to the left panel
 * while nothing is selected and the properties panel is hidden (spec section
 * 12).
 */
export function SkipToPanelLink({
  propertiesPanelId,
  leftPanelId,
}: SkipToPanelLinkProps): JSX.Element {
  const { t } = useTranslation("editor");
  const hasSelection = useEditorStore(
    (state) => !isSelectionEmpty(state.selection),
  );
  const isCodeMode = useEditorStore((state) => state.rightPanelMode === "code");
  // The code panel is always shown in code mode, selection or not.
  const targetId = hasSelection || isCodeMode ? propertiesPanelId : leftPanelId;

  return (
    <a
      href={`#${targetId}`}
      className="sr-only rounded-md bg-popover text-sm font-medium text-popover-foreground shadow-md focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10 focus:px-3 focus:py-2 focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-1 focus-visible:outline-ring"
      onClick={(event) => {
        // The hash alone would scroll, but not move focus in every browser.
        event.preventDefault();
        document.getElementById(targetId)?.focus();
      }}
    >
      {t("layout.skipToPanel")}
    </a>
  );
}
