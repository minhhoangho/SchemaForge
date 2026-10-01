import { EMAIL_MAX_LENGTH } from "@schemaforge/api-contract";
import type { SimpleApiErrorCode } from "@schemaforge/api-contract";
import { act, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CredentialsSubmitState } from "@/features/auth/hooks/use-credentials-submit";
import { renderWithProviders } from "@/testing/render-with-providers";

import { CredentialsForm } from "./credentials-form";
import type { CredentialsFormProps } from "./credentials-form";

const EMAIL = "user@example.com";
const PASSWORD = "stapler-42";
const IDLE: CredentialsSubmitState = { kind: "idle" };

type OnSubmit = CredentialsFormProps["onSubmit"];

function failedWith(
  code: SimpleApiErrorCode,
  status: number,
): CredentialsSubmitState {
  return {
    kind: "failed",
    failure: {
      kind: "http",
      status,
      body: { statusCode: status, code },
      retryAfterSeconds: null,
    },
  };
}

type RenderedForm = ReturnType<typeof renderWithProviders> & {
  readonly onSubmit: ReturnType<typeof vi.fn<OnSubmit>>;
};

function renderForm(
  overrides: Partial<CredentialsFormProps> = {},
): RenderedForm {
  const onSubmit = vi.fn<OnSubmit>();
  const props: CredentialsFormProps = {
    mode: "sign-in",
    initialEmail: "",
    submitState: IDLE,
    onSubmit,
    ...overrides,
  };
  return {
    ...renderWithProviders(<CredentialsForm {...props} />, { locale: "en" }),
    onSubmit,
  };
}

function emailField(): HTMLElement {
  return screen.getByLabelText("Email");
}

// The visibility toggle's name also contains "password", so the field is
// matched by its exact label.
function passwordField(): HTMLElement {
  return screen.getByLabelText("Password", { selector: "input" });
}

describe("CredentialsForm", () => {
  it("labels the email and password fields", () => {
    renderForm();

    expect({
      email: emailField().getAttribute("type"),
      password: passwordField().getAttribute("type"),
    }).toEqual({ email: "email", password: "password" });
  });

  it("uses email and current-password autocomplete on sign-in", () => {
    renderForm({ mode: "sign-in" });

    expect([
      emailField().getAttribute("autocomplete"),
      passwordField().getAttribute("autocomplete"),
    ]).toEqual(["email", "current-password"]);
  });

  it("uses email and new-password autocomplete on sign-up", () => {
    renderForm({ mode: "sign-up" });

    expect([
      emailField().getAttribute("autocomplete"),
      passwordField().getAttribute("autocomplete"),
    ]).toEqual(["email", "new-password"]);
  });

  it("has a single password field on sign-up", () => {
    const { container } = renderForm({ mode: "sign-up" });

    expect(container.querySelectorAll('input[name="password"]')).toHaveLength(
      1,
    );
  });

  it("keeps a pasted password value", async () => {
    const { user } = renderForm();

    await user.click(passwordField());
    await user.paste(PASSWORD);

    expect(passwordField()).toHaveProperty("value", PASSWORD);
  });

  it("toggles password visibility with aria-pressed and keeps the value", async () => {
    const { user } = renderForm();
    await user.type(passwordField(), PASSWORD);
    const toggle = screen.getByRole("button", { name: "Show password" });

    await user.click(toggle);

    const pressed = screen.getByRole("button", { name: "Hide password" });
    expect({
      pressed: pressed.getAttribute("aria-pressed"),
      controls: pressed.getAttribute("aria-controls"),
      type: passwordField().getAttribute("type"),
      isFocused: document.activeElement === pressed,
    }).toEqual({
      pressed: "true",
      controls: passwordField().id,
      type: "text",
      isFocused: true,
    });
    expect(passwordField()).toHaveProperty("value", PASSWORD);
  });

  it("gives the visibility toggle at least a 24 pixel target", () => {
    renderForm();

    expect(
      screen.getByRole("button", { name: "Show password" }).className,
    ).toMatch(/(^|\s)size-(6|7|8|9|10)(\s|$)/u);
  });

  it("shows field errors with aria-invalid and aria-describedby and does not submit", async () => {
    const { user, onSubmit } = renderForm();
    await user.type(emailField(), "not-an-email");
    await user.type(passwordField(), "short");

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    const emailError = screen.getByText("This email is not valid.");
    const passwordError = screen.getByText(
      "Password must be at least 8 characters.",
    );
    expect({
      emailInvalid: emailField().getAttribute("aria-invalid"),
      emailDescribedBy: emailField().getAttribute("aria-describedby"),
      passwordInvalid: passwordField().getAttribute("aria-invalid"),
      passwordDescribedBy: passwordField().getAttribute("aria-describedby"),
      submitCount: onSubmit.mock.calls.length,
    }).toEqual({
      emailInvalid: "true",
      emailDescribedBy: emailError.id,
      passwordInvalid: "true",
      passwordDescribedBy: passwordError.id,
      submitCount: 0,
    });
  });

  it.each([
    ["an empty email", "", "Enter your email."],
    [
      "a too long email",
      `${"a".repeat(EMAIL_MAX_LENGTH)}@example.com`,
      `Email must be at most ${String(EMAIL_MAX_LENGTH)} characters.`,
    ],
  ])(
    "describes %s with its translated message",
    async (_case, email, message) => {
      const { user } = renderForm();
      await user.click(emailField());
      await user.paste(email);
      await user.click(passwordField());
      await user.paste(PASSWORD);

      await user.click(screen.getByRole("button", { name: "Sign in" }));

      const describedBy = emailField().getAttribute("aria-describedby") ?? "";
      expect(document.getElementById(describedBy)?.textContent).toBe(message);
    },
  );

  it("moves focus to the first invalid field", async () => {
    const { user } = renderForm();
    await user.type(emailField(), EMAIL);

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(document.activeElement).toBe(passwordField());
  });

  it("submits the trimmed email and the password when both are valid", async () => {
    const { user, onSubmit } = renderForm();
    await user.type(emailField(), ` ${EMAIL} `);
    await user.type(passwordField(), PASSWORD);

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      email: EMAIL,
      password: PASSWORD,
    });
  });

  it("prefills the initial email", () => {
    renderForm({ initialEmail: EMAIL });

    expect(emailField()).toHaveProperty("value", EMAIL);
  });

  it("takes a later initial email while the field is still empty", () => {
    const { rerender } = renderForm();

    rerender(
      <CredentialsForm
        mode="sign-in"
        initialEmail={EMAIL}
        submitState={IDLE}
        onSubmit={vi.fn<OnSubmit>()}
      />,
    );

    expect(emailField()).toHaveProperty("value", EMAIL);
  });

  it.each([
    ["invalid-credentials", 401, "The email or password is incorrect."],
    [
      "email-already-registered",
      409,
      "An account already exists for this email.",
    ],
    [
      "password-too-common",
      400,
      "This password is too common. Choose a different one.",
    ],
    [
      "too-many-requests",
      429,
      "You tried too many times. Wait a moment and try again.",
    ],
  ] as const)(
    "shows the translated message for %s in an alert",
    (code, status, message) => {
      renderForm({ submitState: failedWith(code, status) });

      expect(screen.getByRole("alert").textContent).toBe(message);
    },
  );

  it("shows server field errors under the matching fields", () => {
    renderForm({
      submitState: {
        kind: "failed",
        failure: {
          kind: "http",
          status: 400,
          body: {
            statusCode: 400,
            code: "validation-failed",
            fields: [{ path: "password", constraint: "minLength" }],
          },
          retryAfterSeconds: null,
        },
      },
    });

    expect({
      emailInvalid: emailField().getAttribute("aria-invalid"),
      passwordInvalid: passwordField().getAttribute("aria-invalid"),
      passwordDescription: document.getElementById(
        passwordField().getAttribute("aria-describedby") ?? "",
      )?.textContent,
    }).toEqual({
      emailInvalid: null,
      passwordInvalid: "true",
      passwordDescription:
        "What you entered is not valid. Check it and try again.",
    });
  });

  it("keeps both values after a server error", async () => {
    const onSubmit = vi.fn<OnSubmit>();
    const { user, rerender } = renderForm({ onSubmit });
    await user.type(emailField(), EMAIL);
    await user.type(passwordField(), PASSWORD);
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    rerender(
      <CredentialsForm
        mode="sign-in"
        initialEmail=""
        submitState={failedWith("invalid-credentials", 401)}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole("alert")).toBeDefined();
    expect(emailField()).toHaveProperty("value", EMAIL);
    expect(passwordField()).toHaveProperty("value", PASSWORD);
  });

  it("disables the submit button while submitting", () => {
    renderForm({ submitState: { kind: "submitting" } });

    expect(screen.getByRole("button", { name: "Submitting…" })).toHaveProperty(
      "disabled",
      true,
    );
  });
  describe("rate limit countdown", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function renderRateLimited(retryAfterSeconds: number): RenderedForm {
      return renderForm({
        submitState: {
          kind: "failed",
          failure: {
            kind: "http",
            status: 429,
            body: { statusCode: 429, code: "too-many-requests" },
            retryAfterSeconds,
          },
        },
      });
    }

    it.each([
      [1, "Too many attempts. Try again in 1 second."],
      [45, "Too many attempts. Try again in 45 seconds."],
      [60, "Too many attempts. Try again in 1 minute."],
      [90, "Too many attempts. Try again in 2 minutes."],
    ])("states a %s second wait in the alert", (seconds, message) => {
      renderRateLimited(seconds);

      expect(screen.getByRole("alert").textContent).toBe(message);
    });

    it("counts the remaining wait down in real time", () => {
      renderRateLimited(90);

      expect(screen.getByText("Try again in 1:30")).toBeDefined();

      act(() => {
        vi.advanceTimersByTime(31_000);
      });

      expect(screen.getByText("Try again in 0:59")).toBeDefined();
    });

    // The ticking value stays out of the accessibility tree, so a screen
    // reader hears the wait once from the alert instead of every second.
    it("keeps the ticking countdown hidden from assistive technology", () => {
      renderRateLimited(90);
      const alert = screen.getByRole("alert");

      act(() => {
        vi.advanceTimersByTime(31_000);
      });

      expect({
        alertText: alert.textContent,
        hidden: screen
          .getByText("Try again in 0:59")
          .getAttribute("aria-hidden"),
      }).toEqual({
        alertText: "Too many attempts. Try again in 2 minutes.",
        hidden: "true",
      });
    });

    it("disables the submit button until the wait is over", () => {
      renderRateLimited(5);

      expect(screen.getByRole("button", { name: "Sign in" })).toHaveProperty(
        "disabled",
        true,
      );

      act(() => {
        vi.advanceTimersByTime(5_000);
      });

      expect({
        isDisabled: screen
          .getByRole("button", { name: "Sign in" })
          .hasAttribute("disabled"),
        countdown: screen.queryByText(/Try again in/),
      }).toEqual({ isDisabled: false, countdown: null });
    });
  });
});
