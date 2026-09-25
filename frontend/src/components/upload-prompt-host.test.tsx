import { act, screen, waitFor } from "@testing-library/react";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import type { JSX } from "react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BroadcastChannelLike } from "@/lib/auth/auth-channel";
import { logger } from "@/lib/logger";
import type { StorageBundle } from "@/lib/storage/create-browser-storage";
import { SchemaforgeDatabase } from "@/lib/storage/database";
import { createSchemaLockManager } from "@/lib/storage/schema-lock-manager";
import { createSchemaRepository } from "@/lib/storage/schema-repository";
import { StorageProvider } from "@/lib/storage/storage-context";
import { createFakeAuthLockManager } from "@/testing/fake-auth-lock-manager";
import { createFakeLockRegistry } from "@/testing/fake-lock-registry";
import { renderWithProviders } from "@/testing/render-with-providers";

import { AuthProvider, useAuth } from "./auth-provider";
import { UploadPromptHost } from "./upload-prompt-host";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const EMAIL = "user@example.com";
const PASSWORD = "hunter22";
const HINT_COOKIE = "sf-auth-hint=1";
const ID_PREFIX = "00000000-0000-4000-8000-";
const TIMESTAMP = "2026-09-18T00:00:00.000Z";

type CreateHandler = (schemaId: string) => Response;
type FetchStub = ReturnType<typeof vi.fn<typeof fetch>>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function userResponse(): Response {
  return jsonResponse({
    user: { id: USER_ID, email: EMAIL, createdAt: TIMESTAMP },
  });
}

function errorResponse(status: number, code: string): Response {
  return jsonResponse({ statusCode: status, code }, status);
}

function createdResponse(schemaId: string): Response {
  return jsonResponse(
    {
      id: schemaId,
      name: "Uploaded",
      revision: 1,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    },
    201,
  );
}

function requestPath(input: RequestInfo | URL): string {
  if (!(input instanceof URL)) {
    throw new Error("Expected the API client to call fetch with a URL.");
  }
  return input.pathname;
}

function readCreatedId(init: RequestInit | undefined): string {
  const body: unknown =
    typeof init?.body === "string" ? JSON.parse(init.body) : null;
  if (
    typeof body !== "object" ||
    body === null ||
    !("id" in body) ||
    typeof body.id !== "string"
  ) {
    throw new Error("Expected a create request with an id.");
  }
  return body.id;
}

function createFetchStub(onCreate: CreateHandler): FetchStub {
  return vi.fn<typeof fetch>((input, init) => {
    const route = `${init?.method ?? "GET"} ${requestPath(input)}`;
    switch (route) {
      case "GET /auth/me":
      case "POST /auth/login":
        return Promise.resolve(userResponse());
      case "POST /schemas":
        return Promise.resolve(onCreate(readCreatedId(init)));
      default:
        return Promise.resolve(errorResponse(404, "not-found"));
    }
  });
}

// Stand-in for BroadcastChannel: tests deliver another tab's message by
// dispatching it here.
class FakeBroadcastChannel extends EventTarget {
  postMessage(): void {
    // A tab never receives its own messages.
  }

  close(): void {
    // Nothing to tear down.
  }
}

function createCounter(): () => number {
  let count = 0;
  return () => {
    count += 1;
    return count;
  };
}

type Fixture = {
  readonly storage: StorageBundle;
  readonly fetchImpl: FetchStub;
  readonly channel: FakeBroadcastChannel;
  readonly dependencies: Parameters<typeof AuthProvider>[0]["dependencies"];
};

const databases = new Set<SchemaforgeDatabase>();

afterEach(() => {
  // Sonner keeps its toasts in module state, which outlives each render.
  toast.dismiss();
  databases.forEach((database) => {
    database.close();
  });
  databases.clear();
  vi.restoreAllMocks();
});

function setUp(input: {
  readonly cookie?: string;
  readonly onCreate?: CreateHandler;
}): Fixture {
  const database = new SchemaforgeDatabase({
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  });
  databases.add(database);
  const nextId = createCounter();
  const channel = new FakeBroadcastChannel();
  const fetchImpl = createFetchStub(input.onCreate ?? createdResponse);
  return {
    fetchImpl,
    channel,
    storage: {
      database,
      lockManager: createSchemaLockManager(createFakeLockRegistry().request),
      repository: createSchemaRepository({
        database,
        clock: createCounter(),
        generateId: () => `${ID_PREFIX}${String(nextId()).padStart(12, "0")}`,
      }),
    },
    dependencies: {
      fetchImpl,
      authLockManager: createFakeAuthLockManager().lockManager,
      openChannel: (): BroadcastChannelLike => channel,
      cookieJar: { cookie: input.cookie ?? "" },
    },
  };
}

function SignInProbe(): JSX.Element {
  const status = useAuth((state) => state.auth.status);
  const signIn = useAuth((state) => state.signIn);

  return (
    <div>
      <p>{`status:${status}`}</p>
      <button
        type="button"
        onClick={() => {
          void signIn({ email: EMAIL, password: PASSWORD });
        }}
      >
        sign in
      </button>
    </div>
  );
}

function renderHost(fixture: Fixture): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <StorageProvider storage={fixture.storage}>
      <AuthProvider hasAuthHint={false} dependencies={fixture.dependencies}>
        <SignInProbe />
        <UploadPromptHost />
      </AuthProvider>
    </StorageProvider>,
    { locale: "en" },
  );
}

async function signInAndOpen(
  fixture: Fixture,
): Promise<ReturnType<typeof renderHost>> {
  const rendered = renderHost(fixture);
  await screen.findByText("status:signed-out");
  await rendered.user.click(screen.getByRole("button", { name: "sign in" }));
  await screen.findByRole("dialog");
  return rendered;
}

function deliverFromOtherTab(
  fixture: Fixture,
  type: "signed-in" | "signed-out",
): void {
  act(() => {
    fixture.channel.dispatchEvent(
      new MessageEvent("message", { data: { type } }),
    );
  });
}

function countSchemaRequests(fetchImpl: FetchStub): number {
  return fetchImpl.mock.calls.filter(
    ([input]) => requestPath(input) === "/schemas",
  ).length;
}

async function readOwnerId(
  fixture: Fixture,
  schemaId: string,
): Promise<string | null | undefined> {
  const record = await fixture.storage.repository.readSchemaRecord(schemaId);
  return record?.ownerId;
}

describe("UploadPromptHost", () => {
  it("opens after an active sign-in when readable guest schemas exist", async () => {
    const fixture = setUp({});
    await fixture.storage.repository.createSchema("Shop");
    await fixture.storage.repository.createSchema("Owned", {
      ownerId: USER_ID,
    });

    await signInAndOpen(fixture);

    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(screen.getByRole("checkbox", { name: "Shop" })).toBeDefined();
  });

  it("does not open on initialize or on a signed-in message from another tab", async () => {
    const fixture = setUp({ cookie: HINT_COOKIE });
    await fixture.storage.repository.createSchema("Shop");
    const listSpy = vi.spyOn(fixture.storage.repository, "listSchemas");
    renderHost(fixture);
    await screen.findByText("status:signed-in");

    deliverFromOtherTab(fixture, "signed-in");
    await waitFor(() => {
      expect(fixture.fetchImpl).toHaveBeenCalledTimes(2);
    });

    expect(listSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not open when there are no guest schemas", async () => {
    const fixture = setUp({});
    await fixture.storage.repository.createSchema("Owned", {
      ownerId: USER_ID,
    });
    const listSpy = vi.spyOn(fixture.storage.repository, "listSchemas");
    const { user } = renderHost(fixture);
    await screen.findByText("status:signed-out");

    await user.click(screen.getByRole("button", { name: "sign in" }));
    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledOnce();
    });
    await listSpy.mock.results[0]?.value;

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not call fetch when Later is pressed", async () => {
    const fixture = setUp({});
    const guest = await fixture.storage.repository.createSchema("Shop");
    const { user } = await signInAndOpen(fixture);
    const callsBefore = fixture.fetchImpl.mock.calls.length;

    await user.click(screen.getByRole("button", { name: "Later" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(fixture.fetchImpl).toHaveBeenCalledTimes(callsBefore);
    expect(await readOwnerId(fixture, guest.id)).toBeNull();
  });

  it("uploads the selected schemas and shows the uploaded count", async () => {
    const fixture = setUp({});
    const shop = await fixture.storage.repository.createSchema("Shop");
    const blog = await fixture.storage.repository.createSchema("Blog");
    const { user } = await signInAndOpen(fixture);

    await user.click(screen.getByRole("button", { name: "Save to cloud" }));

    expect(
      await screen.findByText("Saved 2 schemas to the cloud"),
    ).toBeDefined();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      await Promise.all([
        readOwnerId(fixture, shop.id),
        readOwnerId(fixture, blog.id),
      ]),
    ).toEqual([USER_ID, USER_ID]);
  });

  it("shows the count of schemas that could not be uploaded", async () => {
    const fixture = setUp({
      onCreate: (schemaId) =>
        schemaId.endsWith("1")
          ? createdResponse(schemaId)
          : errorResponse(413, "payload-too-large"),
    });
    await fixture.storage.repository.createSchema("Shop");
    await fixture.storage.repository.createSchema("Blog");
    const { user } = await signInAndOpen(fixture);

    await user.click(screen.getByRole("button", { name: "Save to cloud" }));

    expect(
      await screen.findByText("Saved 1 schema to the cloud"),
    ).toBeDefined();
    expect(screen.getByText("1 schema could not be saved")).toBeDefined();
  });

  it("shows a not-uploaded toast when the only selected schema stops the run", async () => {
    const fixture = setUp({
      onCreate: () => errorResponse(403, "schema-limit-reached"),
    });
    await fixture.storage.repository.createSchema("Shop");
    const { user } = await signInAndOpen(fixture);

    await user.click(screen.getByRole("button", { name: "Save to cloud" }));

    expect(
      await screen.findByText("1 schema could not be saved"),
    ).toBeDefined();
    expect(screen.queryByText(/^Saved/)).toBeNull();
  });

  it("keeps unselected schemas as guest schemas", async () => {
    const fixture = setUp({});
    const shop = await fixture.storage.repository.createSchema("Shop");
    const blog = await fixture.storage.repository.createSchema("Blog");
    const { user } = await signInAndOpen(fixture);

    await user.click(screen.getByRole("checkbox", { name: "Blog" }));
    await user.click(screen.getByRole("button", { name: "Save to cloud" }));
    await screen.findByText("Saved 1 schema to the cloud");

    expect(countSchemaRequests(fixture.fetchImpl)).toBe(1);
    expect(
      await Promise.all([
        readOwnerId(fixture, shop.id),
        readOwnerId(fixture, blog.id),
      ]),
    ).toEqual([USER_ID, null]);
  });

  it("closes when auth leaves signed-in", async () => {
    const fixture = setUp({});
    await fixture.storage.repository.createSchema("Shop");
    await signInAndOpen(fixture);

    deliverFromOtherTab(fixture, "signed-out");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("does not open after a passive sign-in when a listing outlived the previous session", async () => {
    const fixture = setUp({});
    await fixture.storage.repository.createSchema("Shop");
    const repository = fixture.storage.repository;
    const listAll = repository.listSchemas;
    let releaseListing = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      releaseListing = resolve;
    });
    const listSpy = vi
      .spyOn(repository, "listSchemas")
      .mockImplementation(async () => {
        await gate;
        return listAll();
      });
    const { user } = renderHost(fixture);
    await screen.findByText("status:signed-out");
    await user.click(screen.getByRole("button", { name: "sign in" }));
    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledOnce();
    });
    deliverFromOtherTab(fixture, "signed-out");
    await screen.findByText("status:signed-out");
    releaseListing();
    await act(async () => {
      await listSpy.mock.results[0]?.value;
    });

    deliverFromOtherTab(fixture, "signed-in");
    await screen.findByText("status:signed-in");

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("logs a failed listing by error name only", async () => {
    const fixture = setUp({});
    const logError = vi.spyOn(logger, "error").mockReturnValue(undefined);
    vi.spyOn(fixture.storage.repository, "listSchemas").mockRejectedValue(
      new TypeError("The cache could not be read."),
    );
    const { user } = renderHost(fixture);
    await screen.findByText("status:signed-out");

    await user.click(screen.getByRole("button", { name: "sign in" }));

    await waitFor(() => {
      expect(logError).toHaveBeenCalledWith("sync.upload-prompt-list-failed", {
        name: "TypeError",
      });
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("logs a failed upload by error name only and closes the dialog", async () => {
    const fixture = setUp({});
    await fixture.storage.repository.createSchema("Shop");
    const logError = vi.spyOn(logger, "error").mockReturnValue(undefined);
    const { user } = await signInAndOpen(fixture);
    vi.spyOn(fixture.storage.repository, "readSchemaRecord").mockRejectedValue(
      new TypeError("The cache could not be read."),
    );

    await user.click(screen.getByRole("button", { name: "Save to cloud" }));

    await waitFor(() => {
      expect(logError).toHaveBeenCalledWith("sync.upload-failed", {
        name: "TypeError",
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });
});
