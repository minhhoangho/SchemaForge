"use client";

import {
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@schemaforge/api-contract";
import type { TFunction } from "i18next";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import type { JSX } from "react";
import { useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CredentialsSubmitState } from "@/features/auth/hooks/use-credentials-submit";
import { validateCredentials } from "@/features/auth/lib/validate-credentials";
import type { CredentialsFieldError } from "@/features/auth/lib/validate-credentials";
import type { ApiFailure } from "@/lib/api/api-failure";
import { toApiErrorMessageKey } from "@/lib/api/api-failure";

export type CredentialsFormProps = {
  readonly mode: "sign-in" | "sign-up";
  readonly initialEmail: string;
  readonly submitState: CredentialsSubmitState;
  readonly onSubmit: (input: {
    readonly email: string;
    readonly password: string;
  }) => void;
};

type Field = CredentialsFieldError["field"];
type FieldMessages = Partial<Record<Field, string>>;

// Password managers pick the right entry from these values (WCAG 3.3.8).
const MODE_SETTINGS = {
  "sign-in": {
    submitKey: "signIn.submit",
    credentialAutoComplete: "current-password",
  },
  "sign-up": {
    submitKey: "signUp.submit",
    credentialAutoComplete: "new-password",
  },
} as const;

const FIELD_ERROR_CLASS_NAME = "text-sm text-destructive";

function describeEmailError(
  code: Extract<CredentialsFieldError, { field: "email" }>["code"],
  t: TFunction<"auth">,
): string {
  switch (code) {
    case "required":
      return t("credentialsForm.errors.emailRequired");
    case "invalid":
      return t("credentialsForm.errors.emailInvalid");
    case "too-long":
      return t("credentialsForm.errors.emailTooLong", {
        max: EMAIL_MAX_LENGTH,
      });
    default: {
      const unhandledCode: never = code;
      return unhandledCode;
    }
  }
}

function describeFieldError(
  error: CredentialsFieldError,
  t: TFunction<"auth">,
): string {
  if (error.field === "email") {
    return describeEmailError(error.code, t);
  }
  return error.code === "too-short"
    ? t("credentialsForm.errors.passwordTooShort", { min: PASSWORD_MIN_LENGTH })
    : t("credentialsForm.errors.passwordTooLong", { max: PASSWORD_MAX_LENGTH });
}

function isField(path: string): path is Field {
  return path === "email" || path === "password";
}

// A 400 validation-failed names the rejected fields; each gets the generic
// message, since the server's constraint names are not user-facing text.
function toServerFieldMessages(
  failure: ApiFailure | null,
  message: string,
): FieldMessages {
  if (failure?.kind !== "http" || failure.body.code !== "validation-failed") {
    return {};
  }
  return Object.fromEntries(
    failure.body.fields
      .map((field) => field.path)
      .filter(isField)
      .map((path) => [path, message]),
  );
}

type FieldErrorTextProps = {
  readonly id: string;
  readonly message: string | undefined;
};

function FieldErrorText({
  id,
  message,
}: FieldErrorTextProps): JSX.Element | null {
  return message === undefined ? null : (
    <p id={id} className={FIELD_ERROR_CLASS_NAME}>
      {message}
    </p>
  );
}

/** Email and password form shared by /sign-in and /sign-up (spec section 6). */
export function CredentialsForm({
  mode,
  initialEmail,
  submitState,
  onSubmit,
}: CredentialsFormProps): JSX.Element {
  const { t } = useTranslation("auth");
  const { t: tApiErrors } = useTranslation("apiErrors");
  const baseId = useId();
  const ids = {
    email: `${baseId}-email`,
    emailError: `${baseId}-email-error`,
    password: `${baseId}-password`,
    passwordError: `${baseId}-password-error`,
  };
  const [email, setEmail] = useState(initialEmail);
  const [adoptedInitialEmail, setAdoptedInitialEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [clientErrors, setClientErrors] = useState<
    readonly CredentialsFieldError[]
  >([]);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // The expired session's email arrives after the first render; it fills the
  // field only while the user has not typed anything there.
  if (initialEmail !== adoptedInitialEmail) {
    setAdoptedInitialEmail(initialEmail);
    if (email === "") {
      setEmail(initialEmail);
    }
  }

  const failure = submitState.kind === "failed" ? submitState.failure : null;
  const messages: FieldMessages = {
    ...toServerFieldMessages(failure, tApiErrors("validation-failed")),
    ...Object.fromEntries(
      clientErrors.map((error) => [error.field, describeFieldError(error, t)]),
    ),
  };
  const settings = MODE_SETTINGS[mode];
  const isSubmitting = submitState.kind === "submitting";

  function handleSubmit(): void {
    const errors = validateCredentials({ email, password });
    // Commit aria-invalid and the messages before focus moves, so the field
    // is announced together with its error.
    flushSync(() => {
      setClientErrors(errors);
    });
    const firstError = errors[0];
    if (firstError !== undefined) {
      const ref = firstError.field === "email" ? emailRef : passwordRef;
      ref.current?.focus();
      return;
    }
    onSubmit({ email: email.trim(), password });
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.email}>{t("credentialsForm.emailLabel")}</Label>
        <Input
          ref={emailRef}
          id={ids.email}
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
          aria-invalid={messages.email === undefined ? undefined : true}
          aria-describedby={
            messages.email === undefined ? undefined : ids.emailError
          }
        />
        <FieldErrorText id={ids.emailError} message={messages.email} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.password}>
          {t("credentialsForm.passwordLabel")}
        </Label>
        <div className="flex items-center gap-2">
          <Input
            ref={passwordRef}
            id={ids.password}
            type={isPasswordVisible ? "text" : "password"}
            name="password"
            autoComplete={settings.credentialAutoComplete}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
            aria-invalid={messages.password === undefined ? undefined : true}
            aria-describedby={
              messages.password === undefined ? undefined : ids.passwordError
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-pressed={isPasswordVisible}
            aria-controls={ids.password}
            aria-label={
              isPasswordVisible
                ? t("credentialsForm.hidePassword")
                : t("credentialsForm.showPassword")
            }
            onClick={() => {
              setIsPasswordVisible((isVisible) => !isVisible);
            }}
          >
            {isPasswordVisible ? (
              <EyeOffIcon aria-hidden="true" />
            ) : (
              <EyeIcon aria-hidden="true" />
            )}
          </Button>
        </div>
        <FieldErrorText id={ids.passwordError} message={messages.password} />
      </div>
      {failure === null ? null : (
        <p role="alert" className={FIELD_ERROR_CLASS_NAME}>
          {tApiErrors(toApiErrorMessageKey(failure))}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? t("credentialsForm.submitting") : t(settings.submitKey)}
      </Button>
    </form>
  );
}
