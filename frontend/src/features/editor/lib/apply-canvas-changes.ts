import type {
  OperationOfType,
  Position,
  RelationId,
  SchemaDocument,
  TableId,
} from "@schemaforge/core";
import type {
  EdgeChange,
  NodeChange,
  OnSelectionChangeParams,
} from "@xyflow/react";

import type { Selection } from "./selection";
import type { RelationEdge } from "./to-relation-edges";
import type { TableNode } from "./to-table-nodes";

type MoveElementsOperation = OperationOfType<"moveElements">;
type ElementMove = MoveElementsOperation["moves"][number];

export type MeasuredSize = {
  readonly width: number;
  readonly height: number;
};

export type DragPositionMap = Readonly<Partial<Record<TableId, Position>>>;

/**
 * The part of the editor store the canvas writes to. Declared here rather
 * than imported from `state/`, which already imports `lib/`; the editor store
 * satisfies it structurally.
 */
export type CanvasChangeStore = {
  readonly getState: () => {
    readonly document: SchemaDocument;
    readonly selection: Selection;
    readonly dragPositions: DragPositionMap;
    readonly setSelection: (selection: Selection) => void;
    readonly setDragPositions: (dragPositions: DragPositionMap) => void;
    readonly dispatch: (
      operation: MoveElementsOperation,
      options?: { readonly coalesce: "keyboardMove" },
    ) => unknown;
  };
};

export type NodeChangeEffects = {
  readonly dragPositions: DragPositionMap;
  readonly selection: Selection;
  readonly moves: readonly ElementMove[];
  readonly measuredSizes: readonly (readonly [string, MeasuredSize])[];
};

type PositionChange = Extract<NodeChange<TableNode>, { type: "position" }>;

// Core maps are keyed by template literal ids; React Flow hands back plain
// strings, so elements are looked up here and their typed id used after that
// (plan issue 27).
function lookup<Value>(
  elements: Readonly<Record<string, Value>>,
  elementId: string,
): Value | undefined {
  return elements[elementId];
}

function isSamePosition(first: Position, second: Position): boolean {
  return first.x === second.x && first.y === second.y;
}

function hasSameIds(
  first: readonly string[],
  second: readonly string[],
): boolean {
  return (
    first.length === second.length && first.every((id) => second.includes(id))
  );
}

function toggleId<Id extends string>(
  ids: readonly Id[],
  id: Id,
  isSelected: boolean,
): readonly Id[] {
  const others = ids.filter((existing) => existing !== id);
  return isSelected ? [...others, id] : others;
}

function reducePositionChange(
  effects: NodeChangeEffects,
  change: PositionChange,
  document: SchemaDocument,
): NodeChangeEffects {
  const table = lookup(document.tables, change.id);
  if (table === undefined || change.position === undefined) {
    return effects;
  }
  if (change.dragging === true) {
    const dragPositions = {
      ...effects.dragPositions,
      [table.id]: change.position,
    };
    return { ...effects, dragPositions };
  }
  // A drag ends with `dragging: false` while its table still has a drag
  // position. The entry is dropped here, because React Flow skips the drag
  // stop handler for an aborted drag (multitouch, node gone); a finished drag
  // is dispatched by that handler from React Flow's own node positions.
  // Anything else is an arrow key move.
  if (effects.dragPositions[table.id] !== undefined) {
    const dragPositions = Object.fromEntries(
      Object.entries(effects.dragPositions).filter(
        ([tableId]) => tableId !== table.id,
      ),
    );
    return { ...effects, dragPositions };
  }
  if (isSamePosition(change.position, table.position)) {
    return effects;
  }
  const move = { elementId: table.id, position: change.position };
  return { ...effects, moves: [...effects.moves, move] };
}

function reduceNodeChange(
  effects: NodeChangeEffects,
  change: NodeChange<TableNode>,
  document: SchemaDocument,
): NodeChangeEffects {
  switch (change.type) {
    case "position":
      return reducePositionChange(effects, change, document);
    case "select": {
      const table = lookup(document.tables, change.id);
      if (table === undefined) {
        return effects;
      }
      const { selection } = effects;
      const tableIds = toggleId(selection.tableIds, table.id, change.selected);
      return { ...effects, selection: { ...selection, tableIds } };
    }
    case "dimensions":
      return change.dimensions === undefined
        ? effects
        : {
            ...effects,
            measuredSizes: [
              ...effects.measuredSizes,
              [change.id, change.dimensions],
            ],
          };
    case "remove":
    case "add":
    case "replace":
      // Tables only change through dispatch; React Flow never removes or adds one.
      return effects;
    default: {
      const unhandledChange: never = change;
      return unhandledChange;
    }
  }
}

/** Folds React Flow node changes into what the editor store should do. */
export function reduceNodeChanges(
  state: Pick<
    ReturnType<CanvasChangeStore["getState"]>,
    "document" | "dragPositions" | "selection"
  >,
  changes: readonly NodeChange<TableNode>[],
): NodeChangeEffects {
  const initial: NodeChangeEffects = {
    dragPositions: state.dragPositions,
    selection: state.selection,
    moves: [],
    measuredSizes: [],
  };
  return changes.reduce(
    (effects, change) => reduceNodeChange(effects, change, state.document),
    initial,
  );
}

function mergeMeasuredSizes(
  measuredSizes: Map<string, MeasuredSize>,
  updates: NodeChangeEffects["measuredSizes"],
  document: SchemaDocument,
): void {
  updates.forEach(([nodeId, size]) => {
    measuredSizes.set(nodeId, size);
  });
  // Sizes of deleted tables would otherwise stay for the life of the canvas.
  [...measuredSizes.keys()].forEach((nodeId) => {
    if (lookup(document.tables, nodeId) === undefined) {
      measuredSizes.delete(nodeId);
    }
  });
}

/**
 * Applies node changes: drag positions and selection go to the store, arrow
 * key moves are dispatched with keyboard coalescing, and measured sizes are
 * remembered so a recreated node object is not measured again.
 */
export function applyNodeChanges(
  store: CanvasChangeStore,
  changes: readonly NodeChange<TableNode>[],
  measuredSizes: Map<string, MeasuredSize>,
): void {
  const state = store.getState();
  const effects = reduceNodeChanges(state, changes);
  mergeMeasuredSizes(measuredSizes, effects.measuredSizes, state.document);
  if (effects.dragPositions !== state.dragPositions) {
    state.setDragPositions(effects.dragPositions);
  }
  if (!hasSameIds(effects.selection.tableIds, state.selection.tableIds)) {
    state.setSelection(effects.selection);
  }
  if (effects.moves.length > 0) {
    state.dispatch(
      { type: "moveElements", moves: effects.moves },
      { coalesce: "keyboardMove" },
    );
  }
}

/** Folds edge changes into selected relation ids; every other change is ignored. */
export function reduceEdgeChanges(
  document: SchemaDocument,
  relationIds: readonly RelationId[],
  changes: readonly EdgeChange<RelationEdge>[],
): readonly RelationId[] {
  return changes.reduce((ids, change) => {
    if (change.type !== "select") {
      return ids;
    }
    const relation = lookup(document.relations, change.id);
    return relation === undefined
      ? ids
      : toggleId(ids, relation.id, change.selected);
  }, relationIds);
}

export function applyEdgeChanges(
  store: CanvasChangeStore,
  changes: readonly EdgeChange<RelationEdge>[],
): void {
  const state = store.getState();
  const { relationIds } = state.selection;
  const next = reduceEdgeChanges(state.document, relationIds, changes);
  if (!hasSameIds(next, relationIds)) {
    state.setSelection({ ...state.selection, relationIds: next });
  }
}

export function applySelectionChange(
  store: CanvasChangeStore,
  { nodes, edges }: OnSelectionChangeParams<TableNode, RelationEdge>,
): void {
  const state = store.getState();
  const { tables, relations } = state.document;
  const selection: Selection = {
    tableIds: nodes.flatMap((node) => lookup(tables, node.id)?.id ?? []),
    relationIds: edges.flatMap((edge) => lookup(relations, edge.id)?.id ?? []),
  };
  if (
    !hasSameIds(selection.tableIds, state.selection.tableIds) ||
    !hasSameIds(selection.relationIds, state.selection.relationIds)
  ) {
    state.setSelection(selection);
  }
}

/** The moves of a finished mouse drag, leaving out tables that ended where they started. */
export function toDragStopMoves(
  document: SchemaDocument,
  nodes: readonly Pick<TableNode, "id" | "position">[],
): readonly ElementMove[] {
  return nodes.flatMap((node): readonly ElementMove[] => {
    const table = lookup(document.tables, node.id);
    return table === undefined || isSamePosition(node.position, table.position)
      ? []
      : [{ elementId: table.id, position: node.position }];
  });
}

/** Dispatches one moveElements for every dragged table, then clears drag positions. */
export function applyDragStop(
  store: CanvasChangeStore,
  nodes: readonly Pick<TableNode, "id" | "position">[],
): void {
  const state = store.getState();
  const moves = toDragStopMoves(state.document, nodes);
  if (moves.length > 0) {
    state.dispatch({ type: "moveElements", moves });
  }
  state.setDragPositions({});
}
