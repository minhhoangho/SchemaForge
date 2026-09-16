import { screen, waitFor } from "@testing-library/react";
import type { JSX } from "react";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { renderWithProviders } from "@/testing/render-with-providers";

import { CreateSchemaDialog } from "./create-schema-dialog";

type DialogHarnessProps = {
  readonly onCreate: (name: string) => Promise<void>;
};

function DialogHarness({ onCreate }: DialogHarnessProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setIsOpen(true);
        }}
      >
        open
      </button>
      <CreateSchemaDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        onCreate={onCreate}
        onReturnFocus={() => {
          triggerRef.current?.focus();
        }}
      />
    </>
  );
}

function renderDialog(
  onCreate = vi.fn<(name: string) => Promise<void>>().mockResolvedValue(),
): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(<DialogHarness onCreate={onCreate} />, {
    locale: "en",
  });
}

describe("CreateSchemaDialog", () => {
  it("focuses the name field when it opens", async () => {
    const { user } = renderDialog();

    await user.click(screen.getByRole("button", { name: "open" }));

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText("Name"));
    });
  });

  it("submits on Enter", async () => {
    const onCreate = vi
      .fn<(name: string) => Promise<void>>()
      .mockResolvedValue();
    const { user } = renderDialog(onCreate);
    await user.click(screen.getByRole("button", { name: "open" }));

    await user.type(screen.getByLabelText("Name"), "  shop  {Enter}");

    expect(onCreate).toHaveBeenCalledWith("shop");
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const { user } = renderDialog();
    const trigger = screen.getByRole("button", { name: "open" });
    await user.click(trigger);
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(document.activeElement).toBe(trigger);
  });

  it("keeps the dialog open and describes the error when the name is blank", async () => {
    const onCreate = vi
      .fn<(name: string) => Promise<void>>()
      .mockResolvedValue();
    const { user } = renderDialog(onCreate);
    await user.click(screen.getByRole("button", { name: "open" }));

    await user.type(screen.getByLabelText("Name"), "   {Enter}");

    const field = screen.getByLabelText("Name");
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("textbox", { description: "Enter a name." })).toBe(
      field,
    );
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("moves focus to the name field when the create button submits a blank name", async () => {
    const { user } = renderDialog();
    await user.click(screen.getByRole("button", { name: "open" }));

    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(document.activeElement).toBe(screen.getByLabelText("Name"));
  });

  it.each(["light", "dark"] as const)(
    "reports no axe violations in the %s theme",
    async (themePreference) => {
      const { user } = renderWithProviders(
        <DialogHarness
          onCreate={vi
            .fn<(name: string) => Promise<void>>()
            .mockResolvedValue()}
        />,
        { themePreference },
      );
      await user.click(screen.getByRole("button", { name: "open" }));

      await expectNoAxeViolations(await screen.findByRole("dialog"));
    },
  );
});
