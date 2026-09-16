import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { JSX } from "react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { CommittedTextField } from "./committed-text-field";

const LABEL = "Table name";
const INITIAL_VALUE = "users";

type HarnessProps = {
  readonly onCommit: (value: string) => void;
  readonly shouldAccept?: boolean;
  readonly errorMessage?: string;
};

// Plays the caller: it keeps the value and applies a commit only when the
// commit is accepted, the way a panel applies a dispatch that succeeded.
function Harness({
  onCommit,
  shouldAccept = true,
  errorMessage,
}: HarnessProps): JSX.Element {
  const [value, setValue] = useState(INITIAL_VALUE);

  function handleCommit(next: string): void {
    onCommit(next);
    if (shouldAccept) {
      setValue(next);
    }
  }

  return (
    <>
      <CommittedTextField
        id="table-name"
        label={LABEL}
        value={value}
        onCommit={handleCommit}
        {...(errorMessage === undefined ? {} : { errorMessage })}
      />
      <button type="button">Elsewhere</button>
    </>
  );
}

function getField(): HTMLInputElement {
  const field = screen.getByLabelText(LABEL);
  if (!(field instanceof HTMLInputElement)) {
    throw new Error("Expected the label to name an input.");
  }
  return field;
}

describe("CommittedTextField", () => {
  it("commits the new value on blur", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn<(value: string) => void>();
    render(<Harness onCommit={onCommit} />);

    await user.clear(getField());
    await user.type(getField(), "people");
    await user.tab();

    expect(onCommit).toHaveBeenCalledExactlyOnceWith("people");
    expect(getField().value).toBe("people");
  });

  it("commits on Enter", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn<(value: string) => void>();
    render(<Harness onCommit={onCommit} />);

    await user.clear(getField());
    await user.type(getField(), "people{Enter}");

    expect(onCommit).toHaveBeenCalledExactlyOnceWith("people");
    expect(getField()).toBe(document.activeElement);
  });

  it("does not commit while the IME is composing", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn<(value: string) => void>();
    render(<Harness onCommit={onCommit} />);
    await user.clear(getField());
    await user.type(getField(), "người");

    fireEvent.keyDown(getField(), { key: "Enter", isComposing: true });

    expect(onCommit).not.toHaveBeenCalled();
    expect(getField().value).toBe("người");
  });

  it("does not commit on the Enter that confirms an IME composition in Safari", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn<(value: string) => void>();
    render(<Harness onCommit={onCommit} />);
    await user.clear(getField());
    await user.type(getField(), "người");

    // Safari reports isComposing false on this keydown, but keyCode 229.
    fireEvent.keyDown(getField(), {
      key: "Enter",
      isComposing: false,
      keyCode: 229,
    });

    expect(onCommit).not.toHaveBeenCalled();
    expect(getField().value).toBe("người");
  });

  it("restores the current value on Escape", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn<(value: string) => void>();
    render(<Harness onCommit={onCommit} />);

    await user.type(getField(), "_draft{Escape}");
    await user.tab();

    expect(getField().value).toBe(INITIAL_VALUE);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("does not commit when the value did not change", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn<(value: string) => void>();
    render(<Harness onCommit={onCommit} />);

    await user.click(getField());
    await user.keyboard("{Enter}");
    await user.tab();

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("shows the current value again when the caller rejects the commit", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn<(value: string) => void>();
    render(<Harness onCommit={onCommit} shouldAccept={false} />);

    await user.clear(getField());
    await user.type(getField(), "   ");
    await user.tab();

    expect(onCommit).toHaveBeenCalledExactlyOnceWith("   ");
    expect(getField().value).toBe(INITIAL_VALUE);
  });

  it("marks the field invalid and links the error message", () => {
    render(
      <Harness
        onCommit={vi.fn<(value: string) => void>()}
        errorMessage="Taken"
      />,
    );

    expect(getField().getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("textbox", { description: "Taken" })).toBe(
      getField(),
    );
  });
});
