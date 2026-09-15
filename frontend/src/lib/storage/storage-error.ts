export const STORAGE_ERROR_CODES = [
  "quota-exceeded",
  "unavailable",
  "outdated-tab",
  "closed",
  "unknown",
] as const;

export type StorageErrorCode = (typeof STORAGE_ERROR_CODES)[number];

// Dexie wraps the original IndexedDB error in `inner`. The limit also ends
// the walk when a chain of inner errors is circular.
const MAX_INNER_ERROR_DEPTH = 5;

const UNKNOWN_ERROR_NAME = "UnknownError";

type ErrorNameRule = {
  readonly code: StorageErrorCode;
  readonly errorNames: readonly string[];
};

// Ordered by priority: the first rule matching any name in the chain wins.
const ERROR_NAME_RULES: readonly ErrorNameRule[] = [
  { code: "quota-exceeded", errorNames: ["QuotaExceededError"] },
  { code: "outdated-tab", errorNames: ["VersionError"] },
  { code: "closed", errorNames: ["DatabaseClosedError"] },
  {
    code: "unavailable",
    errorNames: ["MissingAPIError", "OpenFailedError", "InvalidStateError"],
  },
];

function readErrorName(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    typeof error.name === "string"
  ) {
    return error.name;
  }
  return null;
}

function readInnerError(error: unknown): unknown {
  if (typeof error === "object" && error !== null && "inner" in error) {
    return error.inner;
  }
  return null;
}

function collectErrorNames(error: unknown, depth: number): readonly string[] {
  const name = readErrorName(error);
  const names = name === null ? [] : [name];
  const inner = readInnerError(error);
  if (depth >= MAX_INNER_ERROR_DEPTH || inner === null || inner === undefined) {
    return names;
  }
  return [...names, ...collectErrorNames(inner, depth + 1)];
}

export function toStorageErrorCode(error: unknown): StorageErrorCode {
  const names = collectErrorNames(error, 0);
  const rule = ERROR_NAME_RULES.find(({ errorNames }) =>
    errorNames.some((errorName) => names.includes(errorName)),
  );
  return rule === undefined ? "unknown" : rule.code;
}

// Logs use this name only, never the message, which may contain user data.
export function getStorageErrorName(error: unknown): string {
  return readErrorName(error) ?? UNKNOWN_ERROR_NAME;
}
