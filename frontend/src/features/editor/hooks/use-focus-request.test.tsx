import type { DocumentPath } from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
} from "@schemaforge/core/testing";
import { act, render, screen } from "@testing-library/react";
import type { JSX } from "react";
import { describe, expect, it, vi } from "vitest";

import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";

import { createEditorStore } from "../state/create-editor-store";
import type { EditorStore } from "../state/create-editor-store";
import { EditorStoreProvider } from "../state/editor-store-provider";
import { focusFieldByPath, useFocusRequest } from "./use-focus-request";

const NAME_PATH: DocumentPath = ["tables", "tbl_users", "name"];
const COMMENT_PATH: DocumentPath = ["tables", "tbl_users", "comment"];

// Stands in for a panel: each field declares the issue path it edits.
function Fields(): JSX.Element {
  useFocusRequest(focusFieldByPath);

  return (
    <>
      <label>
        Table name
        <input data-focus-path={JSON.stringify(NAME_PATH)} />
      </label>
      <label>
        Table comment
        <textarea data-focus-path={JSON.stringify(COMMENT_PATH)} />
      </label>
    </>
  );
}

function renderFields(): EditorStore {
  const store = createEditorStore({
    schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    document: buildSchema({ name: "shop" }),
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
  render(
    <EditorStoreProvider store={store}>
      <Fields />
    </EditorStoreProvider>,
  );
  return store;
}

describe("useFocusRequest", () => {
  it("focuses the field matching the requested path", () => {
    const store = renderFields();

    act(() => {
      store.getState().requestFocus(COMMENT_PATH);
    });

    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Table comment" }),
    );
  });

  it("clears the focus request afterwards", () => {
    const store = renderFields();

    act(() => {
      store.getState().requestFocus(NAME_PATH);
    });

    expect(store.getState().focusRequest).toBeNull();
  });

  it("does nothing when no field matches", () => {
    const store = renderFields();

    act(() => {
      store.getState().requestFocus(["columns", "col_missing", "name"]);
    });

    expect({
      activeElement: document.activeElement,
      focusRequest: store.getState().focusRequest,
    }).toEqual({ activeElement: document.body, focusRequest: null });
  });
});
