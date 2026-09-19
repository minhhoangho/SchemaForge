"use client";

import Link from "next/link";
import type { JSX, ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildAuthHref } from "@/lib/auth/sanitize-return-to";

export type SignInPromptReason = "cloudSave" | "cloudSchema";

const REASON_KEYS = {
  cloudSave: "auth:signInPrompt.reasons.cloudSave",
  cloudSchema: "auth:signInPrompt.reasons.cloudSchema",
} as const;

export type SignInPrompt = {
  readonly requireSignIn: (reason: SignInPromptReason) => boolean;
};

type OpenPrompt = {
  readonly reason: SignInPromptReason;
  readonly returnTo: string;
};

type SignInPromptProviderProps = { readonly children: ReactNode };

const SignInPromptContext = createContext<SignInPrompt | null>(null);

export function SignInPromptProvider({
  children,
}: SignInPromptProviderProps): JSX.Element {
  const { t } = useTranslation(["auth", "common"]);
  const isSignedIn = useAuth((state) => state.auth.status === "signed-in");
  // The last prompt stays mounted after it closes, so Radix can run its
  // closing transition and hand focus back to whatever opened the dialog.
  const [prompt, setPrompt] = useState<OpenPrompt | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  // Radix hands focus back to a DialogTrigger, and this dialog has none: it
  // opens from whichever control asked for a sign-in, so that control is
  // remembered here instead.
  const openerRef = useRef<HTMLElement | null>(null);

  const requireSignIn = useCallback(
    (reason: SignInPromptReason): boolean => {
      if (isSignedIn) {
        return true;
      }
      openerRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      // Read where the user is now, so signing in brings them back here.
      setPrompt({
        reason,
        returnTo: `${window.location.pathname}${window.location.search}`,
      });
      setIsOpen(true);
      return false;
    },
    [isSignedIn],
  );

  const value = useMemo<SignInPrompt>(
    () => ({ requireSignIn }),
    [requireSignIn],
  );

  return (
    <SignInPromptContext value={value}>
      {children}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        {prompt === null ? null : (
          <DialogContent
            closeLabel={t("common:actions.close")}
            onCloseAutoFocus={(event) => {
              const opener = openerRef.current;
              if (opener === null) {
                return;
              }
              event.preventDefault();
              opener.focus();
            }}
          >
            <DialogHeader>
              <DialogTitle>{t("auth:signInPrompt.title")}</DialogTitle>
              <DialogDescription>
                {t(REASON_KEYS[prompt.reason])}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href={buildAuthHref("/sign-in", prompt.returnTo)}>
                  {t("auth:signInPrompt.signIn")}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={buildAuthHref("/sign-up", prompt.returnTo)}>
                  {t("auth:signInPrompt.signUp")}
                </Link>
              </Button>
              <DialogClose asChild>
                <Button variant="ghost">{t("auth:signInPrompt.later")}</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </SignInPromptContext>
  );
}

export function useSignInPrompt(): SignInPrompt {
  const value = useContext(SignInPromptContext);

  if (value === null) {
    throw new Error(
      "useSignInPrompt must be used inside a SignInPromptProvider.",
    );
  }

  return value;
}
