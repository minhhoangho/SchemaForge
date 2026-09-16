import type { Relation, SchemaDocument, Table } from "@schemaforge/core";
import type { AriaLabelConfig } from "@xyflow/react";
import type { TFunction } from "i18next";

type Direction = "up" | "down" | "left" | "right";

export type CanvasAriaLabelConfig = Pick<
  AriaLabelConfig,
  | "node.a11yDescription.default"
  | "node.a11yDescription.keyboardDisabled"
  | "node.a11yDescription.ariaLiveMessage"
  | "edge.a11yDescription.default"
  | "minimap.ariaLabel"
  | "handle.ariaLabel"
>;

function isDirection(value: string): value is Direction {
  return (
    value === "up" || value === "down" || value === "left" || value === "right"
  );
}

/**
 * Builds the translated labels React Flow renders itself. React Flow 12.11.6
 * shows `node.a11yDescription.keyboardDisabled` while keyboard moves are on
 * (its text mentions the arrow keys) and `default` when they are off, so each
 * key gets the sentence React Flow actually shows under it. The controls keys
 * stay untranslated because the editor renders no `<Controls>`.
 */
export function buildAriaLabelConfig(
  t: TFunction<"canvas">,
): CanvasAriaLabelConfig {
  return {
    "node.a11yDescription.default": t("a11y.nodeKeyboardDisabled"),
    "node.a11yDescription.keyboardDisabled": t("a11y.nodeDescription"),
    "node.a11yDescription.ariaLiveMessage": ({ direction, x, y }) =>
      t("a11y.nodeMoved", {
        direction: isDirection(direction)
          ? t(`a11y.directions.${direction}`)
          : direction,
        x,
        y,
      }),
    "edge.a11yDescription.default": t("a11y.edgeDescription"),
    "minimap.ariaLabel": t("minimap.label"),
    "handle.ariaLabel": t("handle.label"),
  };
}

/** The accessible name of a table node, such as "Table users, 5 columns". */
export function describeTable(table: Table, t: TFunction<"canvas">): string {
  return t("node.label", { name: table.name, count: table.columnIds.length });
}

// Core maps are keyed by template literal ids; this reads them with a plain
// string id without a cast (plan issue 27).
function lookup<Value>(
  elements: Readonly<Record<string, Value>>,
  elementId: string,
): Value | undefined {
  return elements[elementId];
}

export type DescribeRelationInput = {
  readonly relation: Relation;
  readonly document: Pick<SchemaDocument, "tables" | "columns">;
  readonly hasIssue: boolean;
  readonly t: TFunction<"canvas">;
};

// Joins the translated parts of an accessible name the way the base label
// separates its own parts.
const NAME_PART_SEPARATOR = ", ";

/**
 * The accessible name of a relation edge, such as
 * "posts.author_id → users.id, one-to-many, 2 columns, has issues". The
 * visible label next to the edge is hidden from screen readers, so everything
 * it shows is part of this name.
 */
export function describeRelation({
  relation,
  document,
  hasIssue,
  t,
}: DescribeRelationInput): string {
  const firstPair = relation.columnPairs[0];
  const columnCount = relation.columnPairs.length;
  const label = t("edge.label", {
    fromTable: lookup(document.tables, relation.fromTableId)?.name ?? "",
    toTable: lookup(document.tables, relation.toTableId)?.name ?? "",
    fromColumn:
      lookup(document.columns, firstPair?.fromColumnId ?? "")?.name ?? "",
    toColumn: lookup(document.columns, firstPair?.toColumnId ?? "")?.name ?? "",
    kind:
      relation.kind === "oneToOne"
        ? t("edge.kindOneToOne")
        : t("edge.kindOneToMany"),
  });
  return [
    label,
    ...(columnCount > 1 ? [t("edge.columnCount", { count: columnCount })] : []),
    ...(hasIssue ? [t("edge.hasIssues")] : []),
  ].join(NAME_PART_SEPARATOR);
}
