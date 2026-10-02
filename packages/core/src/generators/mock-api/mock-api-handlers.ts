import { formatPropertyKey } from "../shared/identifiers.js";
import { formatMswPath } from "../shared/rest-resources.js";
import type { RestResource } from "../shared/rest-resources.js";

type ResourceHandlersInput = {
  readonly resource: RestResource;
  readonly rowsVariable: string;
  // Original names of the primary key columns, in primary key order.
  readonly keyColumnNames: readonly string[];
};

// Identifiers and paths shared by the handlers of one resource.
type HandlerParts = {
  readonly rows: string;
  readonly collectionPath: string;
  readonly itemPath: string;
  readonly keyColumns: string;
  readonly keyParameters: string;
};

const READ_BODY = [
  "    const body: unknown = await request.json().catch(() => null);",
  "    if (!isRow(body)) {",
  "      return new HttpResponse(null, { status: 400 });",
  "    }",
];

const NOT_FOUND = [
  "    if (stored === undefined) {",
  "      return new HttpResponse(null, { status: 404 });",
  "    }",
];

function renderStringArray(values: readonly string[]): string {
  return `[${values.map((value) => JSON.stringify(value)).join(", ")}]`;
}

function findStored(parts: HandlerParts): string {
  return `    const stored = ${parts.rows}.find((candidate) => hasKey(candidate, ${parts.keyColumns}, ${parts.keyParameters}));`;
}

function renderCreate(parts: HandlerParts, hasPrimaryKey: boolean): string[] {
  const conflict = hasPrimaryKey
    ? [
        `    if (${parts.rows}.some((candidate) => hasKey(candidate, ${parts.keyColumns}, ${parts.keyColumns}.map((column) => body[column])))) {`,
        "      return new HttpResponse(null, { status: 409 });",
        "    }",
      ]
    : [];
  return [
    `  http.post(${parts.collectionPath}, async ({ request }) => {`,
    ...READ_BODY,
    ...conflict,
    `    ${parts.rows}.push(body);`,
    "    return HttpResponse.json(body, { status: 201 });",
    "  }),",
  ];
}

function renderItemHandlers(
  parts: HandlerParts,
  keyColumnNames: readonly string[],
): string[] {
  // Key columns come back from the stored row, so a numeric key stays a number.
  const keptKeys = keyColumnNames
    .map(
      (name) => `, ${formatPropertyKey(name)}: stored[${JSON.stringify(name)}]`,
    )
    .join("");
  return [
    `  http.get(${parts.itemPath}, ({ params }) => {`,
    findStored(parts),
    "    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);",
    "  }),",
    `  http.put(${parts.itemPath}, async ({ request, params }) => {`,
    ...READ_BODY,
    findStored(parts),
    ...NOT_FOUND,
    `    const replacement: Row = { ...body${keptKeys} };`,
    `    ${parts.rows}.splice(${parts.rows}.indexOf(stored), 1, replacement);`,
    "    return HttpResponse.json(replacement);",
    "  }),",
    `  http.delete(${parts.itemPath}, ({ params }) => {`,
    findStored(parts),
    ...NOT_FOUND,
    `    ${parts.rows}.splice(${parts.rows}.indexOf(stored), 1);`,
    "    return new HttpResponse(null, { status: 204 });",
    "  }),",
  ];
}

/** Elements of the `handlers` array for one table (spec CG-06). */
export function renderResourceHandlers(
  input: ResourceHandlersInput,
): readonly string[] {
  const { resource, rowsVariable, keyColumnNames } = input;
  const parts: HandlerParts = {
    rows: rowsVariable,
    collectionPath: JSON.stringify(formatMswPath(resource, false)),
    itemPath: JSON.stringify(formatMswPath(resource, true)),
    keyColumns: renderStringArray(keyColumnNames),
    keyParameters: `[${resource.keyParameters
      .map((parameter) => `params[${JSON.stringify(parameter.name)}]`)
      .join(", ")}]`,
  };
  const hasPrimaryKey = resource.keyParameters.length > 0;
  return [
    `  http.get(${parts.collectionPath}, () => HttpResponse.json(${rowsVariable})),`,
    ...renderCreate(parts, hasPrimaryKey),
    ...(hasPrimaryKey ? renderItemHandlers(parts, keyColumnNames) : []),
  ];
}
