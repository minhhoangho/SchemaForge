import { serializeSchemaDocument } from "@schemaforge/core";
import type { SchemaDocument } from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeRelation,
  makeTable,
} from "@schemaforge/core/testing";
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { renderWithProviders } from "@/testing/render-with-providers";

import { CanvasNodeControlsProvider } from "../lib/viewport-controls";
import type { CanvasNodeControls } from "../lib/viewport-controls";
import { createEditorStore } from "../state/create-editor-store";
import { EditorStoreProvider } from "../state/editor-store-provider";
import { captureCanvasImage } from "./capture-canvas-image";
import { ExportMenu } from "./export-menu";

const downloadBlob = vi.fn<(blob: Blob, fileName: string) => void>();
const notify = vi.fn<Notify>();
const loggerError = vi.fn<Logger["error"]>();

vi.mock("@/lib/download/download-blob", () => ({
  downloadBlob: (blob: Blob, fileName: string): void => {
    downloadBlob(blob, fileName);
  },
}));
vi.mock("@/lib/logger", () => ({
  logger: {
    error: (event: string, fields?: Parameters<Logger["error"]>[1]): void => {
      loggerError(event, fields);
    },
  },
}));
vi.mock("@/lib/use-notify", () => ({ useNotify: (): Notify => notify }));
vi.mock("./capture-canvas-image", () => ({
  captureCanvasImage: vi.fn<typeof captureCanvasImage>(),
}));

const capture = vi.mocked(captureCanvasImage);
const IMAGE = new Blob(["img"], { type: "image/png" });

function createDocument(): SchemaDocument {
  return buildSchema({
    name: "Shop Orders",
    tables: [makeTable({ id: "tbl_users", name: "users" })],
    columns: [
      makeColumn({ id: "col_users_id", tableId: "tbl_users", name: "id" }),
      makeColumn({ id: "col_users_boss", tableId: "tbl_users", name: "boss" }),
    ],
    relations: [
      makeRelation({
        id: "rel_boss",
        fromTableId: "tbl_users",
        toTableId: "tbl_users",
        columnPairs: [
          { fromColumnId: "col_users_boss", toColumnId: "col_users_id" },
        ],
      }),
    ],
  });
}

function renderMenu(themePreference: "light" | "dark" = "light"): ReturnType<
  typeof renderWithProviders
> & {
  readonly document: SchemaDocument;
} {
  const document = createDocument();
  const store = createEditorStore({
    schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    document,
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
  const controls: CanvasNodeControls = {
    getMeasuredNodes: () => [],
    fitNodes: vi.fn<CanvasNodeControls["fitNodes"]>(),
  };
  const result = renderWithProviders(
    <EditorStoreProvider store={store}>
      <CanvasNodeControlsProvider controls={controls}>
        <div data-export-root="" />
        <ExportMenu />
      </CanvasNodeControlsProvider>
    </EditorStoreProvider>,
    { locale: "en", themePreference },
  );
  return { ...result, document };
}

async function openMenu(
  user: ReturnType<typeof renderWithProviders>["user"],
): Promise<void> {
  await user.click(screen.getByRole("button", { name: "Export" }));
}

beforeEach(() => {
  downloadBlob.mockReset();
  notify.mockReset();
  loggerError.mockReset();
  capture.mockReset();
});

describe("ExportMenu", () => {
  it("lists json, png, svg and zip items", async () => {
    const { user } = renderMenu();
    await openMenu(user);

    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent),
    ).toEqual(["JSON", "PNG image", "SVG image", "ZIP…"]);
    expect(
      screen
        .getByRole("menuitem", { name: "ZIP…" })
        .getAttribute("data-disabled"),
    ).toBeNull();
  });

  it("opens the zip dialog and returns focus to the export button", async () => {
    const { user } = renderMenu();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "ZIP…" }));

    expect(
      await screen.findByRole("dialog", { name: "Download ZIP" }),
    ).toBeDefined();

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Export" }),
    );
  });

  it("downloads the serialized document as json", async () => {
    const { user, document } = renderMenu();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "JSON" }));

    expect(downloadBlob).toHaveBeenCalledOnce();
    const [blob, fileName] = downloadBlob.mock.calls[0] ?? [];
    expect(fileName).toBe("shop-orders.schemaforge.json");
    expect(await blob?.text()).toBe(serializeSchemaDocument(document));
  });

  it("downloads a png of the canvas with the self relation flag", async () => {
    capture.mockResolvedValue({ blob: IMAGE, isScaledDown: false });
    const { user } = renderMenu();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "PNG image" }));

    await waitFor(() => {
      expect(downloadBlob).toHaveBeenCalledWith(IMAGE, "shop-orders.png");
    });
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ format: "png", hasSelfRelation: true }),
    );
    expect(notify).toHaveBeenCalledOnce();
  });

  it("shows a busy item and blocks a second capture while generating", async () => {
    let finish: (value: { blob: Blob; isScaledDown: boolean }) => void = () =>
      undefined;
    capture.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { user } = renderMenu();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "SVG image" }));
    await openMenu(user);

    const busy = await screen.findAllByRole("menuitem", {
      name: "Generating image…",
    });
    expect(busy).toHaveLength(2);
    expect(busy.map((item) => item.getAttribute("data-disabled"))).toEqual([
      "",
      "",
    ]);
    expect(notify).toHaveBeenCalledWith({
      tone: "info",
      titleKey: "importExport:export.generatingImage",
    });
    expect(capture).toHaveBeenCalledOnce();

    finish({ blob: IMAGE, isScaledDown: false });
    await waitFor(() => {
      expect(downloadBlob).toHaveBeenCalledWith(IMAGE, "shop-orders.svg");
    });
  });

  it("suggests svg when the png was scaled down", async () => {
    capture.mockResolvedValue({ blob: IMAGE, isScaledDown: true });
    const { user } = renderMenu();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "PNG image" }));

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith({
        tone: "info",
        titleKey: "importExport:export.imageScaledDown",
      });
    });
    expect(downloadBlob).toHaveBeenCalledOnce();
  });

  it("notifies when the capture fails", async () => {
    capture.mockRejectedValue(new Error("boom"));
    const { user } = renderMenu();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "PNG image" }));

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith({
        tone: "error",
        titleKey: "importExport:export.failed",
      });
    });
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("logs only the error name when the capture fails", async () => {
    capture.mockRejectedValue(new TypeError("secret table name"));
    const { user } = renderMenu();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "PNG image" }));

    await waitFor(() => {
      expect(loggerError).toHaveBeenCalledWith("export.image-failed", {
        errorName: "TypeError",
      });
    });
  });

  it.each(["light", "dark"] as const)(
    "has no axe violations with the menu open in the %s theme",
    async (themePreference) => {
      const { user } = renderMenu(themePreference);
      await openMenu(user);

      await expectNoAxeViolations(document.body);
    },
  );
});
