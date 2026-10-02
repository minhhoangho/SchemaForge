"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { BrandMark } from "@/components/brand-mark";
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
    <main className="grid min-h-dvh content-start justify-items-center gap-6 bg-canvas bg-[radial-gradient(var(--canvas-dot)_1px,transparent_1px)] bg-size-[20px_20px] p-4 sm:place-content-center sm:p-6">
      <BrandMark />
      <div className="flex w-full max-w-[400px] flex-col gap-6 rounded-xl border border-border bg-card p-6 shadow-md sm:p-8">
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
      </div>
    </main>
  );
}
