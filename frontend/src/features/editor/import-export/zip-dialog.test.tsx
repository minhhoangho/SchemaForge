import type { SchemaDocument } from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeTable,
} from "@schemaforge/core/testing";
import { act, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { renderWithProviders } from "@/testing/render-with-providers";

import type {
  BuildZipRequest,
  BuildZipResponse,
} from "../code-generator/worker-protocol";
import { CanvasNodeControlsProvider } from "../lib/viewport-controls";
import type { CanvasNodeControls } from "../lib/viewport-controls";
import { createEditorStore } from "../state/create-editor-store";
import { EditorStoreProvider } from "../state/editor-store-provider";
import { ZipDialog } from "./zip-dialog";

const downloadBlob = vi.fn<(blob: Blob, fileName: string) => void>();
const notify = vi.fn<Notify>();

vi.mock("@/lib/download/download-blob", () => ({
  downloadBlob: (blob: Blob, fileName: string): void => {
    downloadBlob(blob, fileName);
  },
}));
vi.mock("@/lib/use-notify", () => ({ useNotify: (): Notify => notify }));

class FakeWorker extends EventTarget implements Worker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly terminate = vi.fn();
  readonly postMessage = vi.fn((request: BuildZipRequest): void => {
    this.lastRequest = request;
  });
  lastRequest: BuildZipRequest | null = null;

  reply(response: BuildZipResponse): void {
    act(() => {
      this.onmessage?.(new MessageEvent("message", { data: response }));
    });
  }
}

const VALID_DOCUMENT: SchemaDocument = buildSchema({
  name: "Shop Orders",
  tables: [makeTable({ id: "tbl_users", name: "users" })],
  columns: [makeColumn({ id: "col_users_id", tableId: "tbl_users" })],
});

// Both tables report `table-name-duplicate`.
const INVALID_DOCUMENT: SchemaDocument = buildSchema({
  name: "Shop Orders",
  tables: [
    makeTable({ id: "tbl_users", name: "users" }),
    makeTable({ id: "tbl_people", name: "users" }),
  ],
  columns: [
    makeColumn({ id: "col_users_id", tableId: "tbl_users" }),
    makeColumn({ id: "col_people_id", tableId: "tbl_people" }),
  ],
});

function renderDialog(
  document: SchemaDocument = VALID_DOCUMENT,
  themePreference: "light" | "dark" = "light",
) {
  const store = createEditorStore({
    schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    document,
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
  const worker = new FakeWorker();
  const controls: CanvasNodeControls = {
    getMeasuredNodes: () => [],
    fitNodes: vi.fn<CanvasNodeControls["fitNodes"]>(),
  };
  const result = renderWithProviders(
    <EditorStoreProvider store={store}>
      <CanvasNodeControlsProvider controls={controls}>
        <ZipDialog open onOpenChange={vi.fn()} createWorker={() => worker} />
      </CanvasNodeControlsProvider>
    </EditorStoreProvider>,
    { locale: "en", themePreference },
  );
  return { ...result, store, worker };
}

beforeEach(() => {
  downloadBlob.mockReset();
  notify.mockReset();
});

describe("ZipDialog", () => {
  it("selects all and clears all", async () => {
    const { user } = renderDialog();
    expect(screen.getByText("1 file")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Select all" }));
    expect(screen.getByText("15 files")).toBeDefined();
    expect(
      screen.getByRole("combobox", { name: "Prisma provider" }),
    ).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(screen.getByText("0 files")).toBeDefined();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("disables download when nothing is selected", async () => {
    const { user } = renderDialog();
    expect(
      screen.getByRole("button", { name: "Download" }).hasAttribute("disabled"),
    ).toBe(false);

    await user.click(screen.getByRole("checkbox", { name: "JSON" }));

    expect(
      screen.getByRole("button", { name: "Download" }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("shows the file count and diagnostic summary", async () => {
    const { user, worker } = renderDialog();
    await user.click(screen.getByRole("checkbox", { name: "PostgreSQL" }));
    expect(screen.getByText("2 files")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Download" }));
    expect(screen.getByText("Generating…", { selector: "p" })).toBeDefined();
    worker.reply({
      requestId: worker.lastRequest?.requestId ?? 0,
      kind: "zip",
      bytes: new Uint8Array([1]),
      diagnosticCount: 4,
    });

    expect(
      await screen.findByText("2 files, 4 notes about the output"),
    ).toBeDefined();
  });

  it("warns when the schema has issues", () => {
    renderDialog(INVALID_DOCUMENT);

    expect(
      screen.getByText(
        "The schema has 2 issues, so the generated files may be incomplete or invalid.",
      ),
    ).toBeDefined();
  });

  it("does not warn when the schema is valid", () => {
    renderDialog();

    expect(screen.queryByText(/The schema has/)).toBeNull();
  });

  it("downloads the zip with its file name", async () => {
    const { user, worker } = renderDialog();
    await user.click(screen.getByRole("button", { name: "Download" }));
    worker.reply({
      requestId: worker.lastRequest?.requestId ?? 0,
      kind: "zip",
      bytes: new Uint8Array([80, 75]),
      diagnosticCount: 0,
    });

    await waitFor(() => {
      expect(downloadBlob).toHaveBeenCalledOnce();
    });
    const [blob, fileName] = downloadBlob.mock.calls[0] ?? [];
    expect(fileName).toBe("shop-orders.zip");
    expect(blob?.type).toBe("application/zip");
  });

  it("notifies when the zip cannot be built", async () => {
    const { user, worker } = renderDialog();
    await user.click(screen.getByRole("button", { name: "Download" }));
    worker.reply({
      requestId: worker.lastRequest?.requestId ?? 0,
      kind: "zip-failed",
    });

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith({
        tone: "error",
        titleKey: "importExport:export.failed",
      });
    });
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("changes the prisma provider used for the request", async () => {
    const { user, worker } = renderDialog();
    await user.click(screen.getByRole("checkbox", { name: "Prisma" }));
    await user.click(screen.getByRole("combobox", { name: "Prisma provider" }));
    await user.click(screen.getByRole("option", { name: "MySQL" }));
    await user.click(screen.getByRole("button", { name: "Download" }));

    expect(worker.lastRequest?.generators).toStrictEqual([
      { target: "prisma", options: { provider: "mysql" } },
    ]);
  });

  it.each(["light", "dark"] as const)(
    "has no axe violations in the %s theme",
    async (themePreference) => {
      const { user } = renderDialog(INVALID_DOCUMENT, themePreference);
      await user.click(screen.getByRole("button", { name: "Select all" }));

      await expectNoAxeViolations(document.body);
    },
  );
});
