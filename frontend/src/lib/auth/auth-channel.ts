export const AUTH_CHANNEL_NAME = "schemaforge:auth";

// Messages carry only the event: never an email, a user id or a token, since
// any script on the origin can listen to the channel.
export type AuthChannelMessage =
  { readonly type: "signed-in" } | { readonly type: "signed-out" };

export type BroadcastChannelLike = Pick<
  BroadcastChannel,
  "postMessage" | "addEventListener" | "removeEventListener" | "close"
>;

export type AuthChannel = {
  readonly post: (message: AuthChannelMessage) => void;
  readonly subscribe: (
    listener: (message: AuthChannelMessage) => void,
  ) => () => void;
  readonly close: () => void;
};

// Another tab may run a different release, so incoming data is untrusted.
function parseAuthChannelMessage(data: unknown): AuthChannelMessage | null {
  if (typeof data !== "object" || data === null || !("type" in data)) {
    return null;
  }
  switch (data.type) {
    case "signed-in":
      return { type: "signed-in" };
    case "signed-out":
      return { type: "signed-out" };
    default:
      return null;
  }
}

export function createAuthChannel(
  open: (name: string) => BroadcastChannelLike,
): AuthChannel {
  const channel = open(AUTH_CHANNEL_NAME);
  return {
    post: (message) => {
      channel.postMessage(message);
    },
    subscribe: (listener) => {
      const handleMessage = (event: MessageEvent<unknown>): void => {
        const message = parseAuthChannelMessage(event.data);
        if (message !== null) {
          listener(message);
        }
      };
      channel.addEventListener("message", handleMessage);
      return () => {
        channel.removeEventListener("message", handleMessage);
      };
    },
    close: () => {
      channel.close();
    },
  };
}
