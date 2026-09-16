import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { JSX } from "react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { CommittedTextArea } from "./committed-text-area";

const LABEL = "Comment";
const INITIAL_VALUE = "Registered users";

type HarnessProps = { readonly onCommit: (value: string) => void };

function Harness({ onCommit }: HarnessProps): JSX.Element {
  const [value, setValue] = useState(INITIAL_VALUE);

  function handleCommit(next: string): void {
    onCommit(next);
    setValue(next);
  }

  return (
    <CommittedTextArea
      id="table-comment"
      label={LABEL}
      value={value}
      onCommit={handleCommit}
    />
  );
}

function getArea(): HTMLTextAreaElement {
  const area = screen.getByLabelText(LABEL);
  if (!(area instanceof HTMLTextAreaElement)) {
    throw new Error("Expected the label to name a textarea.");
  }
  return area;
}

describe("CommittedTextArea", () => {
  it("commits on blur", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn<(value: string) => void>();
    render(<Harness onCommit={onCommit} />);

    await user.clear(getArea());
    await user.type(getArea(), "Customers");
    await user.tab();

    expect(onCommit).toHaveBeenCalledExactlyOnceWith("Customers");
    expect(getArea().value).toBe("Customers");
  });

  it("keeps Enter as a line break", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn<(value: string) => void>();
    render(<Harness onCommit={onCommit} />);

    await user.type(getArea(), "{Enter}more");

    expect(onCommit).not.toHaveBeenCalled();
    expect(getArea().value).toBe(`${INITIAL_VALUE}\nmore`);
  });

  it("restores the current value on Escape", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn<(value: string) => void>();
    render(<Harness onCommit={onCommit} />);

    await user.type(getArea(), " draft{Escape}");
    await user.tab();

    expect(getArea().value).toBe(INITIAL_VALUE);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("does not commit an unchanged value", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn<(value: string) => void>();
    render(<Harness onCommit={onCommit} />);

    await user.click(getArea());
    await user.tab();

    expect(onCommit).not.toHaveBeenCalled();
  });
});
