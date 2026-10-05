import { getNodesBounds } from "@xyflow/react";
import type { Node as FlowNode } from "@xyflow/react";
import {
  domToBlob as defaultDomToBlob,
  domToForeignObjectSvg as defaultDomToForeignObjectSvg,
} from "modern-screenshot";
import type { Options as ScreenshotOptions } from "modern-screenshot";

import { computeImageFrame } from "./compute-image-frame";
import type { ImageFormat } from "./compute-image-frame";

// The element overloads of modern-screenshot's functions; their context
// overloads are never used here.
export type CanvasCapture = {
  readonly domToBlob: (
    node: HTMLElement,
    options: ScreenshotOptions,
  ) => Promise<Blob>;
  readonly domToForeignObjectSvg: (
    node: HTMLElement,
    options: ScreenshotOptions,
  ) => Promise<SVGElement>;
};

const DEFAULT_CAPTURE: CanvasCapture = {
  domToBlob: defaultDomToBlob,
  domToForeignObjectSvg: defaultDomToForeignObjectSvg,
};

const EXPORTING_ATTRIBUTE = "data-exporting";
const EXCLUDE_ATTRIBUTE = "data-export-exclude";
const VIEWPORT_SELECTOR = ".react-flow__viewport";

function isIncluded(node: Node): boolean {
  return !(node instanceof Element && node.hasAttribute(EXCLUDE_ATTRIBUTE));
}

function findViewport(root: HTMLElement): HTMLElement {
  const viewport = root.querySelector<HTMLElement>(VIEWPORT_SELECTOR);
  if (viewport === null) {
    throw new Error("The canvas has no React Flow viewport to capture.");
  }
  return viewport;
}

async function captureViewport(
  viewport: HTMLElement,
  format: ImageFormat,
  options: ScreenshotOptions,
  capture: CanvasCapture,
): Promise<Blob> {
  if (format === "png") {
    return capture.domToBlob(viewport, { ...options, type: "image/png" });
  }
  // Not domToSvg: it wraps a PNG in an SVG; this keeps text and shapes.
  const svg = await capture.domToForeignObjectSvg(viewport, options);
  const text = new XMLSerializer().serializeToString(svg);
  return new Blob([text], { type: "image/svg+xml" });
}

/**
 * Captures every node of the canvas as an image at zoom 1, in the theme on
 * screen (spec section 10). `nodes` come from `getMeasuredNodes()`. The
 * user's viewport is left as it is: only the clone is moved.
 */
export async function captureCanvasImage(input: {
  readonly root: HTMLElement;
  readonly nodes: readonly FlowNode[];
  readonly hasSelfRelation: boolean;
  readonly format: ImageFormat;
  readonly capture?: CanvasCapture;
}): Promise<{ readonly blob: Blob; readonly isScaledDown: boolean }> {
  const { root, nodes, hasSelfRelation, format } = input;
  const frame = computeImageFrame({
    bounds: getNodesBounds([...nodes]),
    hasSelfRelation,
    format,
  });
  // No workerUrl: a worker from a blob: URL is blocked by worker-src 'self'.
  const options: ScreenshotOptions = {
    width: frame.width,
    height: frame.height,
    scale: frame.pixelRatio,
    backgroundColor: getComputedStyle(root)
      .getPropertyValue("--background")
      .trim(),
    style: {
      transform: `translate(${String(frame.translateX)}px, ${String(frame.translateY)}px) scale(1)`,
    },
    filter: isIncluded,
  };
  const viewport = findViewport(root);

  root.setAttribute(EXPORTING_ATTRIBUTE, "true");
  try {
    const blob = await captureViewport(
      viewport,
      format,
      options,
      input.capture ?? DEFAULT_CAPTURE,
    );
    return { blob, isScaledDown: frame.isScaledDown };
  } finally {
    root.removeAttribute(EXPORTING_ATTRIBUTE);
  }
}
