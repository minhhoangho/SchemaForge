/** 1-based line and column; columns count UTF-16 code units. */
export type PrismaPosition = { readonly line: number; readonly column: number };

export type PrismaValue =
  | {
      readonly kind: "string";
      readonly value: string;
      readonly position: PrismaPosition;
    }
  | {
      readonly kind: "number";
      readonly text: string;
      readonly position: PrismaPosition;
    }
  // Includes `true`, `false` and dotted names such as `db.VarChar`.
  | {
      readonly kind: "identifier";
      readonly name: string;
      readonly position: PrismaPosition;
    }
  | {
      readonly kind: "array";
      readonly items: readonly PrismaValue[];
      readonly position: PrismaPosition;
    }
  | {
      readonly kind: "call";
      readonly name: string;
      readonly args: readonly PrismaArgument[];
      readonly position: PrismaPosition;
    };

export type PrismaArgument = {
  readonly name: string | null;
  readonly value: PrismaValue;
  readonly position: PrismaPosition;
};

/** `name` has no `@` or `@@` prefix: "id", "map", "db.VarChar". */
export type PrismaAttribute = {
  readonly name: string;
  readonly args: readonly PrismaArgument[];
  readonly position: PrismaPosition;
};

export type PrismaField = {
  readonly name: string;
  readonly typeName: string;
  readonly isOptional: boolean;
  readonly isList: boolean;
  /** The quoted text of `Unsupported("…")`, else null. */
  readonly unsupportedType: string | null;
  readonly attributes: readonly PrismaAttribute[];
  readonly docComment: string | null;
  readonly position: PrismaPosition;
};

export type PrismaEnumValue = {
  readonly name: string;
  readonly attributes: readonly PrismaAttribute[];
  readonly docComment: string | null;
  readonly position: PrismaPosition;
};

export type PrismaProperty = {
  readonly name: string;
  readonly value: PrismaValue;
  readonly position: PrismaPosition;
};

export type PrismaBlock =
  | {
      readonly kind: "datasource" | "generator";
      readonly name: string;
      readonly properties: readonly PrismaProperty[];
      readonly position: PrismaPosition;
    }
  | {
      readonly kind: "model" | "view" | "type";
      readonly name: string;
      readonly fields: readonly PrismaField[];
      readonly blockAttributes: readonly PrismaAttribute[];
      readonly docComment: string | null;
      readonly position: PrismaPosition;
    }
  | {
      readonly kind: "enum";
      readonly name: string;
      readonly values: readonly PrismaEnumValue[];
      readonly blockAttributes: readonly PrismaAttribute[];
      readonly docComment: string | null;
      readonly position: PrismaPosition;
    };

export type PrismaSchema = { readonly blocks: readonly PrismaBlock[] };

export type PrismaSyntaxError = { readonly position: PrismaPosition };
