export const enAuthCredentialsForm = {
  emailLabel: "Email",
  passwordLabel: "Password",
  showPassword: "Show password",
  hidePassword: "Hide password",
  submitting: "Submitting…",
  retryAfter: {
    minutes_one: "Too many attempts. Try again in {{count}} minute.",
    minutes_other: "Too many attempts. Try again in {{count}} minutes.",
    seconds_one: "Too many attempts. Try again in {{count}} second.",
    seconds_other: "Too many attempts. Try again in {{count}} seconds.",
    remaining: "Try again in {{clock}}",
  },
  errors: {
    emailRequired: "Enter your email.",
    emailInvalid: "This email is not valid.",
    emailTooLong: "Email must be at most {{max}} characters.",
    passwordTooShort: "Password must be at least {{min}} characters.",
    passwordTooLong: "Password must be at most {{max}} characters.",
  },
} as const;
