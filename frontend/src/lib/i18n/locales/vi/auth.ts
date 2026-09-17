import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enAuth } from "@/lib/i18n/locales/en/auth";

import { viAuthAccountMenu } from "./auth/account-menu";
import { viAuthCredentialsForm } from "./auth/credentials-form";
import { viAuthSignIn } from "./auth/sign-in";
import { viAuthSignInPrompt } from "./auth/sign-in-prompt";
import { viAuthSignUp } from "./auth/sign-up";

export const viAuth = {
  signIn: viAuthSignIn,
  signUp: viAuthSignUp,
  credentialsForm: viAuthCredentialsForm,
  accountMenu: viAuthAccountMenu,
  signInPrompt: viAuthSignInPrompt,
} as const satisfies LocaleNamespace<typeof enAuth>;
