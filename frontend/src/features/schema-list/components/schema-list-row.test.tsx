import { screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import type { SchemaActionTarget } from "@/features/schema-list/hooks/use-schema-actions";
import type { SchemaListEntry } from "@/lib/storage/schema-repository";
import type { MergedSchemaRow } from "@/lib/sync/merge-schema-list";
import { renderWithProviders } from "@/testing/render-with-providers";

import { SchemaListRow } from "./schema-list-row";

const SCHEMA_ID = "00000000-0000-4000-8000-000000000001";

type RowCallback = (
  target: SchemaActionTarget,
  trigger: HTMLElement | null,
) => void;

function guestEntry(): SchemaListEntry {
  return {
    kind: "readable",
    schema: {
      id: SCHEMA_ID,
      name: "shop",
      createdAt: 1,
      updatedAt: 1,
      ownerId: null,
      cloudRevision: null,
      syncStatus: null,
    },
  };
}

function cloudRow(): MergedSchemaRow {
  return {
    id: SCHEMA_ID,
    name: "shop",
    updatedAt: 1,
    source: "cloud",
    label: "not-downloaded",
  };
}

function renderRow(row: ReactElement): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(<ul>{row}</ul>, { locale: "en" });
}

async function openMenu(user: UserEvent, name: string): Promise<string[]> {
  await user.click(screen.getByRole("button", { name: `Actions for ${name}` }));
  const items = await screen.findAllByRole("menuitem");
  return items.map((item) => item.textContent);
}

const noop = vi.fn<RowCallback>();

describe("SchemaListRow", () => {
  it("offers Save to cloud for a guest schema", async () => {
    const { user } = renderRow(
      <SchemaListRow
        kind="guest"
        entry={guestEntry()}
        onRename={noop}
        onDelete={noop}
        onUploadToCloud={noop}
      />,
    );

    expect(await openMenu(user, "shop")).toEqual([
      "Open",
      "Rename",
      "Save to cloud",
      "Delete",
    ]);
  });

  it("does not offer Save to cloud for a cloud schema", async () => {
    const { user } = renderRow(
      <SchemaListRow
        kind="owned"
        row={cloudRow()}
        onRename={noop}
        onDelete={noop}
      />,
    );

    expect(await openMenu(user, "shop")).toEqual(["Open", "Rename", "Delete"]);
  });

  it("offers only Delete for an unreadable schema", async () => {
    const { user } = renderRow(
      <SchemaListRow
        kind="guest"
        entry={{ kind: "unreadable", schemaId: SCHEMA_ID }}
        onRename={noop}
        onDelete={noop}
        onUploadToCloud={noop}
      />,
    );

    expect(await openMenu(user, "Unreadable schema")).toEqual(["Delete"]);
  });

  it("targets a cloud-only schema by its source", async () => {
    const onRename = vi.fn<RowCallback>();
    const { user } = renderRow(
      <SchemaListRow
        kind="owned"
        row={cloudRow()}
        onRename={onRename}
        onDelete={noop}
      />,
    );

    await openMenu(user, "shop");
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));

    expect(onRename).toHaveBeenCalledWith(
      { id: SCHEMA_ID, name: "shop", source: "cloud-only" },
      screen.getByRole("button", { name: "Actions for shop" }),
    );
  });

  it("saves to cloud once focus is back on the row menu", async () => {
    const focusedAtCall: (Element | null)[] = [];
    const onUploadToCloud = vi.fn<RowCallback>(() => {
      focusedAtCall.push(document.activeElement);
    });
    const { user } = renderRow(
      <SchemaListRow
        kind="guest"
        entry={guestEntry()}
        onRename={noop}
        onDelete={noop}
        onUploadToCloud={onUploadToCloud}
      />,
    );

    await openMenu(user, "shop");
    await user.click(screen.getByRole("menuitem", { name: "Save to cloud" }));

    const trigger = screen.getByRole("button", { name: "Actions for shop" });
    expect({
      target: onUploadToCloud.mock.calls[0]?.[0],
      focused: focusedAtCall,
    }).toEqual({
      target: { id: SCHEMA_ID, name: "shop", source: "guest" },
      focused: [trigger],
    });
  });
});
