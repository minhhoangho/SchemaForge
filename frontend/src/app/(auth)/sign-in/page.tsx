import type { Metadata } from "next";
import type { JSX } from "react";

import { SignInScreen } from "@/features/auth/components/sign-in-screen";
import { APP_NAME } from "@/lib/app-name";
import { sanitizeReturnTo } from "@/lib/auth/sanitize-return-to";
import { getRequestLocale } from "@/lib/i18n/request-locale";
import { getServerTranslation } from "@/lib/i18n/server-translation";

type AuthPageProps = {
  readonly searchParams: Promise<{
    readonly returnTo?: string | readonly string[];
  }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = getServerTranslation(locale, "auth");

  return { title: t("signIn.pageTitle", { appName: APP_NAME }) };
}

// returnTo comes from the URL and is untrusted, so it is sanitized before it
// can become a redirect target (spec section 6).
export default async function SignInPage({
  searchParams,
}: AuthPageProps): Promise<JSX.Element> {
  const { returnTo } = await searchParams;
  const first = typeof returnTo === "string" ? returnTo : returnTo?.[0];

  return <SignInScreen returnTo={sanitizeReturnTo(first)} />;
}
