import type { SchemaDocument } from "@schemaforge/core";
import {
  parseSeedDataset,
  serializeSeedDataset,
} from "@schemaforge/core/generators/seed";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeTable,
  unwrapOk,
} from "@schemaforge/core/testing";
import { screen, waitFor, within } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";
import type { ThemePreference } from "@/lib/preferences/preference-cookies";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { renderWithProviders } from "@/testing/render-with-providers";

import { createEditorStore } from "../../state/create-editor-store";
import type { EditorStore } from "../../state/create-editor-store";
import { EditorStoreProvider } from "../../state/editor-store-provider";
import { AiSampleDataCard } from "./ai-sample-data-card";

type Format = "postgresql" | "mysql" | "sqlserver" | "json";
const FORMATS: readonly Format[] = ["postgresql", "mysql", "sqlserver", "json"];
const FORMAT_LABELS: Record<Format, string> = {
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  sqlserver: "SQL Server",
  json: "JSON",
};

const OUTDATED_TEXT =
  "The schema changed after this data was generated. Generate it again.";

function createDocument(): SchemaDocument {
  return buildSchema({
    name: "shop",
    tables: [
      makeTable({
        id: "tbl_users",
        name: "users",
        primaryKeyColumnIds: ["col_users_id"],
      }),
      makeTable({
        id: "tbl_tags",
        name: "tags",
        primaryKeyColumnIds: ["col_tags_id"],
      }),
    ],
    columns: [
      makeColumn({
        id: "col_users_id",
        tableId: "tbl_users",
        name: "id",
        type: { kind: "text" },
      }),
      makeColumn({
        id: "col_users_name",
        tableId: "tbl_users",
        name: "name",
        type: { kind: "text" },
        isNullable: true,
      }),
      makeColumn({
        id: "col_tags_id",
        tableId: "tbl_tags",
        name: "id",
        type: { kind: "text" },
      }),
    ],
  });
}

const DATASET = {
  tables: [
    {
      tableId: "tbl_tags",
      rows: [{ col_tags_id: "t1" }, { col_tags_id: "t2" }],
    },
    {
      tableId: "tbl_users",
      rows: [
        { col_users_id: "u1", col_users_name: "Ann" },
        { col_users_id: "u2", col_users_name: null },
      ],
    },
  ],
};

const ADVERSARIAL_VALUES = [
  "O'Brien",
  "C:\\temp\\",
  "x'); SELECT 1;--",
  'line1\nline2 with "quotes"',
];

const ADVERSARIAL_DATASET = {
  tables: [
    {
      tableId: "tbl_users",
      rows: ADVERSARIAL_VALUES.map((value, index) => ({
        col_users_id: `u${String(index)}`,
        col_users_name: value,
      })),
    },
  ],
};

type Harness = RenderResult & {
  readonly user: UserEvent;
  readonly store: EditorStore;
  readonly onRetry: () => void;
};

function renderCard(
  dataset: unknown,
  themePreference: ThemePreference = "light",
): Harness {
  const store = createEditorStore({
    schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    document: createDocument(),
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
  const onRetry = vi.fn();
  const result = renderWithProviders(
    <EditorStoreProvider store={store}>
      <AiSampleDataCard dataset={dataset} onRetry={onRetry} />
    </EditorStoreProvider>,
    { locale: "en", themePreference },
  );
  return { ...result, store, onRetry };
}

async function selectFormat(user: UserEvent, format: Format): Promise<void> {
  await user.click(screen.getByRole("combobox", { name: "Format" }));
  await user.click(
    await screen.findByRole("option", { name: FORMAT_LABELS[format] }),
  );
}

function expectedContent(
  store: EditorStore,
  dataset: unknown,
  format: Format,
): string {
  return serializeSeedDataset(
    store.getState().document,
    unwrapOk(parseSeedDataset(dataset)),
    format,
  ).content;
}

afterEach(() => {
  toast.dismiss();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("AiSampleDataCard", () => {
  it("shows one tab per table in load order with a captioned data table", async () => {
    renderCard(DATASET);

    const tabs = await screen.findAllByRole("tab");

    expect(tabs.map((tab) => tab.textContent)).toEqual([
      expect.stringContaining("tags"),
      expect.stringContaining("users"),
    ]);
    expect(tabs[0]?.textContent).toContain("2 rows");
    expect(
      screen.getByRole("table", { name: "Sample rows for table tags" }),
    ).toBeDefined();
  });

  it("uses column headers with scope col", async () => {
    const { user } = renderCard(DATASET);

    await user.click(await screen.findByRole("tab", { name: /users/ }));

    const headers = screen.getAllByRole("columnheader");
    expect(headers.map((header) => header.textContent)).toEqual(["id", "name"]);
    expect(
      headers.every((header) => header.getAttribute("scope") === "col"),
    ).toBe(true);
  });

  it("shows NULL for a null value and renders HTML in a value as text", async () => {
    renderCard({
      tables: [
        {
          tableId: "tbl_users",
          rows: [
            {
              col_users_id: "u1",
              col_users_name: "<img src=x onerror=alert(1)>",
            },
            { col_users_id: "u2", col_users_name: null },
          ],
        },
      ],
    });

    await screen.findByRole("tab");

    expect(screen.getByText("NULL")).toBeDefined();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeDefined();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("shows the outdated message with retry when the dataset no longer matches the document", async () => {
    const { store, user, onRetry } = renderCard(DATASET);
    await screen.findByRole("tab", { name: /users/ });

    store
      .getState()
      .replaceDocument(buildSchema({ name: "shop", tables: [], columns: [] }));

    expect(await screen.findByText(OUTDATED_TEXT)).toBeDefined();
    expect(screen.queryByRole("tab")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Generate again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows the outdated message for a dataset of the wrong shape", async () => {
    renderCard({ tables: "nope" });

    expect(await screen.findByText(OUTDATED_TEXT)).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Generate again" }),
    ).toBeDefined();
  });

  it("never shows seed issue codes", async () => {
    const { container } = renderCard({
      tables: [{ tableId: "tbl_users", rows: [{ col_users_id: 5 }] }],
    });

    await screen.findByText(OUTDATED_TEXT);

    expect(container.textContent).not.toMatch(/seed-|invalid-shape|tables\.0/);
  });

  it.each(FORMATS)(
    "copies the dataset in the chosen format %s",
    async (format) => {
      const { user, store } = renderCard(DATASET);
      await screen.findByRole("tab", { name: /users/ });
      if (format !== "postgresql") {
        await selectFormat(user, format);
      }

      await user.click(screen.getByRole("button", { name: "Copy" }));

      expect(await navigator.clipboard.readText()).toBe(
        expectedContent(store, DATASET, format),
      );
      expect(await screen.findByText("Copied to the clipboard")).toBeDefined();
    },
  );

  it.each(FORMATS)(
    "escapes adversarial AI values in copied SQL for every dialect %s",
    async (format) => {
      const { user, store } = renderCard(ADVERSARIAL_DATASET);
      await screen.findByRole("tab");
      if (format !== "postgresql") {
        await selectFormat(user, format);
      }

      await user.click(screen.getByRole("button", { name: "Copy" }));

      const copied = await navigator.clipboard.readText();
      expect(copied).toBe(expectedContent(store, ADVERSARIAL_DATASET, format));
      expect(copied).not.toContain("'O'Brien'");
      expect(copied).not.toContain("'x');");
      if (format === "json") {
        expect(JSON.stringify(JSON.parse(copied))).toContain(
          JSON.stringify(ADVERSARIAL_VALUES[3]).slice(1, -1),
        );
        expect(copied).toContain("x'); SELECT 1;--");
      }
    },
  );

  it("shows an error toast when the clipboard is denied", async () => {
    const { user } = renderCard(DATASET);
    await screen.findByRole("tab", { name: /users/ });
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new DOMException("denied", "NotAllowedError"),
    );

    await user.click(screen.getByRole("button", { name: "Copy" }));

    expect(
      await screen.findByText("Could not copy to the clipboard"),
    ).toBeDefined();
  });

  it("downloads a file named after the generated file", async () => {
    const { user } = renderCard(DATASET);
    await screen.findByRole("tab", { name: /users/ });
    const createObjectURL = vi.fn(() => "blob:sample");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal(
      "URL",
      Object.assign(URL, { createObjectURL, revokeObjectURL }),
    );
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download);
    });

    await user.click(screen.getByRole("button", { name: "Download" }));

    expect(downloads).toEqual(["seed.sql"]);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:sample");

    await selectFormat(user, "json");
    await user.click(screen.getByRole("button", { name: "Download" }));

    expect(downloads).toEqual(["seed.sql", "seed.json"]);
  });

  it("shows the SQL review reminder above the copy and download buttons", async () => {
    renderCard(DATASET);
    await screen.findByRole("tab", { name: /users/ });

    const reminder = screen.getByText(/Read the SQL before you run it/);
    const copy = screen.getByRole("button", { name: "Copy" });
    const download = screen.getByRole("button", { name: "Download" });

    expect(
      reminder.compareDocumentPosition(copy) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      reminder.compareDocumentPosition(download) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("scrolls the table inside a labelled focusable region", async () => {
    renderCard(DATASET);

    const region = await screen.findByRole("region", {
      name: "Sample rows for table tags",
    });

    expect(region.tabIndex).toBe(0);
    expect(region.getAttribute("aria-label")).toBeNull();
    expect(screen.getByRole("group", { name: "Sample data" })).toBeDefined();
    expect(within(region).getByRole("table")).toBeDefined();
  });

  it.each(["light", "dark"] as const)(
    "has no axe violations with valid data in the %s theme",
    async (theme) => {
      const { container } = renderCard(DATASET, theme);
      await screen.findByRole("tab", { name: /users/ });
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Copy" })).toBeDefined();
      });

      await expectNoAxeViolations(container);
    },
  );

  it("has no axe violations when the data is outdated", async () => {
    const { container } = renderCard({ tables: "nope" });
    await screen.findByText(OUTDATED_TEXT);

    await expectNoAxeViolations(container);
  });
});
