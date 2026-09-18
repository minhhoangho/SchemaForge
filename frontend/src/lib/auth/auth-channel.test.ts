import { describe, expect, it, vi } from "vitest";

import { AUTH_CHANNEL_NAME, createAuthChannel } from "./auth-channel";
import type { BroadcastChannelLike } from "./auth-channel";

// In-memory stand-in for BroadcastChannel: a message reaches every other
// channel opened with the same name, never the sender, like the real API.
class FakeBroadcastChannel extends EventTarget {
  isClosed = false;

  constructor(
    readonly name: string,
    private readonly peers: Set<FakeBroadcastChannel>,
  ) {
    super();
    peers.add(this);
  }

  postMessage(message: unknown): void {
    for (const peer of this.peers) {
      if (peer !== this && peer.name === this.name && !peer.isClosed) {
        peer.dispatchEvent(new MessageEvent("message", { data: message }));
      }
    }
  }

  close(): void {
    this.isClosed = true;
    this.peers.delete(this);
  }
}

function createFakeBroadcastHub(): {
  readonly open: (name: string) => BroadcastChannelLike;
  readonly opened: readonly FakeBroadcastChannel[];
} {
  const peers = new Set<FakeBroadcastChannel>();
  const opened: FakeBroadcastChannel[] = [];
  return {
    open: (name) => {
      const channel = new FakeBroadcastChannel(name, peers);
      opened.push(channel);
      return channel;
    },
    opened,
  };
}

describe("createAuthChannel", () => {
  it("opens the schemaforge:auth channel", () => {
    const hub = createFakeBroadcastHub();

    createAuthChannel(hub.open);

    expect(hub.opened.map((channel) => channel.name)).toEqual([
      AUTH_CHANNEL_NAME,
    ]);
  });

  it("delivers a signed-out message to the other channel", () => {
    const hub = createFakeBroadcastHub();
    const sender = createAuthChannel(hub.open);
    const receiver = createAuthChannel(hub.open);
    const listener = vi.fn();
    receiver.subscribe(listener);

    sender.post({ type: "signed-out" });

    expect(listener).toHaveBeenCalledExactlyOnceWith({ type: "signed-out" });
  });

  it.each([
    [{ type: "signed-in", email: "user@example.com" }, { type: "signed-in" }],
    [{ type: "signed-out" }, { type: "signed-out" }],
  ])("delivers only the message type for %j", (posted, expected) => {
    const hub = createFakeBroadcastHub();
    const receiver = createAuthChannel(hub.open);
    const listener = vi.fn();
    receiver.subscribe(listener);

    hub.open(AUTH_CHANNEL_NAME).postMessage(posted);

    expect(listener).toHaveBeenCalledExactlyOnceWith(expected);
  });

  it.each([
    null,
    "signed-out",
    42,
    {},
    { type: "signed-up" },
    { type: 1 },
    [{ type: "signed-out" }],
  ])("ignores messages with an unknown shape (%j)", (message) => {
    const hub = createFakeBroadcastHub();
    const receiver = createAuthChannel(hub.open);
    const listener = vi.fn();
    receiver.subscribe(listener);

    hub.open(AUTH_CHANNEL_NAME).postMessage(message);

    expect(listener).not.toHaveBeenCalled();
  });

  it("stops delivering after unsubscribe", () => {
    const hub = createFakeBroadcastHub();
    const sender = createAuthChannel(hub.open);
    const receiver = createAuthChannel(hub.open);
    const listener = vi.fn();
    const unsubscribe = receiver.subscribe(listener);

    unsubscribe();
    sender.post({ type: "signed-in" });

    expect(listener).not.toHaveBeenCalled();
  });

  it("closes the underlying channel", () => {
    const hub = createFakeBroadcastHub();
    const channel = createAuthChannel(hub.open);

    channel.close();

    expect(hub.opened[0]?.isClosed).toBe(true);
  });
});
