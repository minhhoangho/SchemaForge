// Prints a self-running JavaScript snippet that writes the standard large
// schema into the app's IndexedDB, for measuring the editor by hand in Chrome
// DevTools (spec section 13, "Cách đo tay"). It only writes to stdout.
import type * as LargeSchemaModule from "../src/testing/large-schema";

// Node runs this file without a bundler, so it needs the ".ts" extension that
// tsc rejects in a static import (no allowImportingTsExtensions). A dynamic
// import of a computed URL works for both, and the guard below restores the
// module's types.
const LARGE_SCHEMA_MODULE_URL = new URL(
  "../src/testing/large-schema.ts",
  import.meta.url,
);

// Must match DATABASE_NAME and the store names in src/lib/storage/database.ts.
const DATABASE_NAME = "schemaforge";
const SCHEMAS_STORE = "schemas";
const DOCUMENTS_STORE = "documents";
// A fixed, lowercase UUID, so pasting the snippet again replaces the same
// schema instead of adding another one.
const SCHEMA_ID = "00000000-0000-4000-8000-00000000f0f0";

function isLargeSchemaModule(
  value: unknown,
): value is typeof LargeSchemaModule {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "makeLargeSchema") === "function" &&
    typeof Reflect.get(value, "STANDARD_LARGE_SCHEMA") === "object"
  );
}

const loadedModule: unknown = await import(LARGE_SCHEMA_MODULE_URL.href);
if (!isLargeSchemaModule(loadedModule)) {
  throw new Error("src/testing/large-schema.ts does not export the fixture.");
}
const document = loadedModule.makeLargeSchema(
  loadedModule.STANDARD_LARGE_SCHEMA,
);

const snippet = `(() => {
  const DATABASE_NAME = ${JSON.stringify(DATABASE_NAME)};
  const SCHEMA_ID = ${JSON.stringify(SCHEMA_ID)};
  const documentValue = ${JSON.stringify(document)};
  const request = indexedDB.open(DATABASE_NAME);
  request.onupgradeneeded = () => {
    request.transaction.abort();
    console.error("SchemaForge database not found. Open the schema list page once, then paste this snippet again.");
  };
  request.onerror = () => {
    if (request.error?.name !== "AbortError") {
      console.error("Could not open the SchemaForge database.", request.error);
    }
  };
  request.onsuccess = () => {
    const database = request.result;
    const now = Date.now();
    const transaction = database.transaction([${JSON.stringify(SCHEMAS_STORE)}, ${JSON.stringify(DOCUMENTS_STORE)}], "readwrite");
    transaction.objectStore(${JSON.stringify(SCHEMAS_STORE)}).put({ id: SCHEMA_ID, name: documentValue.name, createdAt: now, updatedAt: now });
    transaction.objectStore(${JSON.stringify(DOCUMENTS_STORE)}).put({ schemaId: SCHEMA_ID, document: documentValue });
    transaction.oncomplete = () => {
      database.close();
      console.info("Large schema saved (id " + SCHEMA_ID + "). Reload the page, then open it from the schema list.");
    };
    transaction.onerror = () => {
      database.close();
      console.error("Could not save the large schema.", transaction.error);
    };
  };
})();
`;

process.stdout.write(snippet);
