import type { JSX } from "react";

export type RelationMarkerShape = "many" | "one";

export type RelationMarkerVariant = "default" | "selected" | "issue";

const MARKER_SHAPES: readonly RelationMarkerShape[] = ["many", "one"];

const VARIANT_COLORS: Readonly<Record<RelationMarkerVariant, string>> = {
  default: "var(--canvas-relation)",
  selected: "var(--canvas-relation-selected)",
  issue: "var(--destructive)",
};

const VARIANTS: readonly RelationMarkerVariant[] = [
  "default",
  "selected",
  "issue",
];

// Drawn with the table side at x = 12, so `auto-start-reverse` turns the same
// marker around when it sits at the start of an edge.
const MARKER_PATHS: Readonly<Record<RelationMarkerShape, string>> = {
  many: "M0,6 L12,0 M0,6 L12,6 M0,6 L12,12 M2,1 L2,11",
  one: "M5,1 L5,11 M8,1 L8,11",
};

const MARKER_SIZE = 12;
const MARKER_CENTER = 6;
const MARKER_STROKE_WIDTH = 1.5;

function getMarkerId(
  shape: RelationMarkerShape,
  variant: RelationMarkerVariant,
): string {
  return `relation-marker-${shape}-${variant}`;
}

/** The `url(#…)` a relation edge passes as `markerStart` or `markerEnd`. */
export function getRelationMarkerUrl(
  shape: RelationMarkerShape,
  variant: RelationMarkerVariant,
): string {
  return `url(#${getMarkerId(shape, variant)})`;
}

/**
 * Crow's foot and single bar markers for relation edges, rendered once per
 * canvas. Colors come from the canvas tokens, so both themes follow.
 */
export function RelationMarkers(): JSX.Element {
  return (
    <svg aria-hidden className="absolute size-0">
      <defs>
        {MARKER_SHAPES.flatMap((shape) =>
          VARIANTS.map((variant) => (
            <marker
              key={getMarkerId(shape, variant)}
              id={getMarkerId(shape, variant)}
              viewBox={`0 0 ${String(MARKER_SIZE)} ${String(MARKER_SIZE)}`}
              refX={MARKER_SIZE}
              refY={MARKER_CENTER}
              markerWidth={MARKER_SIZE}
              markerHeight={MARKER_SIZE}
              markerUnits="userSpaceOnUse"
              orient="auto-start-reverse"
            >
              <path
                d={MARKER_PATHS[shape]}
                fill="none"
                stroke={VARIANT_COLORS[variant]}
                strokeWidth={MARKER_STROKE_WIDTH}
              />
            </marker>
          )),
        )}
      </defs>
    </svg>
  );
}
