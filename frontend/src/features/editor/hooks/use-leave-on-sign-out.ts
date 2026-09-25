"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/components/auth-provider";

import type { EditorCloudContext } from "./use-open-schema";

const SCHEMA_LIST_HREF = "/";

/**
 * Leaves the editor of an account's schema once auth turns signed-out (here
 * or in another tab). Unmounting releases the schema lock, so the sign-out
 * flow can delete the account's rows. An owned schema only opens while auth
 * is signed-in or expired, so signed-out here always means a sign-out.
 */
export function useLeaveOnSignOut(input: {
  readonly cloud: EditorCloudContext | null;
}): void {
  const router = useRouter();
  const isSignedOut = useAuth((state) => state.auth.status === "signed-out");
  const isOwned = input.cloud?.kind === "owned";

  useEffect(() => {
    if (isOwned && isSignedOut) {
      router.replace(SCHEMA_LIST_HREF);
    }
  }, [isOwned, isSignedOut, router]);
}
