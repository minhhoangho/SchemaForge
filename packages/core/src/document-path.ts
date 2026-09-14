export type DocumentPath = readonly (string | number)[];

type PathSegment = DocumentPath[number];

// Relational operators order numbers by value and strings by UTF-16 code unit,
// so sorting is identical across browsers, Node and locales (unlike localeCompare).
function compareValues<Value extends string | number>(
  a: Value,
  b: Value,
): number {
  if (a < b) {
    return -1;
  }
  return a > b ? 1 : 0;
}

function compareSegments(a: PathSegment, b: PathSegment): number {
  if (typeof a === "number") {
    return typeof b === "number" ? compareValues(a, b) : -1;
  }
  return typeof b === "number" ? 1 : compareValues(a, b);
}

export function compareDocumentPaths(a: DocumentPath, b: DocumentPath): number {
  for (const [index, segment] of a.entries()) {
    const other = b[index];
    if (other === undefined) {
      return 1;
    }
    const order = compareSegments(segment, other);
    if (order !== 0) {
      return order;
    }
  }
  return b.length > a.length ? -1 : 0;
}

export function sortByPathThenCode<
  T extends { readonly code: string; readonly path: DocumentPath },
>(items: readonly T[]): readonly T[] {
  return items.toSorted((a, b) => {
    const pathOrder = compareDocumentPaths(a.path, b.path);
    return pathOrder === 0 ? compareValues(a.code, b.code) : pathOrder;
  });
}
