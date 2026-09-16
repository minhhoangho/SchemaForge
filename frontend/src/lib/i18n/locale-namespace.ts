// Mirrors the key tree of a locale namespace with string leaves, so a
// translated namespace must have exactly the same keys as the English one.
export type LocaleNamespace<T> = {
  readonly [K in keyof T]: T[K] extends string ? string : LocaleNamespace<T[K]>;
};
