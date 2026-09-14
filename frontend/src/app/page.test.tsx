import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "./page";

describe("HomePage", () => {
  it("renders the product name as the main heading", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "SchemaForge",
    );
  });
});
