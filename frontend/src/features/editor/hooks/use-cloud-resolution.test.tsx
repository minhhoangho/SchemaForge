import { CURRENT_SCHEMA_VERSION } from "@schemaforge/core";
import type { SchemaDocument } from "@schemaforge/core";
import { createSampleSchema } from "@schemaforge/core/testing";
import { act, screen, waitFor } from "@testing-library/react";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import type { JSX } from "react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/lib/api/api-client";
import type { ApiClient } from "@/lib/api/api-client";
import { SchemaforgeDatabase } from "@/lib/storage/database";
import { createSchemaRepository } from "@/lib/storage/schema-repository";
import type { SchemaRepository } from "@/lib/storage/schema-repository";
import { renderWithProviders } from "@/testing/render-with-providers";

import type { CloudPusherControls } from "./use-cloud-pusher";
import { useCloudResolution } from "./use-cloud-resolution";
import type { CloudResolution } from "./use-cloud-resolution";

const SCHEMA_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "5f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const CREATED_AT = "2026-09-17T00:00:00.000Z";
const UPDATED_AT = "2026-09-18T00:00:00.000Z";
const LOCAL_DOCUMENT: SchemaDocument = {
  ...createSampleSchema(),
  name: "Local",
};
const CLOUD_DOCUMENT: SchemaDocument = {
  ...createSampleSchema(),
  name: "Cloud",
};

const databases = new Set<SchemaforgeDatabase>();

afterEach(() => {
  toast.dismiss();
  databases.forEach((database) => {
    database.close();
  });
  databases.clear();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function detailResponse(revision: number, document: unknown): Response {
  return jsonResponse({
    id: SCHEMA_ID,
    name: "Cloud",
    revision,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    document,
  });
}

function notFoundResponse(): Response {
  return jsonResponse({ statusCode: 404, code: "not-found" }, 404);
}

type Fixture = {
  readonly repository: SchemaRepository;
  readonly fetchImpl: ReturnType<typeof vi.fn<typeof fetch>>;
  readonly apiClient: ApiClient;
  readonly pusher: CloudPusherControls & {
    readonly resume: ReturnType<typeof vi.fn<() => void>>;
  };
  readonly onReplaceDocument: ReturnType<
    typeof vi.fn<(document: SchemaDocument) => void>
  >;
  readonly navigate: ReturnType<typeof vi.fn<(href: string) => void>>;
};

// An owned schema edited here while the cloud moved on to revision 2.
async function createFixture(
  answers: readonly (() => Promise<Response>)[],
): Promise<Fixture> {
  const database = new SchemaforgeDatabase({
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  });
  databases.add(database);
  const repository = createSchemaRepository({
    database,
    clock: () => 1,
    generateId: () => SCHEMA_ID,
  });
  await repository.createSchema("Local", { ownerId: USER_ID });
  await repository.saveDocument(SCHEMA_ID, LOCAL_DOCUMENT);
  await repository.saveViewport({ schemaId: SCHEMA_ID, x: 1, y: 2, zoom: 1 });
  await repository.setSyncState(SCHEMA_ID, {
    cloudRevision: 1,
    syncStatus: "conflict",
  });
  const queue = [...answers];
  const fetchImpl = vi.fn<typeof fetch>(
    () => queue.shift()?.() ?? Promise.reject(new Error("No answer queued.")),
  );
  return {
    repository,
    fetchImpl,
    apiClient: createApiClient({
      baseUrl: "https://api.schemaforge.invalid",
      fetchImpl,
      sessionRefresher: {
        refresh: () => Promise.resolve({ isOk: true, value: undefined }),
      },
      onSessionExpired: vi.fn<() => void>(),
    }),
    pusher: {
      status: { kind: "conflict" },
      retry: vi.fn<() => void>(),
      resume: vi.fn<() => void>(),
    },
    onReplaceDocument: vi.fn<(document: SchemaDocument) => void>(),
    navigate: vi.fn<(href: string) => void>(),
  };
}

type Captured = { resolution: CloudResolution | null };

type HarnessProps = {
  readonly fixture: Fixture;
  readonly isConflictOpen: boolean;
  readonly captured: Captured;
};

function Harness({
  fixture,
  isConflictOpen,
  captured,
}: HarnessProps): JSX.Element {
  const resolution = useCloudResolution({
    schemaId: SCHEMA_ID,
    isConflictOpen,
    repository: fixture.repository,
    apiClient: fixture.apiClient,
    pusher: fixture.pusher,
    onReplaceDocument: fixture.onReplaceDocument,
    navigate: fixture.navigate,
  });
  captured.resolution = resolution;
  return <span>{`cloud:${resolution.cloudVersion.kind}`}</span>;
}

type Mounted = {
  readonly resolution: () => CloudResolution;
  readonly setConflictOpen: (isConflictOpen: boolean) => void;
};

function mount(fixture: Fixture, isConflictOpen = true): Mounted {
  const captured: Captured = { resolution: null };
  const { rerender } = renderWithProviders(
    <Harness
      fixture={fixture}
      isConflictOpen={isConflictOpen}
      captured={captured}
    />,
    { locale: "en" },
  );
  return {
    resolution: () => {
      if (captured.resolution === null) {
        throw new Error("The hook has not rendered yet.");
      }
      return captured.resolution;
    },
    setConflictOpen: (isOpen) => {
      rerender(
        <Harness
          fixture={fixture}
          isConflictOpen={isOpen}
          captured={captured}
        />,
      );
    },
  };
}

async function mountLoaded(fixture: Fixture): Promise<Mounted> {
  const mounted = mount(fixture);
  await screen.findByText("cloud:loaded");
  return mounted;
}

describe("useCloudResolution", () => {
  it("loads the cloud version when the conflict dialog opens", async () => {
    const fixture = await createFixture([
      () => Promise.resolve(detailResponse(2, CLOUD_DOCUMENT)),
    ]);
    const mounted = mount(fixture, false);
    expect(fixture.fetchImpl).not.toHaveBeenCalled();

    mounted.setConflictOpen(true);

    await screen.findByText("cloud:loaded");
    expect(mounted.resolution().cloudVersion).toEqual({
      kind: "loaded",
      revision: 2,
      document: CLOUD_DOCUMENT,
      summary: {
        updatedAt: Date.parse(UPDATED_AT),
        tableCount: Object.keys(CLOUD_DOCUMENT.tables).length,
        columnCount: Object.keys(CLOUD_DOCUMENT.columns).length,
      },
    });
  });

  it("does not write the cache when the cloud document has an unsupported version", async () => {
    const fixture = await createFixture([
      () =>
        Promise.resolve(
          detailResponse(2, {
            ...CLOUD_DOCUMENT,
            version: CURRENT_SCHEMA_VERSION + 1,
          }),
        ),
    ]);

    mount(fixture);

    await screen.findByText("cloud:version-unsupported");
    expect({
      record: await fixture.repository.readSchemaRecord(SCHEMA_ID),
      opened: await fixture.repository.openSchema(SCHEMA_ID),
    }).toMatchObject({
      record: { cloudRevision: 1, syncStatus: "conflict" },
      opened: { kind: "opened", document: LOCAL_DOCUMENT },
    });
  });

  it("marks the schema deleted-in-cloud when the cloud version returns 404", async () => {
    const fixture = await createFixture([
      () => Promise.resolve(notFoundResponse()),
    ]);

    mount(fixture);

    await waitFor(async () => {
      expect(
        await fixture.repository.readSchemaRecord(SCHEMA_ID),
      ).toMatchObject({ cloudRevision: 1, syncStatus: "deleted-in-cloud" });
    });
  });

  it("reports a failure and loads again on reload when the cloud cannot be reached", async () => {
    const fixture = await createFixture([
      () => Promise.reject(new TypeError("Failed to fetch")),
      () => Promise.resolve(detailResponse(2, CLOUD_DOCUMENT)),
    ]);
    const mounted = mount(fixture);
    await screen.findByText("cloud:failed");
    expect(mounted.resolution().cloudVersion).toEqual({
      kind: "failed",
      failure: { kind: "network" },
    });

    act(() => {
      mounted.resolution().reloadCloudVersion();
    });

    expect(await screen.findByText("cloud:loaded")).toBeDefined();
  });

  it("keepLocal sets the cloud revision and pending status and resumes the pusher", async () => {
    const fixture = await createFixture([
      () => Promise.resolve(detailResponse(2, CLOUD_DOCUMENT)),
    ]);
    const mounted = await mountLoaded(fixture);

    await act(() => mounted.resolution().keepLocal());

    expect({
      record: await fixture.repository.readSchemaRecord(SCHEMA_ID),
      resumeCalls: fixture.pusher.resume.mock.calls.length,
    }).toMatchObject({
      record: { cloudRevision: 2, syncStatus: "pending" },
      resumeCalls: 1,
    });
  });

  it("reloads the cloud version when keepLocal ends in another conflict", async () => {
    const fixture = await createFixture([
      () => Promise.resolve(detailResponse(2, CLOUD_DOCUMENT)),
      () => Promise.resolve(detailResponse(3, CLOUD_DOCUMENT)),
    ]);
    const mounted = await mountLoaded(fixture);
    await act(() => mounted.resolution().keepLocal());

    // The pending status closes the dialog; the pusher's 409 brings the
    // conflict, and with it the dialog, back.
    mounted.setConflictOpen(false);
    mounted.setConflictOpen(true);

    await waitFor(() => {
      expect(mounted.resolution().cloudVersion).toMatchObject({
        kind: "loaded",
        revision: 3,
      });
    });
    expect(fixture.fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("adoptCloudVersion writes the cloud document as synced and replaces the editor document", async () => {
    const fixture = await createFixture([
      () => Promise.resolve(detailResponse(2, CLOUD_DOCUMENT)),
    ]);
    const mounted = await mountLoaded(fixture);

    await act(() => mounted.resolution().adoptCloudVersion());

    expect({
      record: await fixture.repository.readSchemaRecord(SCHEMA_ID),
      opened: await fixture.repository.openSchema(SCHEMA_ID),
      resumeCalls: fixture.pusher.resume.mock.calls.length,
      replacedWith: fixture.onReplaceDocument.mock.calls,
    }).toEqual({
      record: {
        id: SCHEMA_ID,
        name: "Cloud",
        ownerId: USER_ID,
        cloudRevision: 2,
        syncStatus: "synced",
        createdAt: Date.parse(CREATED_AT),
        updatedAt: Date.parse(UPDATED_AT),
      },
      opened: { kind: "opened", document: CLOUD_DOCUMENT },
      resumeCalls: 1,
      replacedWith: [[CLOUD_DOCUMENT]],
    });
    expect(
      await screen.findByText("Switched to the cloud version"),
    ).toBeDefined();
  });

  it("recreateInCloud clears the cloud revision and resumes the pusher", async () => {
    const fixture = await createFixture([]);
    await fixture.repository.setSyncState(SCHEMA_ID, {
      cloudRevision: 1,
      syncStatus: "deleted-in-cloud",
    });
    const mounted = mount(fixture, false);

    await act(() => mounted.resolution().recreateInCloud());

    expect({
      record: await fixture.repository.readSchemaRecord(SCHEMA_ID),
      resumeCalls: fixture.pusher.resume.mock.calls.length,
    }).toMatchObject({
      record: { cloudRevision: null, syncStatus: "pending" },
      resumeCalls: 1,
    });
  });

  it("removeFromBrowser deletes the schema from the three tables and navigates to the list", async () => {
    const fixture = await createFixture([]);
    const mounted = mount(fixture, false);

    await act(() => mounted.resolution().removeFromBrowser());

    expect({
      record: await fixture.repository.readSchemaRecord(SCHEMA_ID),
      opened: await fixture.repository.openSchema(SCHEMA_ID),
      viewport: await fixture.repository.readViewport(SCHEMA_ID),
      navigatedTo: fixture.navigate.mock.calls,
    }).toEqual({
      record: null,
      opened: { kind: "not-found" },
      viewport: null,
      navigatedTo: [["/"]],
    });
  });
});
