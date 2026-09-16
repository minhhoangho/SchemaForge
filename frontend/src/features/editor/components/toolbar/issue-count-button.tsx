"use client";

import { CircleCheckIcon, TriangleAlertIcon } from "lucide-react";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { getIssueIndex } from "../../lib/issue-index";
import { useEditorStore } from "../../state/use-editor-store";

export function IssueCountButton(): JSX.Element {
  const { t } = useTranslation("editor");
  const count = useEditorStore(
    (state) => getIssueIndex(state.document).issues.length,
  );
  const setLeftPanelTab = useEditorStore((state) => state.setLeftPanelTab);

  function openIssuesTab(): void {
    setLeftPanelTab("issues");
  }

  if (count === 0) {
    const label = t("toolbar.issues.none");
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            onClick={openIssuesTab}
          >
            <CircleCheckIcon aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    );
  }

  const label = t("toolbar.issues.count", { count });
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" onClick={openIssuesTab}>
          <TriangleAlertIcon aria-hidden className="text-destructive" />
          {/* The full phrase names the button; it contains the visible
              number, so voice control still matches it (WCAG 2.5.3). */}
          <span aria-hidden>{count}</span>
          <span className="sr-only">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
