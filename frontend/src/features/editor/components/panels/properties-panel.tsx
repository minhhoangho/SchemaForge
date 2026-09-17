"use client";

import type { TableId } from "@schemaforge/core";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { ScrollArea } from "@/components/ui/scroll-area";

import { countSelection } from "../../lib/selection";
import type { Selection } from "../../lib/selection";
import { useEditorStore } from "../../state/use-editor-store";
import { MultiSelectionPanel } from "./multi-selection-panel";
import { RelationPanel } from "./relation-panel";
import { TablePanel } from "./table-panel/table-panel";

type PanelActions = {
  readonly onCreateRelation: (tableId: TableId) => void;
  // Every panel here deletes exactly the current selection, so all of them
  // share the editor's delete path (spec section 3).
  readonly onDelete: () => void;
};

type SelectionContentProps = PanelActions & {
  readonly selection: Selection;
};

// The table of spec section 2: one table, one relation, or several elements.
function SelectionContent({
  selection,
  onCreateRelation,
  onDelete,
}: SelectionContentProps): JSX.Element {
  const [tableId] = selection.tableIds;
  const [relationId] = selection.relationIds;
  if (countSelection(selection) === 1 && tableId !== undefined) {
    return (
      <div className="p-4">
        <TablePanel
          tableId={tableId}
          onCreateRelation={onCreateRelation}
          onDelete={onDelete}
        />
      </div>
    );
  }
  if (countSelection(selection) === 1 && relationId !== undefined) {
    return <RelationPanel relationId={relationId} onDelete={onDelete} />;
  }
  return <MultiSelectionPanel selection={selection} onDelete={onDelete} />;
}

export type PropertiesPanelProps = PanelActions & {
  // The skip link's target; the panel takes focus without joining the tab order.
  readonly id: string;
};

/**
 * The right panel, showing the properties of the current selection. Hidden
 * without a selection. It scrolls as a whole, with no sticky heading that
 * could cover a focused field (spec section 12).
 */
export function PropertiesPanel({
  id,
  onCreateRelation,
  onDelete,
}: PropertiesPanelProps): JSX.Element | null {
  const { t } = useTranslation("editor");
  const selection = useEditorStore((state) => state.selection);

  if (countSelection(selection) === 0) {
    return null;
  }

  return (
    <aside
      id={id}
      tabIndex={-1}
      aria-label={t("layout.propertiesLabel")}
      className="flex h-full min-h-0 w-80 shrink-0 flex-col border-l border-border bg-background outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
    >
      <ScrollArea className="min-h-0 flex-1">
        <SelectionContent
          selection={selection}
          onCreateRelation={onCreateRelation}
          onDelete={onDelete}
        />
      </ScrollArea>
    </aside>
  );
}
