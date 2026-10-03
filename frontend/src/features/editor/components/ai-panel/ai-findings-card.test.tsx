import type { AiFindingsData } from "@schemaforge/api-contract";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeTable,
} from "@schemaforge/core/testing";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createEditorStore } from "@/features/editor/state/create-editor-store";
import { EditorStoreProvider } from "@/features/editor/state/editor-store-provider";
import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";
import type { ThemePreference } from "@/lib/preferences/preference-cookies";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { renderWithProviders } from "@/testing/render-with-providers";

import { AiFindingsCard } from "./ai-findings-card";
import type { AiFindingsCardProps } from "./ai-findings-card";

type Findings = AiFindingsData["findings"];

const SUGGESTION: Findings[number] = {
  kind: "suggestion",
  category: "index",
  title: "Index the email",
  detail: "Lookups by email are slow.",
  targets: [{ tableId: "tbl_users", columnId: "col_email" }],
};
const ISSUE: Findings[number] = {
  kind: "issue",
  category: "naming",
  title: "Plural names",
  detail: "Mixed naming.",
  targets: [{ tableId: "tbl_users", columnId: null }],
};

function createStore(): ReturnType<typeof createEditorStore> {
  return createEditorStore({
    schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    document: buildSchema({
      name: "shop",
      tables: [makeTable({ id: "tbl_users", name: "users" })],
      columns: [
        makeColumn({ id: "col_email", tableId: "tbl_users", name: "email" }),
      ],
    }),
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
}

function renderCard(
  findings: Findings,
  isDisabled = false,
  themePreference: ThemePreference = "light",
): Pick<AiFindingsCardProps, "onApply" | "onRevealTarget"> &
  ReturnType<typeof renderWithProviders> {
  const handlers = {
    onApply: vi.fn<(message: string) => void>(),
    onRevealTarget: vi.fn<AiFindingsCardProps["onRevealTarget"]>(),
  };
  const rendered = renderWithProviders(
    <EditorStoreProvider store={createStore()}>
      <AiFindingsCard
        findings={findings}
        isDisabled={isDisabled}
        {...handlers}
      />
    </EditorStoreProvider>,
    { locale: "en", themePreference },
  );
  return { ...handlers, ...rendered };
}

describe("AiFindingsCard", () => {
  it("shows the kind, category, title and detail of each finding", () => {
    renderCard([SUGGESTION, ISSUE]);

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Suggestion")).toBeTruthy();
    expect(screen.getByText("Index")).toBeTruthy();
    expect(screen.getByText("Index the email")).toBeTruthy();
    expect(screen.getByText("Lookups by email are slow.")).toBeTruthy();
    expect(screen.getByText("Issue")).toBeTruthy();
    expect(screen.getByText("Naming")).toBeTruthy();
  });

  it("reveals the target table and column", async () => {
    const { user, onRevealTarget } = renderCard([SUGGESTION, ISSUE]);

    await user.click(screen.getByRole("button", { name: "users.email" }));
    await user.click(screen.getByRole("button", { name: "users" }));

    expect(onRevealTarget).toHaveBeenNthCalledWith(1, {
      tableId: "tbl_users",
      columnId: "col_email",
    });
    expect(onRevealTarget).toHaveBeenNthCalledWith(2, {
      tableId: "tbl_users",
      columnId: null,
    });
  });

  it("disables a target that is no longer in the document", () => {
    renderCard([
      { ...SUGGESTION, targets: [{ tableId: "tbl_gone", columnId: null }] },
    ]);

    const unavailable = screen.getByRole("button", {
      name: /This part of the schema no longer exists/,
    });

    expect(unavailable.hasAttribute("disabled")).toBe(true);
  });

  it("sends the apply message for a suggestion", async () => {
    const { user, onApply } = renderCard([SUGGESTION]);

    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(onApply).toHaveBeenCalledWith(
      "Please apply this suggestion: Index the email. Lookups by email are slow.",
    );
  });

  it("sends the fix message for an issue", async () => {
    const { user, onApply } = renderCard([ISSUE]);

    await user.click(screen.getByRole("button", { name: "Fix it for me" }));

    expect(onApply).toHaveBeenCalledWith(
      "Please fix this issue: Plural names. Mixed naming.",
    );
  });

  it("disables apply while a turn is running", () => {
    renderCard([SUGGESTION, ISSUE], true);

    const apply = screen.getByRole("button", { name: "Apply" });
    const fix = screen.getByRole("button", { name: "Fix it for me" });

    expect(apply.hasAttribute("disabled")).toBe(true);
    expect(fix.hasAttribute("disabled")).toBe(true);
  });

  it("renders HTML in a finding as text", () => {
    const { container } = renderCard([
      { ...SUGGESTION, title: "<b>bold</b>", detail: "<img src=x onerror=1>" },
    ]);

    expect(screen.getByText("<b>bold</b>")).toBeTruthy();
    expect(container.querySelector("b, img")).toBeNull();
  });

  it.each(["light", "dark"] as const)(
    "has no axe violations in the %s theme",
    async (theme) => {
      const { container } = renderCard([SUGGESTION, ISSUE], false, theme);

      await expectNoAxeViolations(container);
    },
  );
});
