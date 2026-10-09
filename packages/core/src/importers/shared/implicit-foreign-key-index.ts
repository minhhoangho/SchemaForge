import { toNameKey } from "../../model/name-limits.js";

export type ForeignKeyColumns = {
  readonly name: string;
  readonly columnNames: readonly string[];
};

/**
 * Whether a plain index of a MySQL table is the one the database creates for
 * a foreign key that no key serves (import / export spec, section 5 "Index ngầm
 * của khóa ngoại MySQL", section 6 `@@index(map:)`).
 */
export type ImplicitForeignKeyIndexCheck = (
  name: string | null,
  columnNames: readonly string[],
) => boolean;

type PrefixNode = {
  count: number;
  readonly children: Map<string, PrefixNode>;
};

function createPrefixNode(): PrefixNode {
  return { count: 0, children: new Map() };
}

// A trie of the keys' column name keys, counting the keys through each node,
// so the keys that start with a column list are counted in time linear in its
// length, whatever the number of keys (spec section 1).
function createPrefixCounter(
  keys: readonly (readonly string[])[],
): (columnNames: readonly string[]) => number {
  const root = createPrefixNode();
  keys.forEach((columnNames) => {
    let node = root;
    columnNames.forEach((columnName) => {
      const key = toNameKey(columnName);
      const child = node.children.get(key) ?? createPrefixNode();
      node.children.set(key, child);
      child.count += 1;
      node = child;
    });
  });
  return (columnNames) => {
    let node: PrefixNode | undefined = root;
    for (const columnName of columnNames) {
      node = node.children.get(toNameKey(columnName));
      if (node === undefined) {
        return 0;
      }
    }
    return node.count;
  };
}

function isSameList(
  first: readonly string[],
  second: readonly string[],
): boolean {
  return (
    first.length === second.length &&
    first.every((name, position) => {
      const other = second[position];
      return other !== undefined && toNameKey(name) === toNameKey(other);
    })
  );
}

const NO_IMPLICIT_INDEX: ImplicitForeignKeyIndexCheck = () => false;

/**
 * Built once per table. `listKeys` gives the column lists of every key of the
 * table, the checked index among them: its primary key, unique columns and
 * indexes; it is called only when the table has a foreign key. The index is
 * implicit when its name is exactly the name of one of the table's foreign
 * keys, its columns are that foreign key's in order, and no other key starts
 * with them.
 */
export function createImplicitForeignKeyIndexCheck(
  foreignKeys: readonly ForeignKeyColumns[],
  listKeys: () => readonly (readonly string[])[],
): ImplicitForeignKeyIndexCheck {
  if (foreignKeys.length === 0) {
    return NO_IMPLICIT_INDEX;
  }
  const columnsByName = new Map<string, readonly string[]>();
  foreignKeys.forEach(({ name, columnNames }) => {
    if (!columnsByName.has(name)) {
      columnsByName.set(name, columnNames);
    }
  });
  const countKeysStartingWith = createPrefixCounter(listKeys());
  return (name, columnNames) => {
    const foreignKeyColumns =
      name === null ? undefined : columnsByName.get(name);
    return (
      foreignKeyColumns !== undefined &&
      isSameList(foreignKeyColumns, columnNames) &&
      countKeysStartingWith(columnNames) <= 1
    );
  };
}
