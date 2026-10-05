import { serializeSchemaDocument } from "@schemaforge/core";
import { createSampleSchema } from "@schemaforge/core/testing";
import { screen } from "@testing-library/react";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import type { JSX } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadBlob } from "@/lib/download/download-blob";
import { logger } from "@/lib/logger";
import type { StorageBundle } from "@/lib/storage/create-browser-storage";
import { SchemaforgeDatabase } from "@/lib/storage/database";
import { createSchemaLockManager } from "@/lib/storage/schema-lock-manager";
import { createSchemaRepository } from "@/lib/storage/schema-repository";
import type { SchemaRepository } from "@/lib/storage/schema-repository";
import { createFakeLockRegistry } from "@/testing/fake-lock-registry";
import { renderWithProviders } from "@/testing/render-with-providers";

import { useDownloadSchemaJson } from "./use-download-schema-json";

vi.mock("@/lib/download/download-blob", () => ({
  downloadBlob: vi.fn<(blob: Blob, fileName: string) => void>(),
}));

const SCHEMA_ID = "00000000-0000-4000-8000-000000000001";

function Probe(): JSX.Element {
  const download = useDownloadSchemaJson();

  return (
    <button
      type="button"
      onClick={() => {
        void download(SCHEMA_ID);
      }}
    >
      download
    </button>
  );
}

describe("useDownloadSchemaJson", () => {
  const databases = new Set<SchemaforgeDatabase>();

  afterEach(() => {
    databases.forEach((database) => {
      database.close();
    });
    databases.clear();
    vi.restoreAllMocks();
    vi.mocked(downloadBlob).mockClear();
  });

  function setUp(overrides: Partial<SchemaRepository> = {}): StorageBundle {
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
    return {
      database,
      repository: { ...repository, ...overrides },
      lockManager: createSchemaLockManager(createFakeLockRegistry().request),
    };
  }

  function renderProbe(
    storage: StorageBundle,
  ): ReturnType<typeof renderWithProviders> {
    return renderWithProviders(<Probe />, { locale: "en", auth: { storage } });
  }

  it("downloads the serialized document with its json file name", async () => {
    const storage = setUp();
    const document = { ...createSampleSchema(), name: "Cửa hàng" };
    await storage.repository.createSchema("Cửa hàng");
    await storage.repository.saveDocument(SCHEMA_ID, document);
    const { user } = renderProbe(storage);

    await user.click(await screen.findByRole("button", { name: "download" }));

    await vi.waitFor(() => {
      expect(downloadBlob).toHaveBeenCalledTimes(1);
    });
    const [blob, fileName] = vi.mocked(downloadBlob).mock.calls[0] ?? [];
    expect({
      fileName,
      type: blob?.type,
      text: await blob?.text(),
    }).toEqual({
      fileName: "cua-hang.schemaforge.json",
      type: "application/json",
      text: serializeSchemaDocument(document),
    });
  });

  it("notifies when the schema cannot be read", async () => {
    const { user } = renderProbe(setUp());

    await user.click(await screen.findByRole("button", { name: "download" }));

    expect(
      await screen.findByText("Could not download the file."),
    ).toBeDefined();
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("maps a storage error to a translated toast", async () => {
    vi.spyOn(logger, "error").mockImplementation(() => undefined);
    const quotaError = new Error("The quota was exceeded.");
    quotaError.name = "QuotaExceededError";
    const { user } = renderProbe(
      setUp({
        openSchema: vi
          .fn<SchemaRepository["openSchema"]>()
          .mockRejectedValue(quotaError),
      }),
    );

    await user.click(await screen.findByRole("button", { name: "download" }));

    expect(
      await screen.findByText(
        "Browser storage is full. Delete some schemas and try again.",
      ),
    ).toBeDefined();
    expect(downloadBlob).not.toHaveBeenCalled();
  });
});
