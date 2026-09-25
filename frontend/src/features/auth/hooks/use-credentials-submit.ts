"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import type { ApiFailure } from "@/lib/api/api-failure";
import { logger } from "@/lib/logger";

export type CredentialsSubmitState =
  | { readonly kind: "idle" }
  | { readonly kind: "submitting" }
  | { readonly kind: "failed"; readonly failure: ApiFailure };

type Credentials = { readonly email: string; readonly password: string };

const IDLE: CredentialsSubmitState = { kind: "idle" };
const SUBMITTING: CredentialsSubmitState = { kind: "submitting" };

/**
 * Signs in or up through the auth store, then leaves for `returnTo`. The
 * guest-schema upload dialog reacts to the store's sign-in count on its own.
 */
export function useCredentialsSubmit(input: {
  readonly mode: "sign-in" | "sign-up";
  readonly returnTo: string;
}): {
  readonly state: CredentialsSubmitState;
  readonly submit: (credentials: Credentials) => Promise<void>;
} {
  const { mode, returnTo } = input;
  const signIn = useAuth((state) => state.signIn);
  const signUp = useAuth((state) => state.signUp);
  const router = useRouter();
  const [state, setState] = useState<CredentialsSubmitState>(IDLE);
  // State updates land after the next render, so a ref blocks a second call
  // made in the same tick (a double click or Enter pressed twice).
  const isInFlightRef = useRef(false);

  const submit = useCallback(
    async (credentials: Credentials): Promise<void> => {
      if (isInFlightRef.current) {
        return;
      }
      isInFlightRef.current = true;
      setState(SUBMITTING);
      try {
        const action = mode === "sign-in" ? signIn : signUp;
        const result = await action(credentials);
        if (result.isOk) {
          // Stays in flight: the page is leaving, so the form stays disabled.
          router.replace(returnTo);
          return;
        }
        isInFlightRef.current = false;
        setState({ kind: "failed", failure: result.error });
      } catch (cause) {
        // The store rejects only on a local fault (auth not ready yet, or the
        // session record could not be written); the form becomes usable again.
        logger.error("auth.credentials-submit-failed", {
          errorName: cause instanceof Error ? cause.name : "unknown",
        });
        isInFlightRef.current = false;
        setState(IDLE);
      }
    },
    [mode, signIn, signUp, router, returnTo],
  );

  return { state, submit };
}
