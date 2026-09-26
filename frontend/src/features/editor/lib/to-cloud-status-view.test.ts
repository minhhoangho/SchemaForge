import { describe, expect, it } from "vitest";

import type { AuthState } from "@/lib/auth/auth-store";
import type { SyncStatus } from "@/lib/storage/records";
import type { CloudPushState } from "@/lib/sync/cloud-pusher";

import { toCloudStatusView } from "./to-cloud-status-view";
import type { CloudStatusView } from "./to-cloud-status-view";

const USER_ID = "5f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f";

type Case = readonly [
  name: string,
  ownerId: string | null,
  syncStatus: SyncStatus | null,
  pusher: CloudPushState,
  authStatus: AuthState["status"],
  expected: CloudStatusView,
];

describe("toCloudStatusView", () => {
  it.each<Case>([
    [
      "returns local-only for a guest schema whatever the pusher state",
      null,
      null,
      { kind: "failed", code: "payload-too-large" },
      "signed-in",
      { kind: "local-only" },
    ],
    [
      "returns conflict before a pusher failure",
      USER_ID,
      "conflict",
      { kind: "failed", code: "document-invalid" },
      "signed-in",
      { kind: "conflict" },
    ],
    [
      "returns deleted-in-cloud before a pusher failure",
      USER_ID,
      "deleted-in-cloud",
      { kind: "failed", code: "document-invalid" },
      "signed-in",
      { kind: "deleted-in-cloud" },
    ],
    [
      "returns failed with the error code",
      USER_ID,
      "pending",
      { kind: "failed", code: "schema-limit-reached" },
      "signed-in",
      { kind: "failed", failure: "schema-limit-reached" },
    ],
    [
      "returns unsynced-session-expired for a pending schema while the session is expired",
      USER_ID,
      "pending",
      { kind: "idle" },
      "expired",
      { kind: "unsynced-session-expired" },
    ],
    [
      "returns unsynced-session-expired when the pusher stopped on an expired session",
      USER_ID,
      "pending",
      { kind: "session-expired" },
      "signed-in",
      { kind: "unsynced-session-expired" },
    ],
    [
      "returns syncing while a request is in flight",
      USER_ID,
      "synced",
      { kind: "sending" },
      "signed-in",
      { kind: "syncing" },
    ],
    [
      "returns unsynced offline while waiting to retry after a network failure",
      USER_ID,
      "pending",
      { kind: "waiting-retry", reason: "offline" },
      "signed-in",
      { kind: "unsynced", reason: "offline" },
    ],
    [
      "returns unsynced server-unreachable while waiting to retry after a timeout, 5xx or 429",
      USER_ID,
      "pending",
      { kind: "waiting-retry", reason: "server" },
      "signed-in",
      { kind: "unsynced", reason: "server-unreachable" },
    ],
    [
      "returns synced for a synced record",
      USER_ID,
      "synced",
      { kind: "idle" },
      "signed-in",
      { kind: "synced" },
    ],
    [
      "returns syncing for a pending record before the first push",
      USER_ID,
      "pending",
      { kind: "idle" },
      "signed-in",
      { kind: "syncing" },
    ],
  ])("%s", (_name, ownerId, syncStatus, pusher, authStatus, expected) => {
    expect(
      toCloudStatusView({ ownerId, syncStatus, pusher, authStatus }),
    ).toEqual(expected);
  });
});
