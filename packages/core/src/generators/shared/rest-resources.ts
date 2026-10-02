import type { ColumnId, EnumId, TableId } from "../../model/ids.js";
import { sortEnums, sortTables } from "../../model/ordering.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { Table } from "../../model/table.js";
import {
  toCamelCaseIdentifier,
  toKebabCaseSegment,
  toPascalCaseIdentifier,
} from "./identifiers.js";
import { createNameAllocator } from "./name-allocator.js";

export type RestKeyParameter = {
  readonly columnId: ColumnId;
  readonly name: string;
};

/** Names one table shares between the OpenAPI document and the Mock API. */
export type RestResource = {
  readonly tableId: TableId;
  // OpenAPI component name, PascalCase; operationIds are built from it.
  readonly typeName: string;
  // kebab-case, unique without regard to case.
  readonly pathSegment: string;
  // Empty when the table has no primary key.
  readonly keyParameters: readonly RestKeyParameter[];
};

export type RestApiNames = {
  readonly enumTypeNames: ReadonlyMap<EnumId, string>;
  // In sortTables order.
  readonly resources: readonly RestResource[];
};

const ENUM_FALLBACK = "Enum";
const TABLE_FALLBACK = "Table";
const PATH_SEGMENT_FALLBACK = "table";
const PARAMETER_FALLBACK = "field";
const MSW_PATH_PREFIX = "*/api";

function createCodeNameAllocator(): ReturnType<typeof createNameAllocator> {
  return createNameAllocator({
    reserved: [],
    comparison: "exact",
    separator: "",
    maxBytes: null,
  });
}

function buildKeyParameters(
  schema: SchemaDocument,
  table: Table,
): readonly RestKeyParameter[] {
  const allocator = createCodeNameAllocator();
  return table.primaryKeyColumnIds.flatMap((columnId) => {
    const column = schema.columns[columnId];
    if (column === undefined) {
      return [];
    }
    const preferred = toCamelCaseIdentifier(column.name, PARAMETER_FALLBACK);
    return [{ columnId, name: allocator.allocate(preferred) }];
  });
}

/** Component names, path segments and key parameters (spec section 5, CG-06, CG-07). */
export function buildRestApiNames(schema: SchemaDocument): RestApiNames {
  const componentNames = createCodeNameAllocator();
  const pathSegments = createNameAllocator({
    reserved: [],
    comparison: "caseInsensitive",
    separator: "-",
    maxBytes: null,
  });

  const enumTypeNames = new Map(
    sortEnums(schema).map((enumeration) => [
      enumeration.id,
      componentNames.allocate(
        toPascalCaseIdentifier(enumeration.name, ENUM_FALLBACK),
      ),
    ]),
  );
  const resources = sortTables(schema).map((table) => ({
    tableId: table.id,
    typeName: componentNames.allocate(
      toPascalCaseIdentifier(table.name, TABLE_FALLBACK),
    ),
    pathSegment: pathSegments.allocate(
      toKebabCaseSegment(table.name, PATH_SEGMENT_FALLBACK),
    ),
    keyParameters: buildKeyParameters(schema, table),
  }));
  return { enumTypeNames, resources };
}

function formatPath(
  prefix: string,
  resource: RestResource,
  isItemPath: boolean,
  formatParameter: (name: string) => string,
): string {
  const collectionPath = `${prefix}/${resource.pathSegment}`;
  if (!isItemPath) {
    return collectionPath;
  }
  return [
    collectionPath,
    ...resource.keyParameters.map((parameter) =>
      formatParameter(parameter.name),
    ),
  ].join("/");
}

/** "/orders" or "/orders/{tenantId}/{orderNumber}". */
export function formatOpenApiPath(
  resource: RestResource,
  isItemPath: boolean,
): string {
  return formatPath("", resource, isItemPath, (name) => `{${name}}`);
}

/** "*\/api/orders" or "*\/api/orders/:tenantId/:orderNumber"; "*" matches any origin. */
export function formatMswPath(
  resource: RestResource,
  isItemPath: boolean,
): string {
  return formatPath(
    MSW_PATH_PREFIX,
    resource,
    isItemPath,
    (name) => `:${name}`,
  );
}
