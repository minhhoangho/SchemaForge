"use client";

import { TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import {
  useAuth,
  useInitialAuthHint,
  useSignOut,
} from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { buildAuthHref } from "@/lib/auth/sanitize-return-to";
import { logger } from "@/lib/logger";
import { useNotify } from "@/lib/use-notify";

type AccountLinkProps = {
  readonly returnTo: string;
  readonly label: string;
  readonly hasWarningIcon?: boolean;
};

function AccountLink({
  returnTo,
  label,
  hasWarningIcon = false,
}: AccountLinkProps): JSX.Element {
  return (
    <Button asChild variant="ghost" size="sm">
      <Link href={buildAuthHref("/sign-in", returnTo)}>
        {hasWarningIcon ? <TriangleAlertIcon aria-hidden="true" /> : null}
        {label}
      </Link>
    </Button>
  );
}

export function AccountMenu(): JSX.Element {
  const { t } = useTranslation(["auth", "sync"]);
  const auth = useAuth((state) => state.auth);
  const hasAuthHint = useInitialAuthHint();
  const requestSignOut = useSignOut();
  const notify = useNotify();
  const pathname = usePathname();

  async function handleSignOut(): Promise<void> {
    try {
      const result = await requestSignOut();
      if (!result.isOk) {
        notify({ tone: "error", titleKey: "sync:signOutDialog.signOutFailed" });
      }
    } catch (cause: unknown) {
      // The server session is already revoked here, so the user really is
      // signed out and only the local cleanup failed. Task 34 replaces this
      // item with the dialog flow that reports it.
      logger.error("auth.sign-out-cleanup-failed", {
        errorName: cause instanceof Error ? cause.name : "unknown",
      });
    }
  }

  if (auth.status === "signed-in") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label={t("auth:accountMenu.menuLabel", {
              email: auth.user.email,
            })}
          >
            {auth.user.email}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              void handleSignOut();
            }}
          >
            {t("auth:accountMenu.signOut")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (auth.status === "expired") {
    return (
      <AccountLink
        returnTo={pathname}
        label={t("auth:accountMenu.signInAgain")}
        hasWarningIcon
      />
    );
  }

  // A guest sees the link at once; a browser that signed in before keeps the
  // space reserved instead of flashing a sign-in link at a signed-in user.
  if (auth.status === "unknown" && hasAuthHint) {
    return <Skeleton aria-hidden="true" className="h-7 w-32" />;
  }

  return (
    <AccountLink returnTo={pathname} label={t("auth:accountMenu.signIn")} />
  );
}
