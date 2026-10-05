import { AI_MAX_USER_MESSAGE_LENGTH } from "@schemaforge/api-contract";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { renderWithProviders } from "@/testing/render-with-providers";

import { AiComposer } from "./ai-composer";

function renderComposer(
  isSending = false,
  themePreference: "light" | "dark" = "light",
): {
  readonly onSend: ReturnType<typeof vi.fn<(text: string) => void>>;
  readonly onStop: ReturnType<typeof vi.fn<() => void>>;
} & ReturnType<typeof renderWithProviders> {
  const onSend = vi.fn<(text: string) => void>();
  const onStop = vi.fn<() => void>();
  const rendered = renderWithProviders(
    <AiComposer isSending={isSending} onSend={onSend} onStop={onStop} />,
    { locale: "en", themePreference },
  );
  return { onSend, onStop, ...rendered };
}

const LABEL = "Message to the AI assistant";

function getInput(): HTMLTextAreaElement {
  const input = screen.getByRole("textbox", { name: LABEL });
  if (!(input instanceof HTMLTextAreaElement)) {
    throw new TypeError("Expected a textarea.");
  }
  return input;
}

describe("AiComposer", () => {
  it("keeps the field, the counter and the button in one box", () => {
    renderComposer();
    const box = getInput().parentElement;

    expect(box?.contains(screen.getByText("0 of 4000 characters"))).toBe(true);
    expect(box?.contains(screen.getByRole("button", { name: "Send" }))).toBe(
      true,
    );
    expect(getInput().rows).toBe(1);
    expect(getInput().className).toContain("max-h-[120px]");
  });

  it("sends on Enter and adds a line on Shift+Enter", async () => {
    const { user, onSend } = renderComposer();
    const input = getInput();

    await user.type(input, "first{Shift>}{Enter}{/Shift}second");
    expect(input.value).toBe("first\nsecond");
    expect(onSend).not.toHaveBeenCalled();

    await user.keyboard("{Enter}");

    expect(onSend).toHaveBeenCalledExactlyOnceWith("first\nsecond");
    expect(input.value).toBe("");
  });

  it("does not send an empty message", async () => {
    const { user, onSend } = renderComposer();

    await user.type(screen.getByRole("textbox", { name: LABEL }), "  {Enter}");

    expect(onSend).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Send" }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("does not send on Enter while composing with an IME", async () => {
    const { user, onSend } = renderComposer();
    const input = getInput();
    await user.type(input, "xin chao");

    fireEvent.keyDown(input, { key: "Enter", isComposing: true });

    expect(onSend).not.toHaveBeenCalled();
    expect(input.value).toBe("xin chao");
  });

  it("does not send on Enter with keyCode 229 after the composition ended", async () => {
    const { user, onSend } = renderComposer();
    const input = getInput();
    await user.type(input, "xin chao");

    fireEvent.keyDown(input, { key: "Enter", keyCode: 229 });

    expect(onSend).not.toHaveBeenCalled();
    expect(input.value).toBe("xin chao");
  });

  it("does not send on Enter while a reply is being sent", () => {
    const { onSend } = renderComposer(true);

    fireEvent.keyDown(getInput(), { key: "Enter" });

    expect(onSend).not.toHaveBeenCalled();
  });

  it("describes the counter in Vietnamese", async () => {
    const onSend = vi.fn<(text: string) => void>();
    const { user } = renderWithProviders(
      <AiComposer
        isSending={false}
        onSend={onSend}
        onStop={vi.fn<() => void>()}
      />,
      { locale: "vi" },
    );
    const input = screen.getByRole("textbox", {
      name: "Tin nhắn gửi trợ lý AI",
    });

    await user.type(input, "abc");
    await user.keyboard("{Enter}");

    expect(screen.getByText("0/4000 ký tự")).toBeTruthy();
    expect(onSend).toHaveBeenCalledExactlyOnceWith("abc");
    expect(screen.getByRole("button", { name: "Gửi" })).toBeTruthy();
  });

  it("limits the message to 4000 characters and links the counter", async () => {
    const { user } = renderComposer();
    const input = getInput();

    expect(AI_MAX_USER_MESSAGE_LENGTH).toBe(4000);
    expect(input.getAttribute("maxlength")).toBe("4000");
    await user.type(input, "abc");

    const counter = screen.getByText("3 of 4000 characters");
    expect(input.getAttribute("aria-describedby")).toContain(counter.id);
  });

  it("shows stop while sending and stops on click", async () => {
    const { user, onStop } = renderComposer(true);

    expect(screen.queryByRole("button", { name: "Send" })).toBeNull();
    expect(
      screen.getByRole("textbox", { name: LABEL }).hasAttribute("readonly"),
    ).toBe(true);
    await user.click(screen.getByRole("button", { name: "Stop" }));

    expect(onStop).toHaveBeenCalledOnce();
  });

  it("sends and stops with the keyboard only", async () => {
    const { user, onSend, onStop, rerender } = renderComposer();

    await user.tab();
    await user.keyboard("hello");
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Send" }),
    );
    await user.keyboard("{Enter}");
    expect(onSend).toHaveBeenCalledExactlyOnceWith("hello");

    rerender(<AiComposer isSending onSend={onSend} onStop={onStop} />);
    screen.getByRole("button", { name: "Stop" }).focus();
    await user.keyboard(" ");

    expect(onStop).toHaveBeenCalledOnce();
  });

  it.each(["light", "dark"] as const)(
    "has no axe violations in the %s theme",
    async (theme) => {
      const { container } = renderComposer(false, theme);

      await expectNoAxeViolations(container);
    },
  );
});
