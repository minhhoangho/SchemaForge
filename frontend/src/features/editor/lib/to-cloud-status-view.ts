import type { AuthState } from "@/lib/auth/auth-store";
import type { SyncStatus } from "@/lib/storage/records";
import type { CloudPushState } from "@/lib/sync/cloud-pusher";

export type CloudPushFailureCode = Extract<
  CloudPushState,
  { kind: "failed" }
>["code"];

export type CloudStatusView =
  | { readonly kind: "local-only" }
  | { readonly kind: "synced" }
  | { readonly kind: "syncing" }
  | {
      readonly kind: "unsynced";
      readonly reason: "offline" | "server-unreachable";
    }
  | { readonly kind: "unsynced-session-expired" }
  | { readonly kind: "conflict" }
  | { readonly kind: "deleted-in-cloud" }
  | { readonly kind: "failed"; readonly failure: CloudPushFailureCode };

/**
 * The toolbar's cloud status (spec section 7, "Trạng thái trên toolbar").
 * The first matching rule wins: the cache's stopped states come before the
 * pusher's, and a pending record the pusher has not sent yet reads as syncing
 * because every save already asked for a push.
 */
export function toCloudStatusView(input: {
  readonly ownerId: string | null;
  readonly syncStatus: SyncStatus | null;
  readonly pusher: CloudPushState;
  readonly authStatus: AuthState["status"];
}): CloudStatusView {
  const { ownerId, syncStatus, pusher, authStatus } = input;
  if (ownerId === null) {
    return { kind: "local-only" };
  }
  if (syncStatus === "conflict" || syncStatus === "deleted-in-cloud") {
    return { kind: syncStatus };
  }
  if (pusher.kind === "failed") {
    return { kind: "failed", failure: pusher.code };
  }
  if (
    (syncStatus === "pending" && authStatus === "expired") ||
    pusher.kind === "session-expired"
  ) {
    return { kind: "unsynced-session-expired" };
  }
  if (pusher.kind === "sending") {
    return { kind: "syncing" };
  }
  if (pusher.kind === "waiting-retry") {
    return {
      kind: "unsynced",
      reason: pusher.reason === "offline" ? "offline" : "server-unreachable",
    };
  }
  return syncStatus === "synced" ? { kind: "synced" } : { kind: "syncing" };
}
