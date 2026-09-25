import { buildSchema } from "@schemaforge/core/testing";
import { screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getOutline,
  getOutlineRow,
  readDocument,
} from "@/testing/journey-queries";
import {
  openJourneyEditor,
  setJourneyTestTimeout,
} from "@/testing/mount-editor-journey";
import type { OpenedJourneyEditor } from "@/testing/mount-editor-journey";

setJourneyTestTimeout();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
  }),
}));

const DUPLICATE_NAME_MESSAGE =
  "Another table or enum is already named “users”.";

function openEditor(): Promise<OpenedJourneyEditor> {
  return openJourneyEditor(buildSchema({ name: "shop" }));
}

function getColumnGroup(columnName: string): HTMLElement {
  return within(
    screen.getByRole("complementary", { name: "Properties" }),
  ).getByRole("group", { name: columnName });
}

async function addTable(user: UserEvent): Promise<void> {
  await user.click(
    within(screen.getByRole("banner")).getByRole("button", {
      name: "Add table",
    }),
  );
}

// Adding a table selects it and focuses its name field.
async function addTableNamed(user: UserEvent, name: string): Promise<void> {
  await addTable(user);
  const nameField = screen.getByRole("textbox", { name: "Table name" });
  await user.clear(nameField);
  await user.type(nameField, `${name}{Enter}`);
}

async function addColumnNamed(user: UserEvent, name: string): Promise<void> {
  await user.click(screen.getByRole("button", { name: "Add column" }));
  // The new column is the last one, and its name field has focus.
  const nameField = screen
    .getAllByRole("textbox", { name: "Column name" })
    .at(-1);
  if (nameField === undefined) {
    throw new Error("The table has no column name field.");
  }
  await user.clear(nameField);
  await user.type(nameField, `${name}{Enter}`);
}

async function pickColumnType(
  user: UserEvent,
  columnName: string,
  optionName: string,
): Promise<void> {
  await user.click(
    within(getColumnGroup(columnName)).getByRole("button", {
      name: new RegExp(`^Type of column ${columnName} `),
    }),
  );
  await user.click(await screen.findByRole("option", { name: optionName }));
}

afterEach(() => {
  // Sonner keeps its toasts in module state, which outlives each render.
  toast.dismiss();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("schema and columns journey", () => {
  it("adds two tables and edits a column through the panel", async () => {
    const { environment, schemaId, user } = await openEditor();

    await addTable(user);
    await addTableNamed(user, "users");
    await addColumnNamed(user, "nickname");
    await pickColumnType(user, "nickname", "text");
    await user.click(
      within(getColumnGroup("nickname")).getByRole("checkbox", {
        name: "Nullable",
      }),
    );
    await user.click(
      within(getColumnGroup("nickname")).getByRole("button", {
        name: "Details",
      }),
    );
    await user.click(screen.getByRole("radio", { name: "Value" }));
    await user.type(
      screen.getByRole("textbox", { name: "Literal default value" }),
      "guest{Enter}",
    );

    await waitFor(async () => {
      const document = await readDocument(environment, schemaId);
      expect({
        tables: Object.values(document.tables)
          .map((table) => table.name)
          .toSorted(),
        column: Object.values(document.columns).find(
          (column) => column.name === "nickname",
        ),
      }).toMatchObject({
        tables: ["table_1", "users"],
        column: {
          type: { kind: "text" },
          isNullable: true,
          defaultValue: { kind: "literal", value: "guest" },
        },
      });
    });
  });

  it("keeps the schema after the screen is mounted again", async () => {
    const { environment, schemaId, user, unmount } = await openEditor();
    await addTableNamed(user, "users");
    await addColumnNamed(user, "email");
    await waitFor(async () => {
      const document = await readDocument(environment, schemaId);
      expect(Object.values(document.columns)).toHaveLength(2);
    });

    unmount();
    environment.mountEditor(schemaId);

    expect(
      await screen.findByRole("group", { name: "Table users, 2 columns" }),
    ).toBeDefined();
    expect(getOutlineRow("users")).toBeDefined();
  });

  it("creates a unique index over two columns", async () => {
    const { environment, schemaId, user } = await openEditor();
    await addTableNamed(user, "users");
    await addColumnNamed(user, "email");

    await user.click(screen.getByRole("button", { name: "Add index" }));
    const indexes = screen.getByRole("region", { name: "Indexes" });
    await user.click(within(indexes).getByRole("checkbox", { name: "Unique" }));
    await user.click(
      within(indexes).getByRole("combobox", { name: "Add index column" }),
    );
    await user.click(await screen.findByRole("option", { name: "email" }));

    await waitFor(async () => {
      const document = await readDocument(environment, schemaId);
      const columnNames = Object.values(document.indexes).map((index) =>
        index.columnIds.map((columnId) => document.columns[columnId]?.name),
      );
      expect({
        columnNames,
        isUnique: Object.values(document.indexes).map(
          (index) => index.isUnique,
        ),
      }).toEqual({ columnNames: [["id", "email"]], isUnique: [true] });
    });
  });

  it("uses an enum as a column type", async () => {
    const { environment, schemaId, user } = await openEditor();
    await addTableNamed(user, "users");
    await addColumnNamed(user, "status");
    await user.click(
      within(screen.getByRole("banner")).getByRole("button", {
        name: "Add enum",
      }),
    );
    await user.click(screen.getByRole("tab", { name: "Tables" }));
    await user.click(getOutlineRow("users"));

    await pickColumnType(user, "status", "enum_1");

    expect(
      within(getColumnGroup("status")).getByRole("button", {
        name: "Type of column status enum_1",
      }),
    ).toBeDefined();
    await waitFor(async () => {
      const document = await readDocument(environment, schemaId);
      const [enumeration] = Object.values(document.enums);
      expect(
        Object.values(document.columns).find(
          (column) => column.name === "status",
        )?.type,
      ).toEqual({ kind: "enum", enumId: enumeration?.id });
    });
  });

  it("stores a comment on a table and a column", async () => {
    const { environment, schemaId, user } = await openEditor();
    await addTableNamed(user, "users");
    await addColumnNamed(user, "email");

    await user.type(
      screen.getByRole("textbox", { name: "Table comment" }),
      "People who sign in",
    );
    await user.click(
      within(getColumnGroup("email")).getByRole("button", {
        name: "Details",
      }),
    );
    await user.type(
      screen.getByRole("textbox", { name: "Column comment" }),
      "Used to sign in",
    );
    await user.tab();

    expect(
      screen.getByRole("img", { name: "Comment: People who sign in" }),
    ).toBeDefined();
    await waitFor(async () => {
      const document = await readDocument(environment, schemaId);
      expect({
        tableComments: Object.values(document.tables).map(
          (table) => table.comment,
        ),
        emailComment: Object.values(document.columns).find(
          (column) => column.name === "email",
        )?.comment,
      }).toEqual({
        tableComments: ["People who sign in"],
        emailComment: "Used to sign in",
      });
    });
  });

  it("shows a duplicate table name issue on both nodes and in the issues tab", async () => {
    const { user } = await openEditor();
    await addTableNamed(user, "users");
    await addTableNamed(user, "users");

    await user.click(screen.getByRole("tab", { name: "Issues (2)" }));

    expect({
      nodeBadges: screen
        .getAllByRole("group", { name: /^Table users, / })
        .map(
          (node) =>
            within(node).getAllByRole("img", { name: "1 issue" }).length,
        ),
      issueRowCount: within(getOutline()).getAllByRole("button", {
        name: `Go to: ${DUPLICATE_NAME_MESSAGE}`,
      }).length,
    }).toEqual({ nodeBadges: [1, 1], issueRowCount: 2 });
  });

  it("clears the issue after the name is fixed", async () => {
    const { user } = await openEditor();
    await addTableNamed(user, "users");
    await addTableNamed(user, "users");
    await user.click(screen.getByRole("tab", { name: "Issues (2)" }));

    const nameField = screen.getByRole("textbox", { name: "Table name" });
    await user.clear(nameField);
    await user.type(nameField, "accounts{Enter}");

    expect({
      issuesTab: screen.getByRole("tab", { name: "Issues (0)" }).ariaSelected,
      hasEmptyMessage: within(getOutline()).getByText("No issues").isConnected,
      badges: screen.queryAllByRole("img", { name: /issue/ }),
    }).toEqual({ issuesTab: "true", hasEmptyMessage: true, badges: [] });
  });
});
