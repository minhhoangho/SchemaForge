import type { Operation } from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeTable,
} from "@schemaforge/core/testing";
import { act, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";
import { renderWithProviders } from "@/testing/render-with-providers";

import { createEditorStore } from "../../state/create-editor-store";
import type { EditorStore } from "../../state/create-editor-store";
import { EditorStoreProvider } from "../../state/editor-store-provider";
import { SchemaNameButton } from "./schema-name-button";

const ADD_EMAIL: Operation = {
  type: "addColumn",
  column: makeColumn({ id: "col_email", tableId: "tbl_users", name: "email" }),
  insertAt: 1,
};

function renderButton() {
  const store: EditorStore = createEditorStore({
    schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    document: buildSchema({
      name: "shop",
      tables: [makeTable({ id: "tbl_users", name: "users" })],
      columns: [makeColumn({ id: "col_id", tableId: "tbl_users", name: "id" })],
    }),
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
  const result = renderWithProviders(
    <EditorStoreProvider store={store}>
      <SchemaNameButton />
    </EditorStoreProvider>,
    { locale: "en" },
  );
  return { ...result, store };
}

function startPreview(store: EditorStore): void {
  act(() => {
    store.getState().startProposalPreview("message-1", ADD_EMAIL);
  });
}

describe("SchemaNameButton", () => {
  it("cannot rename the schema during a preview", () => {
    const { store } = renderButton();

    startPreview(store);

    expect(
      screen
        .getByRole("button", { name: "Schema name shop" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("closes the rename dialog when a preview starts", async () => {
    const { user, store } = renderButton();
    await user.click(screen.getByRole("button", { name: "Schema name shop" }));
    expect(screen.getByRole("dialog", { name: "Rename schema" })).toBeDefined();

    startPreview(store);

    expect(screen.queryByRole("dialog", { name: "Rename schema" })).toBeNull();
  });

  it("renames the schema outside a preview", async () => {
    const { user, store } = renderButton();
    await user.click(screen.getByRole("button", { name: "Schema name shop" }));
    const field = screen.getByRole("textbox", { name: "Schema name" });

    await user.clear(field);
    await user.type(field, "store{Enter}");

    expect(store.getState().document.name).toBe("store");
  });
});
