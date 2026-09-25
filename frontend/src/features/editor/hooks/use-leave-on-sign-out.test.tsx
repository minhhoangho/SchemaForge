import { act, screen } from "@testing-library/react";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import type { JSX } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/components/auth-provider";
import type { StorageBundle } from "@/lib/storage/create-browser-storage";
import { SchemaforgeDatabase } from "@/lib/storage/database";
import { createSchemaLockManager } from "@/lib/storage/schema-lock-manager";
import { createSchemaRepository } from "@/lib/storage/schema-repository";
import { createFakeLockRegistry } from "@/testing/fake-lock-registry";
import { renderWithProviders } from "@/testing/render-with-providers";

import type { EditorCloudContext } from "./use-open-schema";
import { useLeaveOnSignOut } from "./use-leave-on-sign-out";

const replace = vi.fn<(href: string) => void>();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

const USER_ID = "5f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const OWNED: EditorCloudContext = {
  kind: "owned",
  userId: USER_ID,
  followUp: "none",
  pendingDialog: null,
};
const GUEST: EditorCloudContext = { kind: "guest" };

// Stands in for the auth BroadcastChannel so a test can play the message
// another tab posts when it signs out.
class FakeBroadcastChannel extends EventTarget {
  postMessage(): void {
    // Messages from this tab never come back to it.
  }

  close(): void {
    // Nothing to release.
  }
}

const databases = new Set<SchemaforgeDatabase>();

afterEach(() => {
  databases.forEach((database) => {
    database.close();
  });
  databases.clear();
  replace.mockReset();
});

function createStorage(): StorageBundle {
  const database = new SchemaforgeDatabase({
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  });
  databases.add(database);
  return {
    database,
    lockManager: createSchemaLockManager(createFakeLockRegistry().request),
    repository: createSchemaRepository({
      database,
      clock: () => 1,
      generateId: () => USER_ID,
    }),
  };
}

function signedInFetch(): typeof fetch {
  return vi.fn<typeof fetch>().mockImplementation(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          user: {
            id: USER_ID,
            email: "user@example.com",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ),
  );
}

type ProbeProps = { readonly cloud: EditorCloudContext | null };

function Probe({ cloud }: ProbeProps): JSX.Element {
  useLeaveOnSignOut({ cloud });
  const status = useAuth((state) => state.auth.status);

  return <p>{`status:${status}`}</p>;
}

async function renderSignedIn(
  cloud: EditorCloudContext,
): Promise<FakeBroadcastChannel> {
  const channel = new FakeBroadcastChannel();
  renderWithProviders(<Probe cloud={cloud} />, {
    auth: {
      storage: createStorage(),
      hasAuthHint: true,
      dependencies: {
        fetchImpl: signedInFetch(),
        cookieJar: { cookie: "sf-auth-hint=1" },
        openChannel: () => channel,
      },
    },
  });
  await screen.findByText("status:signed-in");
  return channel;
}

function signOutInOtherTab(channel: FakeBroadcastChannel): void {
  act(() => {
    channel.dispatchEvent(
      new MessageEvent("message", { data: { type: "signed-out" } }),
    );
  });
}

describe("useLeaveOnSignOut", () => {
  it("navigates to the list when an owned schema is open and auth becomes signed-out", async () => {
    const channel = await renderSignedIn(OWNED);

    signOutInOtherTab(channel);

    await screen.findByText("status:signed-out");
    expect(replace.mock.calls).toEqual([["/"]]);
  });

  it("stays for a guest schema", async () => {
    const channel = await renderSignedIn(GUEST);

    signOutInOtherTab(channel);

    await screen.findByText("status:signed-out");
    expect(replace).not.toHaveBeenCalled();
  });
});
