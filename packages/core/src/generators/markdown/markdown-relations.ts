import type { ColumnId } from "../../model/ids.js";
import { sortRelations } from "../../model/ordering.js";
import type { ReferentialAction, Relation } from "../../model/relation.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { Table } from "../../model/table.js";
import type { MarkdownLabels } from "../shared/generator-types.js";
import { formatMarkdownInline } from "./markdown-text.js";

type Block = readonly string[];

const ACTION_KEYWORDS: Readonly<Record<ReferentialAction, string>> = {
  noAction: "NO ACTION",
  restrict: "RESTRICT",
  cascade: "CASCADE",
  setNull: "SET NULL",
  setDefault: "SET DEFAULT",
};

// Same level as the index subsection heading in `generate-markdown.ts`.
const RELATIONS_HEADING_PREFIX = "####";

function listItem(text: string): string {
  return `- ${text}`;
}

function joinedColumnNames(
  schema: SchemaDocument,
  columnIds: readonly ColumnId[],
): string {
  return columnIds
    .flatMap((columnId) => {
      const column = schema.columns[columnId];
      return column === undefined ? [] : [formatMarkdownInline(column.name)];
    })
    .join(", ");
}

function relationDetails(relation: Relation, labels: MarkdownLabels): string {
  const kind =
    relation.kind === "oneToOne" ? labels.oneToOne : labels.oneToMany;
  return `(${formatMarkdownInline(kind)}, ON DELETE ${ACTION_KEYWORDS[relation.onDelete]}, ON UPDATE ${ACTION_KEYWORDS[relation.onUpdate]})`;
}

function relationGroup(
  label: string,
  lines: readonly string[],
): readonly Block[] {
  return lines.length === 0 ? [] : [[formatMarkdownInline(label)], lines];
}

// The escaped source and target column lists of a relation, in pair order.
function relationColumns(
  schema: SchemaDocument,
  relation: Relation,
): { readonly from: string; readonly to: string } {
  return {
    from: joinedColumnNames(
      schema,
      relation.columnPairs.map((pair) => pair.fromColumnId),
    ),
    to: joinedColumnNames(
      schema,
      relation.columnPairs.map((pair) => pair.toColumnId),
    ),
  };
}

function outgoingLine(
  schema: SchemaDocument,
  relation: Relation,
  labels: MarkdownLabels,
): readonly string[] {
  const target = schema.tables[relation.toTableId];
  if (target === undefined) {
    return [];
  }
  const { from, to } = relationColumns(schema, relation);
  const targetName = formatMarkdownInline(target.name);
  return [
    listItem(
      `${from} → ${targetName}.${to} ${relationDetails(relation, labels)}`,
    ),
  ];
}

function incomingLine(
  schema: SchemaDocument,
  relation: Relation,
  labels: MarkdownLabels,
): readonly string[] {
  const source = schema.tables[relation.fromTableId];
  if (source === undefined) {
    return [];
  }
  const { from, to } = relationColumns(schema, relation);
  const sourceName = formatMarkdownInline(source.name);
  return [
    listItem(
      `${sourceName}.${from} → ${to} ${relationDetails(relation, labels)}`,
    ),
  ];
}

// A self-reference is both outgoing and incoming, so it is listed twice.
export function renderRelations(
  schema: SchemaDocument,
  table: Table,
  labels: MarkdownLabels,
): readonly Block[] {
  const relations = sortRelations(schema);
  const groups = [
    ...relationGroup(
      labels.outgoingRelations,
      relations
        .filter((relation) => relation.fromTableId === table.id)
        .flatMap((relation) => outgoingLine(schema, relation, labels)),
    ),
    ...relationGroup(
      labels.incomingRelations,
      relations
        .filter((relation) => relation.toTableId === table.id)
        .flatMap((relation) => incomingLine(schema, relation, labels)),
    ),
  ];
  return groups.length === 0
    ? []
    : [
        [
          `${RELATIONS_HEADING_PREFIX} ${formatMarkdownInline(labels.relationsHeading)}`,
        ],
        ...groups,
      ];
}
