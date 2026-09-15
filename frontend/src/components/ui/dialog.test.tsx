import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "./dialog";

describe("DialogContent", () => {
  it("names the close button with the closeLabel prop", () => {
    render(
      <Dialog open>
        <DialogContent closeLabel="Close dialog">
          <DialogTitle>Rename schema</DialogTitle>
          <DialogDescription>Choose a new name.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByRole("button", { name: "Close dialog" }).tagName).toBe(
      "BUTTON",
    );
  });

  it("omits the close button when hasCloseButton is false", () => {
    render(
      <Dialog open>
        <DialogContent closeLabel="Close dialog" hasCloseButton={false}>
          <DialogTitle>Rename schema</DialogTitle>
          <DialogDescription>Choose a new name.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("DialogFooter", () => {
  it("names its close button with the closeLabel prop", () => {
    render(
      <Dialog open>
        <DialogContent closeLabel="Close dialog" hasCloseButton={false}>
          <DialogTitle>Rename schema</DialogTitle>
          <DialogDescription>Choose a new name.</DialogDescription>
          <DialogFooter hasCloseButton closeLabel="Cancel" />
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByRole("button", { name: "Cancel" }).tagName).toBe(
      "BUTTON",
    );
  });
});
