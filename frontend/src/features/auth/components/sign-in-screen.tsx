"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { CenteredCardLayout } from "@/components/centered-card-layout";
import { useAuth } from "@/components/auth-provider";
import { Separator } from "@/components/ui/separator";
import { CredentialsForm } from "@/features/auth/components/credentials-form";
import { useCredentialsSubmit } from "@/features/auth/hooks/use-credentials-submit";
import { buildAuthHref } from "@/lib/auth/sanitize-return-to";

type SignInScreenProps = { readonly returnTo: string };

export function SignInScreen({ returnTo }: SignInScreenProps): JSX.Element {
  const { t } = useTranslation("auth");
  const router = useRouter();
  const auth = useAuth((state) => state.auth);
  const { state, submit } = useCredentialsSubmit({
    mode: "sign-in",
    returnTo,
  });
  const initialEmail =
    auth.status === "expired" ? (auth.lastUser?.email ?? "") : "";
  const isSignedInBeforeSubmit =
    auth.status === "signed-in" && state.kind === "idle";

  // Someone already signed in has nothing to do here. After this form signs
  // in, the hook navigates to returnTo instead.
  useEffect(() => {
    if (isSignedInBeforeSubmit) {
      router.replace("/");
    }
  }, [isSignedInBeforeSubmit, router]);

  return (
    <CenteredCardLayout>
      <h1 className="text-2xl font-bold">{t("signIn.title")}</h1>
      <CredentialsForm
        mode="sign-in"
        initialEmail={initialEmail}
        submitState={state}
        onSubmit={(credentials) => {
          void submit(credentials); // submit handles its own failures
        }}
      />
      <Separator />
      <p className="text-sm text-muted-foreground">
        {t("signIn.noPasswordRecovery")}
      </p>
      <Link
        href={buildAuthHref("/sign-up", returnTo)}
        className="inline-flex min-h-6 items-center self-start text-sm text-primary underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {t("signIn.toSignUp")}
      </Link>
    </CenteredCardLayout>
  );
}
