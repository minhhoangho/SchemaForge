import type { SqlDialect } from "../../generators/shared/generator-types.js";
import type { DraftColumnType } from "../shared/import-draft.js";
import {
  mapSqlDefault,
  type SqlDefaultMapping,
} from "../shared/sql-default-mapping.js";
import type { PrismaArgument, PrismaValue } from "./prisma-ast.js";

export type PrismaDefaultInput = {
  readonly value: PrismaValue | null;
  readonly columnType: DraftColumnType;
  readonly provider: SqlDialect;
  // Database value by Prisma value name for the field's enum, if it has one.
  readonly enumValues: ReadonlyMap<string, string> | undefined;
};

const NO_DEFAULT: SqlDefaultMapping = {
  defaultValue: null,
  isAutoIncrement: false,
  codes: [],
};
const NOT_SUPPORTED: SqlDefaultMapping = {
  ...NO_DEFAULT,
  codes: ["default-not-supported"],
};
const AUTO_INCREMENT: SqlDefaultMapping = {
  ...NO_DEFAULT,
  isAutoIncrement: true,
};
const CURRENT_TIMESTAMP: SqlDefaultMapping = {
  ...NO_DEFAULT,
  defaultValue: { kind: "currentTimestamp" },
};
const GENERATE_UUID: SqlDefaultMapping = {
  ...NO_DEFAULT,
  defaultValue: { kind: "generateUuid" },
};
const BOOLEAN_WORDS: ReadonlySet<string> = new Set(["true", "false"]);
// uuid() and uuid(4) are random UUIDs; uuid(7) is time-ordered, which the
// model's generateUuid only approximates (spec section 6).
const UUID_VERSIONS: ReadonlyMap<string, SqlDefaultMapping> = new Map([
  ["4", GENERATE_UUID],
  ["7", { ...GENERATE_UUID, codes: ["default-approximated"] }],
]);

function literal(value: string): SqlDefaultMapping {
  return { ...NO_DEFAULT, defaultValue: { kind: "literal", value } };
}

function singleArgument(args: readonly PrismaArgument[]): PrismaValue | null {
  const [first, extra] = args;
  return first === undefined || extra !== undefined || first.name !== null
    ? null
    : first.value;
}

function mapUuid(args: readonly PrismaArgument[]): SqlDefaultMapping {
  if (args.length === 0) {
    return GENERATE_UUID;
  }
  const version = singleArgument(args);
  return version?.kind === "number"
    ? (UUID_VERSIONS.get(version.text) ?? NOT_SUPPORTED)
    : NOT_SUPPORTED;
}

// `prisma db pull` copies a MySQL default from information_schema, which adds
// a layer of `\` escapes to `'` and `\` inside an expression with a charset
// introducer: `(_utf8mb4\'a\\\\b\')` for mysqldump's `(_utf8mb4'a\\b')`.
const INFORMATION_SCHEMA_INTRODUCER_PATTERN = /^\(_[A-Za-z0-9_]+\\'/;
const INFORMATION_SCHEMA_ESCAPE_PATTERN = /\\(['\\])/g;

function removeInformationSchemaEscapes(
  text: string,
  provider: SqlDialect,
): string {
  return provider === "mysql" &&
    INFORMATION_SCHEMA_INTRODUCER_PATTERN.test(text)
    ? text.replace(INFORMATION_SCHEMA_ESCAPE_PATTERN, "$1")
    : text;
}

function mapDbGenerated(
  args: readonly PrismaArgument[],
  input: PrismaDefaultInput,
): SqlDefaultMapping {
  const expression = singleArgument(args);
  if (expression?.kind !== "string") {
    return NOT_SUPPORTED;
  }
  return mapSqlDefault({
    raw: {
      kind: "expression",
      text: removeInformationSchemaEscapes(expression.value, input.provider),
    },
    columnType: input.columnType,
    dialect: input.provider,
  });
}

// cuid(), nanoid(), ulid() and sequence() are filled in by Prisma Client or
// CockroachDB, so the database has no default the model can hold.
function mapCall(
  name: string,
  args: readonly PrismaArgument[],
  input: PrismaDefaultInput,
): SqlDefaultMapping {
  switch (name) {
    case "autoincrement":
      return AUTO_INCREMENT;
    case "now":
      return CURRENT_TIMESTAMP;
    case "uuid":
      return mapUuid(args);
    case "dbgenerated":
      return mapDbGenerated(args, input);
    default:
      return NOT_SUPPORTED;
  }
}

function mapIdentifier(
  name: string,
  input: PrismaDefaultInput,
): SqlDefaultMapping {
  const enumValue = input.enumValues?.get(name);
  if (enumValue !== undefined) {
    return literal(enumValue);
  }
  return BOOLEAN_WORDS.has(name) ? literal(name) : NOT_SUPPORTED;
}

/** Maps the value of `@default(…)` (import / export spec, section 6). */
export function mapPrismaDefault(input: PrismaDefaultInput): SqlDefaultMapping {
  const { value } = input;
  if (value === null) {
    return NOT_SUPPORTED;
  }
  switch (value.kind) {
    case "string":
      return literal(value.value);
    case "number":
      return literal(value.text);
    case "identifier":
      return mapIdentifier(value.name, input);
    case "call":
      return mapCall(value.name, value.args, input);
    case "array":
      return NOT_SUPPORTED;
    default: {
      const unreachable: never = value;
      return unreachable;
    }
  }
}
