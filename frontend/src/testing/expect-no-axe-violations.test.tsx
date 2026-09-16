import { afterEach, describe, expect, it } from "vitest";

import { expectNoAxeViolations } from "./expect-no-axe-violations";
import { renderWithProviders } from "./render-with-providers";

// Raw colors instead of theme tokens: the fixture has to be an unreadable
// pair, and the point of the test is that axe never looks at it.
const INVISIBLE_TEXT_STYLE = { backgroundColor: "#ffffff", color: "#ffffff" };

// Smaller than the 24x24 CSS px that WCAG 2.5.8 asks for.
const UNDERSIZED_BUTTON_STYLE = { width: "10px", height: "10px" };

afterEach(() => {
  document.documentElement.classList.remove("dark");
  document.documentElement.style.colorScheme = "";
  document.documentElement.removeAttribute("lang");
});

describe("expectNoAxeViolations", () => {
  it("passes for a labelled button", async () => {
    const { container } = renderWithProviders(
      <button type="button">Save</button>,
    );

    await expect(expectNoAxeViolations(container)).resolves.toBeUndefined();
  });

  it("fails for a button without an accessible name", async () => {
    const { container } = renderWithProviders(<button type="button" />);

    await expect(expectNoAxeViolations(container)).rejects.toThrow(
      /button-name/,
    );
  });

  it("does not report color contrast", async () => {
    const { container } = renderWithProviders(
      <p style={INVISIBLE_TEXT_STYLE}>Invisible text</p>,
    );

    await expect(expectNoAxeViolations(container)).resolves.toBeUndefined();
  });

  it("does not report target size on jsdom", async () => {
    const { container } = renderWithProviders(
      <button
        type="button"
        aria-label="Close"
        style={UNDERSIZED_BUTTON_STYLE}
      />,
    );

    await expect(expectNoAxeViolations(container)).resolves.toBeUndefined();
  });
});
