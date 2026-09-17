export const enAuthCredentialsForm = {
  emailLabel: "Email",
  passwordLabel: "Password",
  showPassword: "Show password",
  hidePassword: "Hide password",
  submitting: "Submitting…",
  errors: {
    emailRequired: "Enter your email.",
    emailInvalid: "This email is not valid.",
    emailTooLong: "Email must be at most {{max}} characters.",
    passwordTooShort: "Password must be at least {{min}} characters.",
    passwordTooLong: "Password must be at most {{max}} characters.",
  },
} as const;
