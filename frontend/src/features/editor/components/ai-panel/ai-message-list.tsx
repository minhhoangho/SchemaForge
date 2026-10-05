"use client";

import { TriangleAlertIcon } from "lucide-react";
import type { JSX, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { toApiErrorMessageKey } from "@/lib/api/api-failure";
import { cn } from "@/lib/class-names";

import { useRevealTable } from "../../hooks/use-reveal-table";
import { countProposalChanges } from "../../lib/proposal-display";
import type {
  AiAssistantMessage,
  AiChatEntry,
  AiChatFailure,
} from "../../state/create-ai-chat-store";
import { useEditorStore } from "../../state/use-editor-store";
import { AiFindingsCard } from "./ai-findings-card";
import {
  AssistantAvatar,
  MessageBubble,
  PlainText,
  TypingDots,
} from "./ai-message-bubble";
import { AiProposalCard } from "./ai-proposal-card";
import { AiSampleDataCard } from "./ai-sample-data-card";
import { focusProposalCard } from "./proposal-decision";

export type AiMessageListProps = {
  readonly messages: readonly AiChatEntry[];
  readonly isSending: boolean;
  readonly onSend: (text: string) => void;
  readonly onRetry: () => void;
  readonly onAccept: (messageId: string) => void;
  readonly onDiscard: (messageId: string) => void;
};

const TOO_MANY_REQUESTS_STATUS = 429;

// Within this distance of the end, the log counts as read to the end and
// follows new text; further up, the reader keeps their place.
const FOLLOW_SCROLL_THRESHOLD_PX = 40;

function useFailureText(): (failure: AiChatFailure) => string {
  const { t } = useTranslation("ai");
  const { t: tApiErrors } = useTranslation("apiErrors");

  return (failure) => {
    if (failure.kind === "error") {
      return t(`errors.${failure.code}`);
    }
    const { failure: apiFailure } = failure;
    if (
      apiFailure.kind === "http" &&
      apiFailure.status === TOO_MANY_REQUESTS_STATUS &&
      apiFailure.retryAfterSeconds !== null
    ) {
      return t("errors.rateLimited", { count: apiFailure.retryAfterSeconds });
    }
    return tApiErrors(toApiErrorMessageKey(apiFailure));
  };
}

// What the hidden status region reads for the newest answer (section 14).
function useAnnouncement(messages: readonly AiChatEntry[]): string {
  const { t } = useTranslation("ai");
  const failureText = useFailureText();
  const last = messages.at(-1);
  if (last?.role !== "assistant") {
    return "";
  }
  switch (last.status) {
    case "streaming":
      return t("status.responding");
    case "done":
      return t("status.done");
    case "stopped":
      return t("status.stopped");
    case "failed":
      return last.failure === null ? "" : failureText(last.failure);
  }
}

type ProposalSlotProps = {
  readonly message: AiAssistantMessage;
  readonly proposal: NonNullable<AiAssistantMessage["proposal"]>;
} & Pick<AiMessageListProps, "onAccept" | "onDiscard" | "onRetry">;

function ProposalSlot({
  message,
  proposal,
  onAccept,
  onDiscard,
  onRetry,
}: ProposalSlotProps): JSX.Element {
  const editorProposal = useEditorStore((state) => state.proposal);
  const current =
    editorProposal?.messageId === message.id ? editorProposal : null;
  // A card whose preview the editor no longer holds (a newer turn, a cloud
  // reload) is over; its buttons would throw in the store (AI plan, issue 27).
  const status =
    proposal.state === "preview" && current === null
      ? "discarded"
      : proposal.state;

  return (
    <AiProposalCard
      messageId={message.id}
      status={status}
      hasStoppedEarly={proposal.stoppedEarly}
      counts={
        status === "preview" && current !== null
          ? countProposalChanges(current)
          : null
      }
      onAccept={() => {
        onAccept(message.id);
        focusProposalCard(message.id);
      }}
      onDiscard={() => {
        onDiscard(message.id);
        focusProposalCard(message.id);
      }}
      onRetry={onRetry}
    />
  );
}

type FailureNoticeProps = {
  readonly failure: AiChatFailure;
  readonly canRetry: boolean;
  readonly isSending: boolean;
  readonly onRetry: () => void;
};

function FailureNotice({
  failure,
  canRetry,
  isSending,
  onRetry,
}: FailureNoticeProps): JSX.Element {
  const { t } = useTranslation("ai");
  const failureText = useFailureText();

  return (
    <div className="flex items-start gap-2 rounded-lg border border-l-[3px] border-border border-l-destructive bg-background p-2">
      <TriangleAlertIcon
        aria-hidden
        className="mt-0.5 size-4 text-destructive"
      />
      <div className="flex min-w-0 flex-col items-start gap-2">
        <p className="text-[0.8125rem] leading-[1.125rem] font-medium">
          {failureText(failure)}
        </p>
        {canRetry ? (
          <Button
            variant="outline"
            size="sm"
            disabled={isSending}
            onClick={onRetry}
          >
            {t("errors.retry")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

type MessageRowProps = {
  readonly sender: "user" | "assistant";
  // The previous message has the same sender: same group.
  readonly isContinuation: boolean;
  readonly children: (sentAt: Date) => ReactNode;
};

// Consecutive messages of one sender form a group: tight gap, the avatar
// once, the tail corner on the first bubble only.
function MessageRow({
  sender,
  isContinuation,
  children,
}: MessageRowProps): JSX.Element {
  const { t } = useTranslation("ai");
  // Messages carry no time, so a row stamps the moment it first appears.
  const [sentAt] = useState(() => new Date());
  const isUser = sender === "user";

  return (
    <li
      className={cn(
        "group/msg flex gap-2 first:mt-0",
        isContinuation ? "mt-0.5" : "mt-4",
        isUser && "justify-end",
      )}
    >
      {isUser ? null : isContinuation ? (
        <span aria-hidden className="size-7 shrink-0" />
      ) : (
        <AssistantAvatar />
      )}
      <div
        className={cn(
          "flex min-w-0 flex-col gap-1.5",
          isUser ? "flex-[0_1_85%] items-end" : "flex-1",
        )}
      >
        <span className="sr-only">
          {t(isUser ? "panel.userMessage" : "panel.assistantMessage")}
        </span>
        {children(sentAt)}
      </div>
    </li>
  );
}

type AssistantMessageProps = Omit<AiMessageListProps, "messages"> & {
  readonly message: AiAssistantMessage;
  readonly isLast: boolean;
  readonly hasTail: boolean;
  readonly sentAt: Date;
};

function AssistantMessage({
  message,
  isLast,
  hasTail,
  sentAt,
  ...actions
}: AssistantMessageProps): JSX.Element {
  const { t } = useTranslation("ai");
  const revealTable = useRevealTable();
  const isFailed = message.status === "failed";
  const isStreaming = message.status === "streaming";

  return (
    <>
      {message.text === "" ? (
        isStreaming ? (
          <MessageBubble sender="assistant" hasTail={hasTail} sentAt={sentAt}>
            <TypingDots />
          </MessageBubble>
        ) : null
      ) : (
        // Text streamed before a failure stays visible but muted, so it never
        // reads as a finished answer (AI security review, L2).
        <MessageBubble
          sender="assistant"
          hasTail={hasTail}
          isMuted={isFailed}
          sentAt={sentAt}
        >
          <PlainText text={message.text} hasCaret={isStreaming} />
        </MessageBubble>
      )}
      {message.status === "stopped" ? (
        <p className="text-xs text-muted-foreground">{t("status.stopped")}</p>
      ) : null}
      {isFailed && message.failure !== null ? (
        <FailureNotice
          failure={message.failure}
          canRetry={isLast}
          isSending={actions.isSending}
          onRetry={actions.onRetry}
        />
      ) : null}
      {message.proposal === null ? null : (
        <ProposalSlot
          message={message}
          proposal={message.proposal}
          {...actions}
        />
      )}
      {message.findings === null ? null : (
        <AiFindingsCard
          findings={message.findings}
          isDisabled={actions.isSending}
          onApply={actions.onSend}
          onRevealTarget={(target) => {
            revealTable(target.tableId);
          }}
        />
      )}
      {message.sampleDataset === null ? null : (
        <AiSampleDataCard
          dataset={message.sampleDataset}
          onRetry={actions.onRetry}
        />
      )}
    </>
  );
}

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
  const announcement = useAnnouncement(messages);
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
    <>
      <div
        ref={logRef}
        role="log"
        aria-label={t("panel.messagesLabel")}
        // Screen readers wait for the streamed answer instead of reading
        // every frame of it (section 14); the status below says when it ends.
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
            {messages.map((message, index) => {
              const isContinuation = messages[index - 1]?.role === message.role;
              return (
                <MessageRow
                  key={message.id}
                  sender={message.role}
                  isContinuation={isContinuation}
                >
                  {(sentAt) =>
                    message.role === "user" ? (
                      <MessageBubble
                        sender="user"
                        hasTail={!isContinuation}
                        sentAt={sentAt}
                      >
                        <PlainText text={message.text} />
                      </MessageBubble>
                    ) : (
                      <AssistantMessage
                        message={message}
                        isLast={index === messages.length - 1}
                        hasTail={!isContinuation}
                        sentAt={sentAt}
                        {...actions}
                      />
                    )
                  }
                </MessageRow>
              );
            })}
          </ul>
        )}
      </div>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </>
  );
}
