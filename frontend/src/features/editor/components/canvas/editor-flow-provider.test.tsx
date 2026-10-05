import { act, render } from "@testing-library/react";
import type * as XYFlow from "@xyflow/react";
import type { FitViewOptions, Node as FlowNode } from "@xyflow/react";
import type { JSX } from "react";
import type { Mock } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CanvasNodeControls } from "../../lib/viewport-controls";
import {
  FIT_VIEW_PADDING,
  useCanvasNodeControls,
} from "../../lib/viewport-controls";
import { EditorFlowProvider } from "./editor-flow-provider";

// The React Flow instance is the boundary: its nodes and whether they are all
// measured are set by each test, and its fitView calls are recorded.
const flowState = vi.hoisted(
  (): {
    nodes: FlowNode[];
    isInitialized: boolean;
    fitView: Mock<(options?: FitViewOptions) => Promise<boolean>>;
  } => ({
    nodes: [],
    isInitialized: false,
    fitView: vi.fn<(options?: FitViewOptions) => Promise<boolean>>(),
  }),
);

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof XYFlow>();
  type FlowInstance = ReturnType<typeof actual.useReactFlow>;
  // useReactFlow returns a stable object, so its wrapper must be stable too.
  const wrappedFlows = new WeakMap<FlowInstance, FlowInstance>();
  function wrapFlow(flow: FlowInstance): FlowInstance {
    return {
      ...flow,
      getNodes: () => flowState.nodes,
      fitView: (options) => flowState.fitView(options),
    };
  }
  function useFakeReactFlow(): FlowInstance {
    const flow = actual.useReactFlow();
    const wrapped = wrappedFlows.get(flow) ?? wrapFlow(flow);
    wrappedFlows.set(flow, wrapped);
    return wrapped;
  }
  return {
    ...actual,
    useReactFlow: useFakeReactFlow,
    useNodesInitialized: () => flowState.isInitialized,
  };
});

function makeNode(id: string, isMeasured: boolean): FlowNode {
  return {
    id,
    position: { x: 0, y: 0 },
    data: {},
    ...(isMeasured ? { measured: { width: 240, height: 120 } } : {}),
  };
}

function renderProvider(): {
  readonly getControls: () => CanvasNodeControls;
  readonly rerender: () => void;
} {
  let controls: CanvasNodeControls | null = null;
  function Consumer(): JSX.Element {
    controls = useCanvasNodeControls();
    return <p>canvas</p>;
  }
  // A new element each time, so React renders the provider again and reads
  // the faked useNodesInitialized, as a React Flow store update would.
  function createTree(): JSX.Element {
    return (
      <EditorFlowProvider>
        <Consumer />
      </EditorFlowProvider>
    );
  }
  const { rerender } = render(createTree());
  return {
    getControls: () => {
      if (controls === null) {
        throw new Error("The provider has not rendered yet.");
      }
      return controls;
    },
    rerender: () => {
      rerender(createTree());
    },
  };
}

describe("EditorFlowProvider canvas node controls", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (media: string) => ({
      matches: false,
      media,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    flowState.fitView.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    flowState.nodes = [];
    flowState.isInitialized = false;
    flowState.fitView.mockReset();
  });

  it("returns only measured nodes", () => {
    flowState.nodes = [makeNode("tbl_users", true), makeNode("tbl_new", false)];
    const { getControls } = renderProvider();

    expect(
      getControls()
        .getMeasuredNodes()
        .map((node) => node.id),
    ).toEqual(["tbl_users"]);
  });

  it("fits the given nodes once every one of them is measured", () => {
    flowState.nodes = [makeNode("tbl_users", true)];
    const { getControls, rerender } = renderProvider();

    act(() => {
      getControls().fitNodes(["tbl_users", "tbl_new"]);
    });
    expect(flowState.fitView).not.toHaveBeenCalled();

    flowState.nodes = [makeNode("tbl_users", true), makeNode("tbl_new", false)];
    rerender();
    expect(flowState.fitView).not.toHaveBeenCalled();

    flowState.nodes = [makeNode("tbl_users", true), makeNode("tbl_new", true)];
    flowState.isInitialized = true;
    rerender();
    rerender();

    expect(flowState.fitView).toHaveBeenCalledOnce();
    expect(flowState.fitView).toHaveBeenCalledWith({
      nodes: [{ id: "tbl_users" }, { id: "tbl_new" }],
      padding: FIT_VIEW_PADDING,
      duration: 200,
    });
  });

  it("replaces the pending nodes on a second call", () => {
    flowState.nodes = [makeNode("tbl_users", true)];
    const { getControls } = renderProvider();

    act(() => {
      getControls().fitNodes(["tbl_missing"]);
    });
    act(() => {
      getControls().fitNodes(["tbl_users"]);
    });

    expect(flowState.fitView).toHaveBeenCalledOnce();
    expect(flowState.fitView).toHaveBeenCalledWith(
      expect.objectContaining({ nodes: [{ id: "tbl_users" }] }),
    );
  });
});
