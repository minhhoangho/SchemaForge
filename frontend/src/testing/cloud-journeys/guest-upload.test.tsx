import { screen, waitFor, within } from "@testing-library/react";
import { Dexie } from "dexie";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { toast } from "sonner";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  clearJourneyCookies,
  createCloudJourneyEnvironment,
  setJourneyTestTimeout,
} from "./mount-cloud-journey";
import type { CloudJourneyEnvironment } from "./mount-cloud-journey";

setJourneyTestTimeout();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn<(href: string) => void>(),
    replace: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
  }),
  usePathname: () => "/sign-in",
}));

const EMAIL = "user@example.com";
const PASSWORD = "stapler-42";
const UPLOAD_DIALOG_TITLE = "Save the schemas on this browser to your account?";

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

type UploadedJourney = {
  readonly environment: CloudJourneyEnvironment;
  readonly shopId: string;
  readonly blogId: string;
  readonly unmountSignIn: () => void;
};

/**
 * Two guest schemas, a sign-in with the seeded account, then the prompt with
 * "blog" unselected and "shop" saved to the cloud.
 */
async function signInAndUploadShopOnly(): Promise<UploadedJourney> {
  const environment = createCloudJourneyEnvironment();
  const shopId = await environment.createGuestSchema("shop");
  const blogId = await environment.createGuestSchema("blog");
  environment.backend.seedUser({ email: EMAIL, password: PASSWORD });
  const signIn = environment.mountSignIn();

  await signIn.user.type(screen.getByLabelText("Email"), EMAIL);
  await signIn.user.type(screen.getByLabelText("Password"), PASSWORD);
  await signIn.user.click(screen.getByRole("button", { name: "Sign in" }));

  const dialog = await screen.findByRole("dialog", {
    name: UPLOAD_DIALOG_TITLE,
  });
  await signIn.user.click(
    within(dialog).getByRole("checkbox", { name: "blog" }),
  );
  await signIn.user.click(
    within(dialog).getByRole("button", { name: "Save to cloud" }),
  );
  await waitFor(() => {
    expect(
      screen.queryByRole("dialog", { name: UPLOAD_DIALOG_TITLE }),
    ).toBeNull();
  });

  return { environment, shopId, blogId, unmountSignIn: signIn.unmount };
}

describe("guest upload journey", () => {
  it("asks to upload guest schemas after signing in and uploads only the selected one", async () => {
    const { environment, shopId, blogId } = await signInAndUploadShopOnly();

    expect({
      shop: environment.backend.getStoredSchema(shopId)?.revision ?? null,
      blog: environment.backend.getStoredSchema(blogId),
      blogOwnerId: (
        await environment.storage.repository.readSchemaRecord(blogId)
      )?.ownerId,
    }).toEqual({ shop: 1, blog: null, blogOwnerId: null });
  });

  it("keeps the unselected schema in this browser only section", async () => {
    const { environment, unmountSignIn } = await signInAndUploadShopOnly();
    unmountSignIn();

    environment.mountSchemaList();
    const owned = await screen.findByRole("region", { name: "Your schemas" });
    const guest = await screen.findByRole("region", {
      name: "Only on this browser",
    });

    expect({
      owned: within(owned).getByRole("link", { name: "shop" }).textContent,
      guest: within(guest).getByRole("link", { name: "blog" }).textContent,
    }).toEqual({ owned: "shop", guest: "blog" });
  });
});
