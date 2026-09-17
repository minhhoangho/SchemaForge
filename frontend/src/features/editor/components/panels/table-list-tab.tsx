"use client";

import type { Table } from "@schemaforge/core";
import { sortTables } from "@schemaforge/core";
import { TriangleAlertIcon } from "lucide-react";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/class-names";

import { useRevealTable } from "../../hooks/use-reveal-table";
import { getIssueIndex } from "../../lib/issue-index";
import { useEditorStore } from "../../state/use-editor-store";

// A hovered or selected row sits on `bg-accent`, where the muted and
// destructive text tokens fall just under 4.5:1 in the light theme; the
// secondary text switches to `accent-foreground` there (about 16:1 light,
// 14:1 dark). The warning icon keeps its color: 3:1 is enough for an icon.
const ON_ACCENT_TEXT_CLASS_NAME =
  "text-xs group-hover:text-accent-foreground group-aria-[current=true]:text-accent-foreground";

type TableRowProps = {
  readonly table: Table;
  readonly issueCount: number;
  readonly isSelected: boolean;
  readonly onReveal: (table: Table) => void;
};

function TableRow({
  table,
  issueCount,
  isSelected,
  onReveal,
}: TableRowProps): JSX.Element {
  const { t } = useTranslation("editor");

  return (
    <li>
      <button
        type="button"
        aria-current={isSelected ? "true" : undefined}
        className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-1 focus-visible:outline-ring aria-[current=true]:bg-accent aria-[current=true]:font-medium aria-[current=true]:text-accent-foreground"
        onClick={() => {
          onReveal(table);
        }}
      >
        {/* The spaces keep each part its own words in the accessible name. */}
        <span className="min-w-0 flex-1 truncate">{table.name}</span>{" "}
        <span
          className={cn(ON_ACCENT_TEXT_CLASS_NAME, "text-muted-foreground")}
        >
          {t("leftPanel.tables.columnCount", {
            count: table.columnIds.length,
          })}
        </span>
        {issueCount > 0 && (
          <>
            {" "}
            <span className="inline-flex items-center gap-0.5 text-xs">
              <TriangleAlertIcon
                aria-hidden
                className="size-3.5 text-destructive"
              />
              {/* The phrase names the badge and contains the visible number,
                  so voice control still matches it (WCAG 2.5.3). */}
              <span
                aria-hidden
                className={cn(ON_ACCENT_TEXT_CLASS_NAME, "text-destructive")}
              >
                {issueCount}
              </span>
              <span className="sr-only">
                {t("leftPanel.tables.issueCount", { count: issueCount })}
              </span>
            </span>
          </>
        )}
      </button>
    </li>
  );
}

/**
 * The tables in core order. A row selects its table and centers it: the way
 * to pick a table without going through the canvas (spec sections 2 and 12).
 */
export function TableListTab(): JSX.Element {
  const { t } = useTranslation("editor");
  const schema = useEditorStore((state) => state.document);
  const selectedTableIds = useEditorStore((state) => state.selection.tableIds);
  const revealTable = useRevealTable();
  const tables = sortTables(schema);
  const issueIndex = getIssueIndex(schema);

  return (
    <ScrollArea className="h-full">
      {tables.length === 0 ? (
        <p className="p-3 text-sm text-muted-foreground">
          {t("leftPanel.tables.empty")}
        </p>
      ) : (
        <ul className="grid gap-0.5 p-2">
          {tables.map((table) => (
            <TableRow
              key={table.id}
              table={table}
              issueCount={issueIndex.countOfTable(table.id)}
              isSelected={selectedTableIds.includes(table.id)}
              onReveal={(revealed) => {
                revealTable(revealed.id);
              }}
            />
          ))}
        </ul>
      )}
    </ScrollArea>
  );
}
