import type { Rect } from "@xyflow/react";

export type ImageFormat = "png" | "svg";

export type ImageFrame = {
  readonly width: number;
  readonly height: number;
  readonly translateX: number;
  readonly translateY: number;
  readonly pixelRatio: number;
  readonly isScaledDown: boolean;
};

export const IMAGE_PADDING = 40;
// A self relation leaves and re-enters the right side of its table, looping
// out by `EDGE_HANDLE_OFFSET` (16 px) in `relation-edge.tsx`. Its label is
// centered on that loop; half the label fits inside IMAGE_PADDING.
export const SELF_RELATION_LOOP_WIDTH = 16;
// Safari on iOS refuses a canvas larger than this many pixels.
export const MAX_PNG_PIXELS = 16_777_216;
// Under the canvas side limit of Chrome, Firefox and Safari.
export const MAX_PNG_SIDE = 16_384;
const MAX_PNG_PIXEL_RATIO = 2;

/**
 * The image size and the transform that brings every node into it at zoom 1
 * (spec section 10). A PNG shrinks instead of being cut when it would pass
 * the canvas limits; an SVG has none.
 */
export function computeImageFrame(input: {
  readonly bounds: Rect;
  readonly hasSelfRelation: boolean;
  readonly format: ImageFormat;
}): ImageFrame {
  const { bounds, hasSelfRelation, format } = input;
  const loopWidth = hasSelfRelation ? SELF_RELATION_LOOP_WIDTH : 0;
  const width = Math.ceil(bounds.width + 2 * IMAGE_PADDING + loopWidth);
  const height = Math.ceil(bounds.height + 2 * IMAGE_PADDING);
  const pixelRatio =
    format === "svg"
      ? 1
      : Math.min(
          MAX_PNG_PIXEL_RATIO,
          Math.sqrt(MAX_PNG_PIXELS / (width * height)),
          MAX_PNG_SIDE / Math.max(width, height),
        );

  return {
    width,
    height,
    translateX: IMAGE_PADDING - bounds.x,
    translateY: IMAGE_PADDING - bounds.y,
    pixelRatio,
    isScaledDown: pixelRatio < 1,
  };
}
