"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/components/auth-provider";
import { CredentialsForm } from "@/features/auth/components/credentials-form";
import { useCredentialsSubmit } from "@/features/auth/hooks/use-credentials-submit";
import { buildAuthHref } from "@/lib/auth/sanitize-return-to";

type SignUpScreenProps = { readonly returnTo: string };

export function SignUpScreen({ returnTo }: SignUpScreenProps): JSX.Element {
  const { t } = useTranslation("auth");
  const router = useRouter();
  const { state, submit } = useCredentialsSubmit({
    mode: "sign-up",
    returnTo,
  });
  const isSignedIn = useAuth((store) => store.auth.status === "signed-in");
  const isSignedInBeforeSubmit = isSignedIn && state.kind === "idle";

  // Someone already signed in has nothing to do here. After this form signs
  // up, the hook navigates to returnTo instead.
  useEffect(() => {
    if (isSignedInBeforeSubmit) {
      router.replace("/");
    }
  }, [isSignedInBeforeSubmit, router]);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">{t("signUp.title")}</h1>
      <CredentialsForm
        mode="sign-up"
        initialEmail=""
        submitState={state}
        onSubmit={(credentials) => {
          void submit(credentials); // submit handles its own failures
        }}
      />
      <p className="text-sm text-muted-foreground">
        {t("signUp.noEmailVerification")}
      </p>
      <Link
        href={buildAuthHref("/sign-in", returnTo)}
        className="inline-flex min-h-6 items-center self-start text-sm text-primary underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {t("signUp.toSignIn")}
      </Link>
    </main>
  );
}
