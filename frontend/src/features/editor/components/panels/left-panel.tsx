"use client";

import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { getIssueIndex } from "../../lib/issue-index";
import type { LeftPanelTab } from "../../state/create-editor-store";
import { useEditorStore } from "../../state/use-editor-store";
import { EnumListTab } from "./enum-list-tab";
import { IssueListTab } from "./issue-list-tab";
import { TableListTab } from "./table-list-tab";

const LEFT_PANEL_TABS = [
  "tables",
  "enums",
  "issues",
] as const satisfies readonly LeftPanelTab[];

const DEFAULT_TAB: LeftPanelTab = "tables";

function isLeftPanelTab(value: string): value is LeftPanelTab {
  return LEFT_PANEL_TABS.some((tab) => tab === value);
}

type CollapseButtonProps = {
  readonly isExpanded: boolean;
  readonly controlsId: string;
  readonly onToggle: () => void;
};

// One button for both states, so focus stays on it when the panel toggles.
function CollapseButton({
  isExpanded,
  controlsId,
  onToggle,
}: CollapseButtonProps): JSX.Element {
  const { t } = useTranslation("editor");
  const label = isExpanded ? t("leftPanel.collapse") : t("leftPanel.expand");
  const Icon = isExpanded ? PanelLeftCloseIcon : PanelLeftOpenIcon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          aria-expanded={isExpanded}
          aria-controls={isExpanded ? controlsId : undefined}
          onClick={onToggle}
        >
          <Icon aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * The editor's left panel: tables, enums and issues. The open tab lives in
 * the store (`null` means collapsed), so the toolbar and the issue list can
 * open a tab too.
 */
export function LeftPanel(): JSX.Element {
  const { t } = useTranslation("editor");
  const tab = useEditorStore((state) => state.leftPanelTab);
  const setLeftPanelTab = useEditorStore((state) => state.setLeftPanelTab);
  const issueCount = useEditorStore(
    (state) => getIssueIndex(state.document).issues.length,
  );
  // The tab to reopen after collapsing; only read in the click handler.
  const lastTabRef = useRef<LeftPanelTab>(DEFAULT_TAB);
  const tabsId = useId();

  // Follows every open tab, including one opened or collapsed from outside
  // the panel (the toolbar issue button, the issue list), so expanding
  // reopens what was last shown.
  useEffect(() => {
    if (tab !== null) {
      lastTabRef.current = tab;
    }
  }, [tab]);

  function toggle(): void {
    setLeftPanelTab(tab === null ? lastTabRef.current : null);
  }

  return (
    <aside
      aria-label={t("leftPanel.label")}
      className="flex h-full min-h-0 flex-col border-r border-border bg-background"
    >
      <div className="flex items-center p-1">
        <CollapseButton
          isExpanded={tab !== null}
          controlsId={tabsId}
          onToggle={toggle}
        />
      </div>
      {tab !== null && (
        <Tabs
          id={tabsId}
          value={tab}
          className="min-h-0 w-72 flex-1 px-2 pb-2"
          onValueChange={(value) => {
            if (isLeftPanelTab(value)) {
              setLeftPanelTab(value);
            }
          }}
        >
          <TabsList className="w-full">
            <TabsTrigger value="tables">
              {t("leftPanel.tabs.tables")}
            </TabsTrigger>
            <TabsTrigger value="enums">{t("leftPanel.tabs.enums")}</TabsTrigger>
            <TabsTrigger value="issues">
              {t("leftPanel.tabs.issues", { count: issueCount })}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="tables" className="min-h-0">
            <TableListTab />
          </TabsContent>
          <TabsContent value="enums" className="min-h-0">
            <EnumListTab />
          </TabsContent>
          <TabsContent value="issues" className="min-h-0">
            <IssueListTab />
          </TabsContent>
        </Tabs>
      )}
    </aside>
  );
}
