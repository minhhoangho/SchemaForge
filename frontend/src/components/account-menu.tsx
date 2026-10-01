"use client";

import { TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { JSX, RefObject } from "react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useAuth, useInitialAuthHint } from "@/components/auth-provider";
import { SignOutDialog } from "@/components/sign-out-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useSignOutFlow } from "@/components/use-sign-out-flow";
import { buildAuthHref } from "@/lib/auth/sanitize-return-to";

type AccountLinkProps = {
  readonly returnTo: string;
  readonly label: string;
  readonly hasWarningIcon?: boolean;
  readonly linkRef?: RefObject<HTMLAnchorElement | null>;
};

function AccountLink({
  returnTo,
  label,
  hasWarningIcon = false,
  linkRef,
}: AccountLinkProps): JSX.Element {
  return (
    <Button asChild variant="ghost" size="sm">
      <Link ref={linkRef} href={buildAuthHref("/sign-in", returnTo)}>
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
  const pathname = usePathname();
  const flow = useSignOutFlow();
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const signInLinkRef = useRef<HTMLAnchorElement | null>(null);
  // Only a sign-out started here moves focus; one from another tab must not
  // pull focus away from whatever the user is doing.
  const hasRequestedSignOutRef = useRef(false);
  const isFlowBusy =
    flow.state.kind === "counting" || flow.state.kind === "signing-out";

  // The button that held focus is gone once the account is signed out, so
  // focus continues on the sign-in link that replaces it. A flow that ended
  // without signing out drops the request, so a later sign-out from another
  // tab cannot pull focus.
  useEffect(() => {
    if (auth.status === "signed-in") {
      if (flow.state.kind === "idle") {
        hasRequestedSignOutRef.current = false;
      }
      return;
    }
    if (!hasRequestedSignOutRef.current) {
      return;
    }
    hasRequestedSignOutRef.current = false;
    signInLinkRef.current?.focus();
  }, [auth.status, flow.state.kind]);

  if (auth.status === "signed-in") {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              ref={menuButtonRef}
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
              disabled={isFlowBusy}
              onSelect={() => {
                hasRequestedSignOutRef.current = true;
                // The flow reports its own failures.
                void flow.start();
              }}
            >
              {t("auth:accountMenu.signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <SignOutDialog
          state={flow.state}
          onTrySync={() => {
            void flow.trySync();
          }}
          onConfirm={() => {
            void flow.confirm();
          }}
          onCancel={flow.cancel}
          onReturnFocus={() => {
            menuButtonRef.current?.focus();
          }}
        />
      </>
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
    <AccountLink
      returnTo={pathname}
      label={t("auth:accountMenu.signIn")}
      linkRef={signInLinkRef}
    />
  );
}
