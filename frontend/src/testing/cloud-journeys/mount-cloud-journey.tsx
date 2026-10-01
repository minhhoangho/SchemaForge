import type { RenderResult } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import type { ReactNode } from "react";
import { vi } from "vitest";
import type { Mock } from "vitest";

import { BackgroundSyncHost } from "@/components/background-sync-host";
import { UploadPromptHost } from "@/components/upload-prompt-host";
import { SignInScreen } from "@/features/auth/components/sign-in-screen";
import { EditorScreen } from "@/features/editor/components/editor-screen";
import { RetrySchedulerContext } from "@/features/editor/hooks/use-cloud-pusher";
import { SchemaListScreen } from "@/features/schema-list/components/schema-list-screen";
import { createAuthHintCookie } from "@/lib/auth/auth-hint-cookie";
import type { BroadcastChannelLike } from "@/lib/auth/auth-channel";
import type { StorageBundle } from "@/lib/storage/create-browser-storage";
import type { SchemaforgeDatabase } from "@/lib/storage/database";
import { createSchemaLockManager } from "@/lib/storage/schema-lock-manager";
import type { RetryScheduler } from "@/lib/sync/retry-scheduler";

import { createFakeApiBackend } from "../fake-api-backend";
import type { FakeApiBackend } from "../fake-api-backend";
import { createFakeAuthLockManager } from "../fake-auth-lock-manager";
import { createFakeLockRegistry } from "../fake-lock-registry";
import { createJourneyEnvironment } from "../mount-editor-journey";
import { renderWithProviders } from "../render-with-providers";

export { setJourneyTestTimeout } from "../mount-editor-journey";

type MountedScreen = RenderResult & { readonly user: UserEvent };

/**
 * A retry scheduler nothing advances on its own: `runDue` runs every timer the
 * code under test has asked for and not cancelled, which is the only way a
 * cloud journey lets a retry happen.
 */
export type ManualScheduler = RetryScheduler & {
  readonly runDue: () => void;
};

export type CloudJourneyEnvironment = {
  readonly backend: FakeApiBackend;
  readonly storage: StorageBundle;
  readonly database: SchemaforgeDatabase;
  readonly scheduler: ManualScheduler;
  /** Wraps backend.fetch, so a journey can count the API client's requests. */
  readonly fetchSpy: Mock<typeof fetch>;
  /**
   * The throwing stub installed on the global `fetch`. Reading `globalThis.fetch`
   * is lint-banned outside src/lib/api/, so a journey counts its calls here.
   */
  readonly globalFetchSpy: Mock<typeof fetch>;
  readonly setAuthHint: (isPresent: boolean) => void;
  readonly createGuestSchema: (name: string) => Promise<string>;
  readonly mountSchemaList: () => MountedScreen;
  readonly mountEditor: (schemaId: string) => MountedScreen;
  readonly mountSignIn: (returnTo?: string) => MountedScreen;
};

const JOURNEY_LOCALE = "en";
const DEFAULT_RETURN_TO = "/";

function createCounter(): () => number {
  let count = 0;
  return () => {
    count += 1;
    return count;
  };
}

type PendingRetry = { readonly run: () => void; isCancelled: boolean };

function createManualScheduler(): ManualScheduler {
  let pending: PendingRetry[] = [];
  return {
    schedule: (_delayMs, run) => {
      const entry: PendingRetry = { run, isCancelled: false };
      pending.push(entry);
      return () => {
        entry.isCancelled = true;
      };
    },
    runDue: () => {
      const due = pending;
      pending = [];
      due.forEach((entry) => {
        if (!entry.isCancelled) {
          entry.run();
        }
      });
    },
  };
}

// One in-memory channel group per environment, so every screen it mounts sees
// what the others post, the way two tabs of one browser do.
class SharedFakeChannel extends EventTarget implements BroadcastChannelLike {
  readonly #peers: Set<SharedFakeChannel>;

  constructor(peers: Set<SharedFakeChannel>) {
    super();
    this.#peers = peers;
    peers.add(this);
  }

  postMessage(message: unknown): void {
    this.#peers.forEach((peer) => {
      if (peer !== this) {
        peer.dispatchEvent(new MessageEvent("message", { data: message }));
      }
    });
  }

  close(): void {
    this.#peers.delete(this);
  }
}

// The editor screen reports whether it is still opening to its loader's live
// region, which journeys do not render.
function ignoreOpeningChange(): void {
  // Nothing listens for the opening status here.
}

function rejectGlobalFetch(): never {
  throw new Error(
    "A cloud journey must not call fetch outside the API client.",
  );
}

/**
 * Expires every cookie of the document, so the auth hint one test wrote does
 * not decide what the next test mounts. Test files call it in `afterEach`.
 */
export function clearJourneyCookies(): void {
  document.cookie.split(";").forEach((entry) => {
    const name = entry.split("=")[0]?.trim() ?? "";
    if (name !== "") {
      document.cookie = `${name}=; Path=/; Max-Age=0`;
    }
  });
}

/**
 * One in-memory browser plus one in-memory backend for the cloud journeys of
 * spec section 11: the real storage, auth store, API client, upload prompt and
 * background sync of part 4, with `fetch` reaching only `createFakeApiBackend`.
 * Each mount wraps the screen in the provider tree `AppProviders` builds, by
 * way of `renderWithProviders` (which mounts the same providers in the same
 * order) plus the two hosts and the retry-scheduler context `AppProviders` and
 * the editor supply; `AppProviders` itself is not used because it would build
 * browser storage and a real API client from the environment.
 *
 * The global `fetch` is stubbed with a spy that throws, so a request made
 * outside the API client fails the test. Storage, Web Locks, React Flow
 * measuring and node heights come from `createJourneyEnvironment`; the test
 * file restores the stubs with `vi.unstubAllGlobals()` and
 * `vi.restoreAllMocks()`, points `Dexie.dependencies` at fake-indexeddb, and
 * clears the cookies with `clearJourneyCookies()`.
 */
export function createCloudJourneyEnvironment(): CloudJourneyEnvironment {
  const base = createJourneyEnvironment();
  const globalFetchSpy = vi.fn<typeof fetch>(rejectGlobalFetch);
  vi.stubGlobal("fetch", globalFetchSpy);
  const backend = createFakeApiBackend({ clock: createCounter() });
  const fetchSpy = vi.fn<typeof fetch>(backend.fetch);
  const scheduler = createManualScheduler();
  const channels = new Set<SharedFakeChannel>();
  const authLockRegistry = createFakeLockRegistry();
  const hintCookie = createAuthHintCookie({
    cookieJar: document,
    isSecure: false,
  });

  function mount(screen: ReactNode, storage: StorageBundle): MountedScreen {
    return renderWithProviders(
      <RetrySchedulerContext value={scheduler}>
        {screen}
        <UploadPromptHost />
        <BackgroundSyncHost />
      </RetrySchedulerContext>,
      {
        locale: JOURNEY_LOCALE,
        auth: {
          storage,
          hasAuthHint: hintCookie.isPresent(),
          dependencies: {
            fetchImpl: fetchSpy,
            authLockManager:
              createFakeAuthLockManager(authLockRegistry).lockManager,
            openChannel: (): BroadcastChannelLike =>
              new SharedFakeChannel(channels),
            cookieJar: document,
          },
        },
      },
    );
  }

  return {
    backend,
    storage: base.storage,
    database: base.database,
    scheduler,
    fetchSpy,
    globalFetchSpy,
    setAuthHint: (isPresent) => {
      if (isPresent) {
        hintCookie.write();
        return;
      }
      hintCookie.clear();
    },
    createGuestSchema: (name) => base.createSchema(name),
    mountSchemaList: () => mount(<SchemaListScreen />, base.storage),
    mountEditor: (schemaId) =>
      // Each tab takes its own schema lock manager, as each real tab does.
      mount(
        <EditorScreen
          schemaId={schemaId}
          onOpeningChange={ignoreOpeningChange}
        />,
        {
          ...base.storage,
          lockManager: createSchemaLockManager(base.lockRegistry.request),
        },
      ),
    mountSignIn: (returnTo = DEFAULT_RETURN_TO) =>
      mount(<SignInScreen returnTo={returnTo} />, base.storage),
  };
}
