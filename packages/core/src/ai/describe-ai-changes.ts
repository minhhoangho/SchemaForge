import type { ElementChanges } from "../diff/diff-schemas.js";
import { diffSchemas } from "../diff/diff-schemas.js";
import type {
  ColumnId,
  EnumId,
  IndexId,
  RelationId,
  TableId,
} from "../model/ids.js";
import type { SchemaDocument } from "../model/schema-document.js";
import { formatAiName } from "./describe-path-for-ai.js";
import { describeRelationEndpoint } from "./describe-schema-for-ai.js";

// A parsed document has no dangling reference; this only keeps an id out of
// the text if one slips through.
const UNKNOWN_NAME = "?";

type DescribeElement<Id extends string> = (
  schema: SchemaDocument,
  id: Id,
) => string;

function nameOf(element: { readonly name: string } | undefined): string {
  return formatAiName(element?.name ?? UNKNOWN_NAME);
}

function describeTable(schema: SchemaDocument, id: TableId): string {
  return nameOf(schema.tables[id]);
}

function describeColumn(schema: SchemaDocument, id: ColumnId): string {
  const column = schema.columns[id];
  const table = column && schema.tables[column.tableId];
  return `${nameOf(table)}.${nameOf(column)}`;
}

function describeRelation(schema: SchemaDocument, id: RelationId): string {
  const relation = schema.relations[id];
  if (relation === undefined) {
    return UNKNOWN_NAME;
  }
  const pairs = relation.columnPairs;
  const from = describeRelationEndpoint(
    schema,
    relation.fromTableId,
    pairs.map((pair) => pair.fromColumnId),
  );
  const to = describeRelationEndpoint(
    schema,
    relation.toTableId,
    pairs.map((pair) => pair.toColumnId),
  );
  return `${from} -> ${to}`;
}

function describeIndex(schema: SchemaDocument, id: IndexId): string {
  const index = schema.indexes[id];
  const table = index && schema.tables[index.tableId];
  return `${nameOf(index)} on ${nameOf(table)}`;
}

function describeEnum(schema: SchemaDocument, id: EnumId): string {
  return nameOf(schema.enums[id]);
}

// Added and changed elements are named from `after`, removed ones from
// `before`, where they still exist.
function describeElementChanges<Id extends string>(
  kind: string,
  changes: ElementChanges<Id>,
  documents: {
    readonly before: SchemaDocument;
    readonly after: SchemaDocument;
  },
  describe: DescribeElement<Id>,
): readonly string[] {
  return [
    ...changes.added.map(
      (id) => `added ${kind} ${describe(documents.after, id)}`,
    ),
    ...changes.changed.map(
      (id) => `changed ${kind} ${describe(documents.after, id)}`,
    ),
    ...changes.removed.map(
      (id) => `removed ${kind} ${describe(documents.before, id)}`,
    ),
  ];
}

/**
 * The `changes` of a successful tool result (AI-R16): one English sentence per
 * element `diffSchemas` reports, by name and never by id, so the model learns
 * names it did not choose, such as a foreign key column of `buildRelation`.
 */
export function describeAiChanges(
  before: SchemaDocument,
  after: SchemaDocument,
): readonly string[] {
  const diff = diffSchemas(before, after);
  const documents = { before, after };
  return [
    ...(diff.isRenamed
      ? [`renamed schema to ${formatAiName(after.name)}`]
      : []),
    ...describeElementChanges("table", diff.tables, documents, describeTable),
    ...describeElementChanges(
      "column",
      diff.columns,
      documents,
      describeColumn,
    ),
    ...describeElementChanges(
      "relation",
      diff.relations,
      documents,
      describeRelation,
    ),
    ...describeElementChanges("index", diff.indexes, documents, describeIndex),
    ...describeElementChanges("enum", diff.enums, documents, describeEnum),
  ];
}
