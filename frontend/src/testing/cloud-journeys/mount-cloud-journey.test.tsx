import { screen } from "@testing-library/react";
import { Dexie } from "dexie";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { toast } from "sonner";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  clearJourneyCookies,
  createCloudJourneyEnvironment,
  setJourneyTestTimeout,
} from "./mount-cloud-journey";

setJourneyTestTimeout();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn<(href: string) => void>(),
    replace: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
  }),
  usePathname: () => "/",
}));

const EMAIL = "user@example.com";
const PASSWORD = "stapler-42";
const RETRY_DELAY_MS = 2_000;

beforeAll(() => {
  // liveQuery skips every query while Dexie finds no global IndexedDB, and
  // jsdom has none; each environment still opens its own factory.
  Dexie.dependencies.indexedDB = new IDBFactory();
  Dexie.dependencies.IDBKeyRange = IDBKeyRange;
});

afterEach(() => {
  // Sonner keeps its toasts in module state, which outlives each render.
  toast.dismiss();
  clearJourneyCookies();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("createCloudJourneyEnvironment", () => {
  it("mounts the schema list signed out without calling fetch", async () => {
    const environment = createCloudJourneyEnvironment();

    environment.mountSchemaList();
    await screen.findByText("No schemas yet");

    expect({
      scopedCalls: environment.fetchSpy.mock.calls.length,
      globalCalls: environment.globalFetchSpy.mock.calls.length,
    }).toEqual({ scopedCalls: 0, globalCalls: 0 });
  });

  it("mounts the schema list signed in when the hint is present", async () => {
    const environment = createCloudJourneyEnvironment();
    const userId = environment.backend.seedUser({
      email: EMAIL,
      password: PASSWORD,
    });
    environment.backend.signInAs(userId);
    environment.setAuthHint(true);

    environment.mountSchemaList();

    expect(
      await screen.findByRole("button", { name: `Account ${EMAIL}` }),
    ).toBeDefined();
  });

  it("runs due retries only when the scheduler is advanced", () => {
    const environment = createCloudJourneyEnvironment();
    const run = vi.fn<() => void>();

    environment.scheduler.schedule(RETRY_DELAY_MS, run);
    const callsBefore = run.mock.calls.length;
    environment.scheduler.runDue();

    expect({ callsBefore, callsAfter: run.mock.calls.length }).toEqual({
      callsBefore: 0,
      callsAfter: 1,
    });
  });
});
