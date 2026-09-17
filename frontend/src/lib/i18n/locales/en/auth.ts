import { enAuthAccountMenu } from "./auth/account-menu";
import { enAuthCredentialsForm } from "./auth/credentials-form";
import { enAuthSignIn } from "./auth/sign-in";
import { enAuthSignInPrompt } from "./auth/sign-in-prompt";
import { enAuthSignUp } from "./auth/sign-up";

export const enAuth = {
  signIn: enAuthSignIn,
  signUp: enAuthSignUp,
  credentialsForm: enAuthCredentialsForm,
  accountMenu: enAuthAccountMenu,
  signInPrompt: enAuthSignInPrompt,
} as const;
