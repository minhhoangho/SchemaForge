import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";

function renderColumnTypeCommand(): void {
  render(
    <Command label="Column type">
      <CommandInput placeholder="Search a type" />
      <CommandList>
        <CommandEmpty>No type found</CommandEmpty>
        <CommandGroup heading="Common types">
          <CommandItem value="varchar">varchar</CommandItem>
          <CommandItem value="integer">integer</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>,
  );
}

describe("Command", () => {
  it("names the search box with the label prop", () => {
    renderColumnTypeCommand();

    expect(screen.getByRole("combobox", { name: "Column type" })).toBeTruthy();
  });
});

describe("CommandInput", () => {
  it("filters the items while the user types", async () => {
    const user = userEvent.setup();
    renderColumnTypeCommand();

    await user.type(screen.getByRole("combobox"), "var");

    expect(screen.getByRole("option", { name: "varchar" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "integer" })).toBeNull();
  });

  it("shows the empty state when nothing matches", async () => {
    const user = userEvent.setup();
    renderColumnTypeCommand();

    await user.type(screen.getByRole("combobox"), "geometry");

    expect(screen.getByText("No type found")).toBeTruthy();
  });
});
