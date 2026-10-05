"use client";

import type { JSX } from "react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import type { AiChatEntry } from "../../state/create-ai-chat-store";
import { AssistantAvatar } from "./ai-message-bubble";
import { MessageRow } from "./ai-message-row";
import type { MessageActions } from "./ai-message-row";

export type AiMessageListProps = MessageActions & {
  readonly messages: readonly AiChatEntry[];
};

// Within this distance of the end, the log counts as read to the end and
// follows new text; further up, the reader keeps their place.
const FOLLOW_SCROLL_THRESHOLD_PX = 40;

function EmptyState(): JSX.Element {
  const { t } = useTranslation("ai");

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
      <AssistantAvatar isLarge />
      <h3 className="text-base font-semibold">{t("panel.emptyTitle")}</h3>
      <p className="max-w-[32ch] text-sm text-muted-foreground">
        {t("panel.emptyBody")}
      </p>
    </div>
  );
}

/**
 * The conversation as a log (spec section 14). The newest message stays in
 * view as text streams in.
 */
export function AiMessageList({
  messages,
  ...actions
}: AiMessageListProps): JSX.Element {
  const { t } = useTranslation("ai");
  const logRef = useRef<HTMLDivElement>(null);
  const isAtEndRef = useRef(true);
  const last = messages.at(-1);
  const isStreaming = last?.role === "assistant" && last.status === "streaming";
  const hasJustSent = last?.role === "user";

  useEffect(() => {
    const log = logRef.current;
    if (log !== null && (isAtEndRef.current || hasJustSent)) {
      log.scrollTop = log.scrollHeight;
    }
  }, [messages, hasJustSent]);

  return (
    <div
      ref={logRef}
      role="log"
      aria-label={t("panel.messagesLabel")}
      // Screen readers wait for the streamed answer instead of reading every
      // frame of it (section 14); the status region outside the window says
      // when it ends.
      aria-busy={isStreaming}
      // eslint-disable-next-line jsx-a11y-x/no-noninteractive-tabindex -- a scrollable region must be keyboard focusable (WCAG 2.1.1)
      tabIndex={0}
      className="min-h-0 flex-1 overflow-y-auto p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      onScroll={(event) => {
        const log = event.currentTarget;
        isAtEndRef.current =
          log.scrollHeight - log.scrollTop - log.clientHeight <=
          FOLLOW_SCROLL_THRESHOLD_PX;
      }}
    >
      {messages.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="flex flex-col">
          {messages.map((message, index) => (
            <MessageRow
              key={message.id}
              message={message}
              isContinuation={messages[index - 1]?.role === message.role}
              isGroupEnd={messages[index + 1]?.role !== message.role}
              isLast={index === messages.length - 1}
              {...actions}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
