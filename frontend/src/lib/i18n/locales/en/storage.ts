import type { StorageErrorCode } from "@/lib/storage/storage-error";

export const enStorage = {
  "quota-exceeded":
    "Browser storage is full. Delete some schemas and try again.",
  unavailable:
    "Your browser does not allow local storage, for example in private mode.",
  "outdated-tab": "SchemaForge was updated in another tab. Reload the page.",
  closed: "The storage connection is closed. Reload the page.",
  unknown: "Could not save. Try again.",
} as const satisfies Record<StorageErrorCode, string>;
