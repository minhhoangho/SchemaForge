import type { ColumnId, Table } from "@schemaforge/core";
import { createCounterIdGenerator } from "@schemaforge/core/testing";
import { act } from "@testing-library/react";
import type { NodeProps } from "@xyflow/react";
import { ReactFlowProvider } from "@xyflow/react";
import type { JSX, ProfilerOnRenderCallback } from "react";
import { Profiler } from "react";
import { describe, expect, it, vi } from "vitest";

import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";
import { makeLargeSchema, STANDARD_LARGE_SCHEMA } from "@/testing/large-schema";
import { renderWithProviders } from "@/testing/render-with-providers";

import type { TableNode as TableFlowNode } from "../../lib/to-table-nodes";
import { TABLE_NODE_TYPE } from "../../lib/to-table-nodes";
import type { EditorStore } from "../../state/create-editor-store";
import { createEditorStore } from "../../state/create-editor-store";
import { EditorStoreProvider } from "../../state/editor-store-provider";
import { ColumnRow } from "./column-row";
import { TableNode } from "./table-node";

const SCHEMA_ID = "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4";
const RENAMED_COLUMN_NAME = "renamed_column";

type RenderCounter = {
  readonly onRender: ProfilerOnRenderCallback;
  readonly countOf: (profilerId: string) => number;
  readonly reset: () => void;
};

function createRenderCounter(): RenderCounter {
  const counts = new Map<string, number>();
  return {
    onRender: (profilerId) => {
      counts.set(profilerId, (counts.get(profilerId) ?? 0) + 1);
    },
    countOf: (profilerId) => counts.get(profilerId) ?? 0,
    reset: () => {
      counts.clear();
    },
  };
}

type Fixture = {
  readonly store: EditorStore;
  readonly editedTable: Table;
  readonly otherTable: Table;
};

function createFixture(): Fixture {
  const document = makeLargeSchema(STANDARD_LARGE_SCHEMA);
  const [editedTable, otherTable] = Object.values(document.tables);
  if (editedTable === undefined || otherTable === undefined) {
    throw new Error("The standard large schema has fewer than two tables.");
  }
  const store = createEditorStore({
    schemaId: SCHEMA_ID,
    document,
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
  return { store, editedTable, otherTable };
}

// The props React Flow passes to a node that is neither dragged nor selected.
function createNodeProps(table: Table): NodeProps<TableFlowNode> {
  return {
    id: table.id,
    type: TABLE_NODE_TYPE,
    data: { tableId: table.id },
    selected: false,
    dragging: false,
    draggable: true,
    selectable: true,
    deletable: true,
    isConnectable: true,
    zIndex: 0,
    positionAbsoluteX: table.position.x,
    positionAbsoluteY: table.position.y,
  };
}

function tableProfilerId(table: Table): string {
  return `table:${table.id}`;
}

function columnProfilerId(columnId: ColumnId): string {
  return `column:${columnId}`;
}

type HarnessProps = {
  readonly store: EditorStore;
  readonly children: JSX.Element;
};

function Harness({ store, children }: HarnessProps): JSX.Element {
  return (
    <EditorStoreProvider store={store}>
      <ReactFlowProvider>{children}</ReactFlowProvider>
    </EditorStoreProvider>
  );
}

function renameFirstNonKeyColumn(store: EditorStore, table: Table): ColumnId {
  const columnId = table.columnIds[1];
  if (columnId === undefined) {
    throw new Error("The edited table has no column besides its key.");
  }
  act(() => {
    store.getState().dispatch({
      type: "updateColumn",
      columnId,
      changes: { name: RENAMED_COLUMN_NAME },
    });
  });
  return columnId;
}

describe("TableNode render count", () => {
  it("renders no other table node when one column is renamed", () => {
    const { store, editedTable, otherTable } = createFixture();
    const counter = createRenderCounter();
    renderWithProviders(
      <Harness store={store}>
        <>
          {[editedTable, otherTable].map((table) => (
            <Profiler
              key={table.id}
              id={tableProfilerId(table)}
              onRender={counter.onRender}
            >
              <TableNode {...createNodeProps(table)} />
            </Profiler>
          ))}
        </>
      </Harness>,
      { locale: "en" },
    );
    counter.reset();

    renameFirstNonKeyColumn(store, editedTable);

    expect({
      edited: counter.countOf(tableProfilerId(editedTable)),
      other: counter.countOf(tableProfilerId(otherTable)),
    }).toEqual({ edited: 1, other: 0 });
  });

  // A Profiler cannot wrap the rows TableNode renders without changing
  // production code, so the rows are profiled directly here. TableNode
  // over-rendering is caught by the other-table count in the test above.
  it("renders only the changed column row", () => {
    const { store, editedTable } = createFixture();
    const counter = createRenderCounter();
    renderWithProviders(
      <Harness store={store}>
        <ul>
          {editedTable.columnIds.map((columnId) => (
            <Profiler
              key={columnId}
              id={columnProfilerId(columnId)}
              onRender={counter.onRender}
            >
              <ColumnRow columnId={columnId} tableId={editedTable.id} />
            </Profiler>
          ))}
        </ul>
      </Harness>,
      { locale: "en" },
    );
    counter.reset();

    const renamedColumnId = renameFirstNonKeyColumn(store, editedTable);

    expect(
      editedTable.columnIds.filter(
        (columnId) => counter.countOf(columnProfilerId(columnId)) > 0,
      ),
    ).toEqual([renamedColumnId]);
  });
});
