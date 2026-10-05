import type { Node as FlowNode } from "@xyflow/react";
import type { Options as ScreenshotOptions } from "modern-screenshot";
import type { Mock } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { captureCanvasImage } from "./capture-canvas-image";
import type { CanvasCapture } from "./capture-canvas-image";
import { IMAGE_PADDING } from "./compute-image-frame";

type FakeCapture = {
  readonly domToBlob: Mock<CanvasCapture["domToBlob"]>;
  readonly domToForeignObjectSvg: Mock<CanvasCapture["domToForeignObjectSvg"]>;
};

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const BACKGROUND = "oklch(1 0 0)";

const NODES: readonly FlowNode[] = [
  {
    id: "tbl_users",
    position: { x: 100, y: 50 },
    data: {},
    measured: { width: 240, height: 120 },
  },
  {
    id: "tbl_posts",
    position: { x: 500, y: 250 },
    data: {},
    measured: { width: 200, height: 100 },
  },
];

type Fixture = {
  readonly root: HTMLElement;
  readonly viewport: HTMLElement;
};

function createCanvas(): Fixture {
  const root = document.createElement("div");
  root.setAttribute("data-export-root", "");
  root.style.setProperty("--background", BACKGROUND);
  const viewport = document.createElement("div");
  viewport.className = "react-flow__viewport";
  root.append(viewport);
  document.body.append(root);
  return { root, viewport };
}

function createSvg(): SVGElement {
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.append(document.createElementNS(SVG_NAMESPACE, "foreignObject"));
  return svg;
}

function createCapture(): FakeCapture {
  return {
    domToBlob: vi.fn<CanvasCapture["domToBlob"]>(() =>
      Promise.resolve(new Blob(["png"], { type: "image/png" })),
    ),
    domToForeignObjectSvg: vi.fn<CanvasCapture["domToForeignObjectSvg"]>(() =>
      Promise.resolve(createSvg()),
    ),
  };
}

function getOptions(mock: FakeCapture["domToBlob"]): ScreenshotOptions {
  const options = mock.mock.lastCall?.[1];
  if (options === undefined) {
    throw new Error("The capture has not been called.");
  }
  return options;
}

describe("captureCanvasImage", () => {
  let fixture: Fixture;

  beforeEach(() => {
    fixture = createCanvas();
  });

  afterEach(() => {
    fixture.root.remove();
  });

  it("captures the viewport with the computed frame and background", async () => {
    const capture = createCapture();

    const result = await captureCanvasImage({
      root: fixture.root,
      nodes: NODES,
      hasSelfRelation: false,
      format: "png",
      capture,
    });

    expect(capture.domToBlob.mock.lastCall?.[0]).toBe(fixture.viewport);
    expect(getOptions(capture.domToBlob)).toMatchObject({
      type: "image/png",
      width: 600 + 2 * IMAGE_PADDING,
      height: 300 + 2 * IMAGE_PADDING,
      scale: 2,
      backgroundColor: BACKGROUND,
      style: {
        transform: `translate(${String(IMAGE_PADDING - 100)}px, ${String(IMAGE_PADDING - 50)}px) scale(1)`,
      },
    });
    expect(result.blob.type).toBe("image/png");
    expect(result.isScaledDown).toBe(false);
  });

  it("marks the root as exporting during capture and clears it after a failure", async () => {
    const capture = createCapture();
    const seen: (string | null)[] = [];
    capture.domToBlob.mockImplementation(() => {
      seen.push(fixture.root.getAttribute("data-exporting"));
      return Promise.reject(new Error("canvas too large"));
    });

    await expect(
      captureCanvasImage({
        root: fixture.root,
        nodes: NODES,
        hasSelfRelation: false,
        format: "png",
        capture,
      }),
    ).rejects.toThrow("canvas too large");
    expect(seen).toStrictEqual(["true"]);
    expect(fixture.root.hasAttribute("data-exporting")).toBe(false);
  });

  it("filters out excluded elements", async () => {
    const capture = createCapture();
    await captureCanvasImage({
      root: fixture.root,
      nodes: NODES,
      hasSelfRelation: false,
      format: "png",
      capture,
    });
    const excluded = document.createElement("div");
    excluded.setAttribute("data-export-exclude", "");
    const filter = getOptions(capture.domToBlob).filter;

    expect(filter?.(excluded)).toBe(false);
    expect(filter?.(document.createElement("div"))).toBe(true);
    expect(filter?.(document.createTextNode("users"))).toBe(true);
  });

  it("does not pass a worker url", async () => {
    const capture = createCapture();
    await captureCanvasImage({
      root: fixture.root,
      nodes: NODES,
      hasSelfRelation: false,
      format: "png",
      capture,
    });

    expect(getOptions(capture.domToBlob)).not.toHaveProperty("workerUrl");
  });

  it("serializes the foreign object svg into an svg blob", async () => {
    const capture = createCapture();

    const result = await captureCanvasImage({
      root: fixture.root,
      nodes: NODES,
      hasSelfRelation: true,
      format: "svg",
      capture,
    });
    const text = await result.blob.text();

    expect(capture.domToBlob).not.toHaveBeenCalled();
    expect(capture.domToForeignObjectSvg.mock.lastCall?.[1]).toMatchObject({
      scale: 1,
      backgroundColor: BACKGROUND,
    });
    expect(result.blob.type).toBe("image/svg+xml");
    expect(text.startsWith("<svg")).toBe(true);
    expect(text).toContain("foreignObject");
  });
});
