"use client";

import type { JSX } from "react";
import { useEffect, useRef } from "react";
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

// AI text is a plain text node: no Markdown, no HTML (AI-R52).
const MESSAGE_TEXT_CLASS_NAME = "whitespace-pre-wrap [overflow-wrap:anywhere]";

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
    <div className="flex flex-col items-start gap-2 rounded-md border border-destructive p-2">
      <p className="text-sm font-medium">{failureText(failure)}</p>
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
  );
}

type AssistantMessageProps = Omit<AiMessageListProps, "messages"> & {
  readonly message: AiAssistantMessage;
  readonly isLast: boolean;
};

function AssistantMessage({
  message,
  isLast,
  ...actions
}: AssistantMessageProps): JSX.Element {
  const { t } = useTranslation("ai");
  const revealTable = useRevealTable();
  const isFailed = message.status === "failed";

  return (
    <li className="flex flex-col gap-2">
      <span className="sr-only">{t("panel.assistantMessage")}</span>
      {message.text === "" ? null : (
        // Text streamed before a failure stays visible but muted, so it never
        // reads as a finished answer (AI security review, L2).
        <p
          className={cn(
            MESSAGE_TEXT_CLASS_NAME,
            "text-sm",
            isFailed && "text-muted-foreground",
          )}
        >
          {message.text}
        </p>
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
    </li>
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
        <ul className="flex flex-col gap-4">
          {messages.map((message, index) =>
            message.role === "user" ? (
              <li
                key={message.id}
                className="ml-auto max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm"
              >
                <span className="sr-only">{t("panel.userMessage")}</span>
                <p className={MESSAGE_TEXT_CLASS_NAME}>{message.text}</p>
              </li>
            ) : (
              <AssistantMessage
                key={message.id}
                message={message}
                isLast={index === messages.length - 1}
                {...actions}
              />
            ),
          )}
        </ul>
      </div>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </>
  );
}
