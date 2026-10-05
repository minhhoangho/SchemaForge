"use client";

import { TriangleAlertIcon } from "lucide-react";
import type { JSX } from "react";
import { memo } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
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
import { AI_SMALL_TEXT_CLASS_NAME } from "./ai-text-styles";
import { focusProposalCard } from "./proposal-decision";
import { useAiFailureText } from "./use-ai-failure-text";

export type MessageActions = {
  readonly isSending: boolean;
  readonly onSend: (text: string) => void;
  readonly onRetry: () => void;
  readonly onAccept: (messageId: string) => void;
  readonly onDiscard: (messageId: string) => void;
};

const timeFormats = new Map<string, Intl.DateTimeFormat>();

// One formatter per language: rows re-render while an answer streams.
function formatTime(createdAt: number, language: string): string {
  let format = timeFormats.get(language);
  if (format === undefined) {
    format = new Intl.DateTimeFormat(language, {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    timeFormats.set(language, format);
  }
  return format.format(createdAt);
}

type ProposalSlotProps = {
  readonly message: AiAssistantMessage;
  readonly proposal: NonNullable<AiAssistantMessage["proposal"]>;
} & Pick<MessageActions, "onAccept" | "onDiscard" | "onRetry">;

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
  const failureText = useAiFailureText();

  return (
    <div className="flex items-start gap-2 rounded-lg border border-l-[3px] border-border border-l-destructive bg-background p-2">
      <TriangleAlertIcon
        aria-hidden
        className="mt-0.5 size-4 text-destructive"
      />
      <div className="flex min-w-0 flex-col items-start gap-2">
        <p className={cn(AI_SMALL_TEXT_CLASS_NAME, "font-medium")}>
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

type AssistantMessageProps = MessageActions & {
  readonly message: AiAssistantMessage;
  readonly isLast: boolean;
  readonly hasTail: boolean;
};

function AssistantMessage({
  message,
  isLast,
  hasTail,
  ...actions
}: AssistantMessageProps): JSX.Element {
  const { t } = useTranslation("ai");
  const revealTable = useRevealTable();
  const isFailed = message.status === "failed";
  const isStreaming = message.status === "streaming";
  const hasText = message.text !== "";

  return (
    <>
      {isStreaming && !hasText ? (
        <MessageBubble sender="assistant" hasTail={hasTail}>
          <TypingDots />
        </MessageBubble>
      ) : null}
      {hasText ? (
        // Text streamed before a failure stays visible but muted, so it never
        // reads as a finished answer (AI security review, L2).
        <MessageBubble sender="assistant" hasTail={hasTail} isMuted={isFailed}>
          <PlainText text={message.text} hasCaret={isStreaming} />
        </MessageBubble>
      ) : null}
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

type MessageRowProps = MessageActions & {
  readonly message: AiChatEntry;
  // The previous message has the same sender: same group.
  readonly isContinuation: boolean;
  // The next message has another sender (or there is none): the group's
  // time goes under this one.
  readonly isGroupEnd: boolean;
  readonly isLast: boolean;
};

/**
 * One message. Consecutive messages of one sender form a group: tight gap,
 * the avatar once, the tail corner on the first bubble, the time under the
 * last, always shown so it reads on touch and with a keyboard. Memoized:
 * while an answer streams, only its own row re-renders.
 */
export const MessageRow = memo(function MessageRow({
  message,
  isContinuation,
  isGroupEnd,
  isLast,
  ...actions
}: MessageRowProps): JSX.Element {
  const { t, i18n } = useTranslation("ai");
  const isUser = message.role === "user";

  return (
    <li
      className={cn(
        "flex gap-2 first:mt-0",
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
        {message.role === "user" ? (
          <MessageBubble sender="user" hasTail={!isContinuation}>
            <PlainText text={message.text} />
          </MessageBubble>
        ) : (
          <AssistantMessage
            message={message}
            isLast={isLast}
            hasTail={!isContinuation}
            {...actions}
          />
        )}
        {isGroupEnd ? (
          <time
            dateTime={new Date(message.createdAt).toISOString()}
            className="text-xs text-muted-foreground"
          >
            {formatTime(message.createdAt, i18n.language)}
          </time>
        ) : null}
      </div>
    </li>
  );
});
