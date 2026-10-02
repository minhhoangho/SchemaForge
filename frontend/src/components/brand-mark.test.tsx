import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { APP_NAME } from "@/lib/app-name";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";

import { BrandMark } from "./brand-mark";

describe("BrandMark", () => {
  it("shows the app name next to a decorative icon", () => {
    const { container } = render(<BrandMark />);

    expect(screen.getByText(APP_NAME)).toBeDefined();
    const icon = container.querySelector("svg");
    expect(icon?.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("reports no axe violations", async () => {
    const { container } = render(<BrandMark />);

    await expectNoAxeViolations(container);
  });
});
