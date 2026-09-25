import type { SchemaDocument } from "@schemaforge/core";
import {
  buildSchema,
  makeColumn,
  makeRelation,
  makeTable,
} from "@schemaforge/core/testing";
import { screen } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { vi } from "vitest";

import { EditorScreen } from "@/features/editor/components/editor-screen";
import { SchemaListScreen } from "@/features/schema-list/components/schema-list-screen";
import type { Locale } from "@/lib/i18n/supported-locales";
import type { StorageBundle } from "@/lib/storage/create-browser-storage";
import { SchemaforgeDatabase } from "@/lib/storage/database";
import { createSchemaLockManager } from "@/lib/storage/schema-lock-manager";
import { createSchemaRepository } from "@/lib/storage/schema-repository";

import { createFakeLockRegistry } from "./fake-lock-registry";
import type { FakeLockRegistry } from "./fake-lock-registry";
import { renderWithProviders } from "./render-with-providers";

type MountOptions = {
  readonly locale?: Locale;
};

type MountedScreen = RenderResult & { readonly user: UserEvent };

export type JourneyEnvironment = {
  readonly storage: StorageBundle;
  readonly database: SchemaforgeDatabase;
  readonly lockRegistry: FakeLockRegistry;
  readonly createSchema: (name: string) => Promise<string>;
  readonly mountEditor: (
    schemaId: string,
    options?: MountOptions,
  ) => MountedScreen;
  readonly mountSchemaList: () => MountedScreen;
};

// Journeys read English text unless a test is about the language itself.
const DEFAULT_JOURNEY_LOCALE = "en" satisfies Locale;
const ID_PREFIX = "00000000-0000-4000-8000-";
const ID_SUFFIX_LENGTH = 12;
const MEASURED_SIZE = { inlineSize: 1000, blockSize: 800 };

function createCounter(): () => number {
  let count = 0;
  return () => {
    count += 1;
    return count;
  };
}

// Every row of a table node adds this much to its simulated height.
const SIMULATED_ROW_HEIGHT = 20;
const LIST_ROW_SELECTOR = "li";

// Journeys mount the whole editor screen and drive it through several
// sequential async interactions (dialogs, drag-and-drop, panel edits), so a
// single test does much more real work than a unit test. Under CPU
// contention from other processes on the same machine, that work is slower
// to get scheduled, which can push a journey past Vitest's default 5s test
// timeout even though every step still succeeds. Unit tests keep that
// default as a safety net against real hangs; only journeys get the extra
// headroom, applied once per file so it is set before any test starts.
const JOURNEY_TEST_TIMEOUT_MS = 20_000;

/**
 * Raises the test timeout for the whole current journey file. Call this at
 * module scope (not inside a `describe` or `it`), so it takes effect before
 * the first test starts.
 */
export function setJourneyTestTimeout(): void {
  vi.setConfig({ testTimeout: JOURNEY_TEST_TIMEOUT_MS });
}

// jsdom has no layout, and setup-tests sizes every element from its inline
// style, so a table node keeps the same height when a column is added. Here
// an element without an inline height grows with its list rows, the way a
// real table node does.
function simulateRowHeights(): void {
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
    function simulatedOffsetHeight(this: HTMLElement): number {
      const inlineHeight = Number.parseFloat(this.style.height);
      return Number.isNaN(inlineHeight)
        ? (this.querySelectorAll(LIST_ROW_SELECTOR).length + 1) *
            SIMULATED_ROW_HEIGHT
        : inlineHeight;
    },
  );
}

// jsdom's ResizeObserver stub never reports, so React Flow would keep every
// node hidden as unmeasured and draw no edge. This one reports an element
// when it is observed and again whenever its content changes, which is when a
// real one would see a new size (a column added to a table node, whose new
// handle an edge then needs).
class MeasuringResizeObserver implements ResizeObserver {
  readonly #callback: ResizeObserverCallback;
  readonly #contentObservers = new Map<Element, MutationObserver>();

  constructor(callback: ResizeObserverCallback) {
    this.#callback = callback;
  }

  observe(target: Element): void {
    this.#report(target);
    if (this.#contentObservers.has(target)) {
      return;
    }
    const contentObserver = new MutationObserver(() => {
      this.#report(target);
    });
    contentObserver.observe(target, { childList: true, subtree: true });
    this.#contentObservers.set(target, contentObserver);
  }

  unobserve(target: Element): void {
    this.#contentObservers.get(target)?.disconnect();
    this.#contentObservers.delete(target);
  }

  disconnect(): void {
    this.#contentObservers.forEach((contentObserver) => {
      contentObserver.disconnect();
    });
    this.#contentObservers.clear();
  }

  #report(target: Element): void {
    this.#callback(
      [
        {
          target,
          contentRect: new DOMRect(
            0,
            0,
            MEASURED_SIZE.inlineSize,
            MEASURED_SIZE.blockSize,
          ),
          borderBoxSize: [MEASURED_SIZE],
          contentBoxSize: [MEASURED_SIZE],
          devicePixelContentBoxSize: [MEASURED_SIZE],
        },
      ],
      this,
    );
  }
}

// The editor screen reports whether it is still opening to its loader's live
// region, which journeys do not render.
function ignoreOpeningChange(): void {
  // Nothing listens for the opening status here.
}

/**
 * Builds one in-memory browser for the journey tests of spec section 14: a
 * real `SchemaRepository` over its own fake IndexedDB, a counter clock, fixed
 * UUIDs, and one fake Web Locks registry shared by every screen it mounts.
 * Each mounted editor takes its own `SchemaLockManager`, the way each tab
 * does, so two editors of one schema compete for the same lock. Every screen
 * mounts under a signed-out AuthProvider that never calls fetch, the way a
 * guest without an auth hint uses the app. "Reloading
 * the page" is `unmount()` followed by mounting again on the same database.
 *
 * Stubs `ResizeObserver` and table node heights for React Flow; the test file
 * restores them with `vi.unstubAllGlobals()` and `vi.restoreAllMocks()`.
 * Test files that mount the schema list also point `Dexie.dependencies` at
 * fake-indexeddb (plan issue 51).
 */
export function createJourneyEnvironment(): JourneyEnvironment {
  vi.stubGlobal("ResizeObserver", MeasuringResizeObserver);
  simulateRowHeights();
  const database = new SchemaforgeDatabase({
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  });
  const lockRegistry = createFakeLockRegistry();
  const nextId = createCounter();
  const repository = createSchemaRepository({
    database,
    clock: createCounter(),
    generateId: () =>
      `${ID_PREFIX}${String(nextId()).padStart(ID_SUFFIX_LENGTH, "0")}`,
  });
  const storage: StorageBundle = {
    database,
    repository,
    lockManager: createSchemaLockManager(lockRegistry.request),
  };

  return {
    storage,
    database,
    lockRegistry,
    createSchema: async (name) => (await repository.createSchema(name)).id,
    mountEditor: (schemaId, options = {}) => {
      const tabStorage: StorageBundle = {
        ...storage,
        lockManager: createSchemaLockManager(lockRegistry.request),
      };
      return renderWithProviders(
        <EditorScreen
          schemaId={schemaId}
          onOpeningChange={ignoreOpeningChange}
        />,
        {
          locale: options.locale ?? DEFAULT_JOURNEY_LOCALE,
          auth: { storage: tabStorage },
        },
      );
    },
    mountSchemaList: () =>
      renderWithProviders(<SchemaListScreen />, {
        locale: DEFAULT_JOURNEY_LOCALE,
        auth: { storage },
      }),
  };
}

export type OpenedJourneyEditor = {
  readonly environment: JourneyEnvironment;
  readonly schemaId: string;
  readonly user: UserEvent;
  readonly unmount: () => void;
};

/**
 * Stores `document` as a new schema in a fresh environment and opens its
 * editor, resolving once the toolbar shows the schema name.
 */
export async function openJourneyEditor(
  document: SchemaDocument,
): Promise<OpenedJourneyEditor> {
  const environment = createJourneyEnvironment();
  const schemaId = await environment.createSchema(document.name);
  await environment.storage.repository.saveDocument(schemaId, document);
  const { user, unmount } = environment.mountEditor(schemaId);
  await screen.findByRole("button", { name: `Schema name ${document.name}` });
  return { environment, schemaId, user, unmount };
}

const SHOP_NAME = "shop";

/** "users" and "orders", each with an `id` primary key and no relation yet. */
export function createShopDocument(): SchemaDocument {
  return buildSchema({
    name: SHOP_NAME,
    tables: [
      makeTable({
        id: "tbl_users",
        name: "users",
        position: { x: 0, y: 0 },
        primaryKeyColumnIds: ["col_users_id"],
      }),
      makeTable({
        id: "tbl_orders",
        name: "orders",
        position: { x: 400, y: 0 },
        primaryKeyColumnIds: ["col_orders_id"],
      }),
    ],
    columns: [
      makeColumn({ id: "col_users_id", tableId: "tbl_users", name: "id" }),
      makeColumn({ id: "col_orders_id", tableId: "tbl_orders", name: "id" }),
    ],
  });
}

/** The shop with "orders.user_id" already pointing at "users.id". */
export function createRelatedShopDocument(): SchemaDocument {
  const shop = createShopDocument();
  return buildSchema({
    name: shop.name,
    tables: Object.values(shop.tables),
    columns: [
      ...Object.values(shop.columns),
      makeColumn({
        id: "col_orders_user_id",
        tableId: "tbl_orders",
        name: "user_id",
      }),
    ],
    relations: [
      makeRelation({
        id: "rel_orders_users",
        fromTableId: "tbl_orders",
        toTableId: "tbl_users",
        columnPairs: [
          { fromColumnId: "col_orders_user_id", toColumnId: "col_users_id" },
        ],
      }),
    ],
  });
}
