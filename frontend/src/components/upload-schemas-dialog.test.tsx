import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ThemePreference } from "@/lib/preferences/preference-cookies";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { renderWithProviders } from "@/testing/render-with-providers";

import { UploadSchemasDialog } from "./upload-schemas-dialog";
import type {
  UploadCandidate,
  UploadSchemasDialogProps,
} from "./upload-schemas-dialog";

const CANDIDATES: readonly UploadCandidate[] = [
  { id: "11111111-1111-4111-8111-000000000001", name: "Shop" },
  { id: "11111111-1111-4111-8111-000000000002", name: "Blog" },
  { id: "11111111-1111-4111-8111-000000000003", name: "Crm" },
];

function renderDialog(
  overrides: Partial<UploadSchemasDialogProps> = {},
  themePreference: ThemePreference = "light",
): ReturnType<typeof renderWithProviders> & {
  readonly onUpload: ReturnType<typeof vi.fn>;
  readonly onLater: ReturnType<typeof vi.fn>;
} {
  const onUpload = vi.fn();
  const onLater = vi.fn();
  const result = renderWithProviders(
    <UploadSchemasDialog
      isOpen
      candidates={CANDIDATES}
      isUploading={false}
      onUpload={onUpload}
      onLater={onLater}
      {...overrides}
    />,
    { locale: "en", themePreference },
  );
  return { ...result, onUpload, onLater };
}

describe("UploadSchemasDialog", () => {
  it("lists every candidate with all checkboxes checked", () => {
    renderDialog();

    const group = screen.getByRole("group", { name: "Schemas to save" });
    expect(screen.getByRole("dialog").textContent).toContain(
      "Schemas you don't select stay on this browser",
    );
    expect(
      screen
        .getAllByRole("checkbox")
        .map((checkbox) => [
          checkbox.getAttribute("aria-checked"),
          group.contains(checkbox),
        ]),
    ).toEqual([
      ["true", true],
      ["true", true],
      ["true", true],
    ]);
    expect(screen.getByRole("checkbox", { name: "Blog" })).toBeDefined();
  });

  it("uploads only the checked schemas", async () => {
    const { user, onUpload } = renderDialog();

    await user.click(screen.getByRole("checkbox", { name: "Blog" }));
    await user.click(screen.getByRole("button", { name: "Save to cloud" }));

    expect(onUpload).toHaveBeenCalledExactlyOnceWith([
      CANDIDATES[0]?.id,
      CANDIDATES[2]?.id,
    ]);
  });

  it("disables Save to cloud when nothing is checked", async () => {
    const { user } = renderDialog({ candidates: CANDIDATES.slice(0, 1) });

    await user.click(screen.getByRole("checkbox", { name: "Shop" }));

    expect(
      screen.getByRole("button", { name: "Save to cloud" }),
    ).toHaveProperty("disabled", true);
  });

  it("calls onLater without uploading when Later is pressed", async () => {
    const { user, onUpload, onLater } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Later" }));

    expect(onLater).toHaveBeenCalledOnce();
    expect(onUpload).not.toHaveBeenCalled();
  });

  it("calls onLater when Escape is pressed", async () => {
    const { user, onLater } = renderDialog();

    await user.keyboard("{Escape}");

    expect(onLater).toHaveBeenCalledOnce();
  });

  it("calls onLater when the close button is pressed", async () => {
    const { user, onLater } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onLater).toHaveBeenCalledOnce();
  });

  it("disables the controls while uploading", () => {
    renderDialog({ isUploading: true });

    const controls = [
      screen.getByRole("button", { name: "Save to cloud" }),
      screen.getByRole("button", { name: "Later" }),
      ...screen.getAllByRole("checkbox"),
    ];
    expect(controls.map((control) => control.hasAttribute("disabled"))).toEqual(
      [true, true, true, true, true],
    );
    expect(
      screen
        .getByRole("group", { name: "Schemas to save" })
        .closest("form")
        ?.getAttribute("aria-busy"),
    ).toBe("true");
  });

  it("has no axe violations in light and dark themes", async () => {
    const light = renderDialog({}, "light");
    await expectNoAxeViolations(document.body);
    light.unmount();

    renderDialog({}, "dark");
    await expectNoAxeViolations(document.body);
  });
});
