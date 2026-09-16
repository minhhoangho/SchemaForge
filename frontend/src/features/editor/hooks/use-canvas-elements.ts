import type { TFunction } from "i18next";
import type { RefObject } from "react";
import { useMemo, useRef, useState } from "react";

import { describeRelation, describeTable } from "../lib/aria-label-config";
import type { MeasuredSize } from "../lib/apply-canvas-changes";
import { getIssueIndex } from "../lib/issue-index";
import { toRelationEdges } from "../lib/to-relation-edges";
import type { RelationEdge } from "../lib/to-relation-edges";
import { toTableNodes } from "../lib/to-table-nodes";
import type { TableNode } from "../lib/to-table-nodes";
import { useEditorStore } from "../state/use-editor-store";

export type CanvasElements = {
  readonly nodes: TableNode[];
  readonly edges: RelationEdge[];
};

function reuseArray<Element>(next: Element[], previous: Element[]): Element[] {
  const isUnchanged =
    next.length === previous.length &&
    next.every((element, index) => element === previous[index]);
  return isUnchanged ? previous : next;
}

// Core maps are keyed by template literal ids (plan issue 27).
function lookup<Value>(
  elements: Readonly<Record<string, Value>>,
  elementId: string,
): Value | undefined {
  return elements[elementId];
}

function useBaseNodes(): readonly TableNode[] {
  const tables = useEditorStore((state) => state.document.tables);
  const selection = useEditorStore((state) => state.selection);
  const dragPositions = useEditorStore((state) => state.dragPositions);
  // The previous output of the mapper, never React Flow's own node objects,
  // which carry internal fields such as `dragging`.
  const previous = useRef<readonly TableNode[]>([]);

  return useMemo(() => {
    // Writing the ref here is safe even if React discards this render: the
    // mapper is a pure, deterministic function of the current inputs and only
    // decides which objects are reused, so a discarded result at worst makes
    // the next render build a few new objects with equal content.
    previous.current = toTableNodes({
      tables,
      selection,
      dragPositions,
      previousNodes: previous.current,
    });
    return previous.current;
  }, [tables, selection, dragPositions]);
}

function useBaseEdges(): readonly RelationEdge[] {
  const document = useEditorStore((state) => state.document);
  const selection = useEditorStore((state) => state.selection);
  const previous = useRef<readonly RelationEdge[]>([]);

  return useMemo(() => {
    // Writing the ref here is safe even if React discards this render: the
    // mapper is a pure, deterministic function of the current inputs and only
    // decides which objects are reused, so a discarded result at worst makes
    // the next render build a few new objects with equal content.
    previous.current = toRelationEdges({
      relations: document.relations,
      tables: document.tables,
      selection,
      issueIndex: getIssueIndex(document),
      previousEdges: previous.current,
    });
    return previous.current;
  }, [document, selection]);
}

function useLabeledNodes(
  t: TFunction<"canvas">,
  measuredSizes: RefObject<ReadonlyMap<string, MeasuredSize>>,
): TableNode[] {
  const baseNodes = useBaseNodes();
  const tables = useEditorStore((state) => state.document.tables);
  const previous = useRef<TableNode[]>([]);
  const [labeled] = useState(() => new WeakMap<TableNode, TableNode>());

  return useMemo(() => {
    const next = baseNodes.map((base) => {
      const table = tables[base.data.tableId];
      const ariaLabel = table === undefined ? "" : describeTable(table, t);
      const cached = labeled.get(base);
      if (cached?.ariaLabel === ariaLabel) {
        return cached;
      }
      // Measured sizes ride along, so React Flow does not hide the node to
      // measure it again every time its object changes (during a drag).
      const measured = measuredSizes.current.get(base.id);
      const node =
        measured === undefined
          ? { ...base, ariaLabel }
          : { ...base, ariaLabel, measured };
      labeled.set(base, node);
      return node;
    });
    // Safe in a discarded render for the same reason as the base mappers:
    // the array and the cache only preserve object identity for equal content.
    previous.current = reuseArray(next, previous.current);
    return previous.current;
  }, [baseNodes, tables, labeled, measuredSizes, t]);
}

function useLabeledEdges(t: TFunction<"canvas">): RelationEdge[] {
  const baseEdges = useBaseEdges();
  const document = useEditorStore((state) => state.document);
  const previous = useRef<RelationEdge[]>([]);
  const [labeled] = useState(() => new WeakMap<RelationEdge, RelationEdge>());

  return useMemo(() => {
    const next = baseEdges.map((base) => {
      const relation = lookup(document.relations, base.id);
      const hasIssue = base.data?.hasIssue ?? false;
      const ariaLabel =
        relation === undefined
          ? ""
          : describeRelation({ relation, document, hasIssue, t });
      const cached = labeled.get(base);
      if (cached?.ariaLabel === ariaLabel) {
        return cached;
      }
      const edge = { ...base, ariaLabel };
      labeled.set(base, edge);
      return edge;
    });
    // Safe in a discarded render for the same reason as the base mappers:
    // the array and the cache only preserve object identity for equal content.
    previous.current = reuseArray(next, previous.current);
    return previous.current;
  }, [baseEdges, document, labeled, t]);
}

/**
 * Derives the React Flow nodes and edges from the editor store with stable
 * references: an unchanged table or relation keeps its object, and an
 * unchanged list keeps its array, so React Flow re-renders only what changed.
 */
export function useCanvasElements(
  t: TFunction<"canvas">,
  measuredSizes: RefObject<ReadonlyMap<string, MeasuredSize>>,
): CanvasElements {
  const nodes = useLabeledNodes(t, measuredSizes);
  const edges = useLabeledEdges(t);
  return { nodes, edges };
}
