"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { JSX, RefObject } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAiChatTransport, useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { buildAuthHref } from "@/lib/auth/sanitize-return-to";

import { useAiChatStore } from "../../state/ai-chat-store-provider";
import { useEditorStore } from "../../state/use-editor-store";
import { AiComposer } from "./ai-composer";
import { AiConsent, readAiConsent } from "./ai-consent";
import { AiMessageList } from "./ai-message-list";
import { AiPanelHeader } from "./ai-panel-header";
import { AiQuickActions } from "./ai-quick-actions";
import { closeToLauncher } from "./close-to-launcher";
import { useCloseOnEscape } from "./use-close-on-escape";
import { useFocusBodyOnReopen } from "./use-focus-body-on-reopen";
import { MinimizedProposalActions } from "./minimized-proposal-actions";
import { acceptSafely } from "./proposal-decision";

function GuestInvitation(): JSX.Element {
  const { t } = useTranslation("ai");
  const pathname = usePathname();
  const linkRef = useRef<HTMLAnchorElement>(null);

  // The panel just opened (or the session ended): the link is the only
  // thing to do here.
  useEffect(() => {
    linkRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col items-start gap-3 p-3">
      <h3 className="text-sm font-semibold">{t("panel.guestTitle")}</h3>
      <p className="text-sm">{t("panel.guestBody")}</p>
      <Button asChild>
        <Link ref={linkRef} href={buildAuthHref("/sign-in", pathname)}>
          {t("panel.signInLink")}
        </Link>
      </Button>
    </div>
  );
}

/**
 * When a turn ends, the Stop button turns back into a Send button that is
 * disabled while the field is empty, so focus would fall to the page. It
 * returns to the field then, but never leaves a place the user chose.
 */
function useFocusComposerAfterTurn(
  isSending: boolean,
  inputRef: RefObject<HTMLTextAreaElement | null>,
): void {
  const wasSendingRef = useRef(isSending);

  useEffect(() => {
    const hasTurnEnded = wasSendingRef.current && !isSending;
    wasSendingRef.current = isSending;
    if (!hasTurnEnded) {
      return;
    }
    const active = document.activeElement;
    const isFocusLost =
      active === null ||
      active === document.body ||
      (active instanceof HTMLButtonElement && active.disabled);
    if (isFocusLost) {
      inputRef.current?.focus();
    }
  }, [isSending, inputRef]);
}

function Conversation({
  inputRef,
}: {
  readonly inputRef: RefObject<HTMLTextAreaElement | null>;
}): JSX.Element {
  const messages = useAiChatStore((state) => state.messages);
  const isSending = useAiChatStore((state) => state.isSending);
  const send = useAiChatStore((state) => state.send);
  const stop = useAiChatStore((state) => state.stop);
  const retry = useAiChatStore((state) => state.retry);
  const acceptProposal = useAiChatStore((state) => state.acceptProposal);
  const discardProposal = useAiChatStore((state) => state.discardProposal);
  const draft = useAiChatStore((state) => state.draft);
  const setDraft = useAiChatStore((state) => state.setDraft);
  // The store turns every failure into a failed message, so nothing is
  // left to handle here. Stable, so memoized message rows skip re-rendering
  // while the answer streams.
  const sendText = useCallback(
    (text: string): void => {
      void send(text);
    },
    [send],
  );
  const retryLast = useCallback((): void => {
    void retry();
  }, [retry]);
  const accept = useCallback(
    (messageId: string): void => {
      acceptSafely(() => {
        acceptProposal(messageId);
      });
    },
    [acceptProposal],
  );
  useFocusComposerAfterTurn(isSending, inputRef);

  return (
    <>
      <AiMessageList
        messages={messages}
        isSending={isSending}
        onSend={sendText}
        onRetry={retryLast}
        onAccept={accept}
        onDiscard={discardProposal}
      />
      <div className="flex flex-col gap-3 border-t border-border p-3">
        <AiQuickActions
          variant={messages.length === 0 ? "large" : "compact"}
          isDisabled={isSending}
          onSend={sendText}
        />
        <AiComposer
          draft={draft}
          onDraftChange={setDraft}
          isSending={isSending}
          onSend={sendText}
          onStop={stop}
          inputRef={inputRef}
        />
      </div>
    </>
  );
}

/**
 * The consent gate (AI-R61) in front of the conversation. Nothing can send
 * before it: the store does not check consent (AI plan, issue 57). Keyed by
 * user, so another account reads its own consent.
 */
function SignedInBody({ userId }: { readonly userId: string }): JSX.Element {
  const [hasConsent, setHasConsent] = useState(() => readAiConsent(userId));
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const consentRef = useRef<HTMLDivElement>(null);

  // Opening the panel, or agreeing, lands on the next thing to do (spec
  // section 14); agreeing removes the focused button.
  useEffect(() => {
    if (hasConsent) {
      inputRef.current?.focus();
      return;
    }
    consentRef.current?.querySelector("button")?.focus();
  }, [hasConsent]);

  if (!hasConsent) {
    return (
      <div ref={consentRef} className="p-3">
        <AiConsent
          userId={userId}
          onAccepted={() => {
            setHasConsent(true);
          }}
        />
      </div>
    );
  }
  return <Conversation inputRef={inputRef} />;
}

function AiPanelBody(): JSX.Element | null {
  const { t } = useTranslation("ai");
  const auth = useAuth((state) => state.auth);
  const transport = useAiChatTransport();

  switch (auth.status) {
    case "unknown":
      return null;
    case "signed-out":
    case "expired":
      return <GuestInvitation />;
    case "signed-in":
      return transport === null ? (
        <p className="p-3 text-sm">{t("panel.unavailable")}</p>
      ) : (
        <SignedInBody key={auth.user.id} userId={auth.user.id} />
      );
  }
}

export type AiPanelProps = {
  // Below 640px the window is a full-screen sheet and cannot expand.
  readonly isNarrow: boolean;
};

/**
 * The AI assistant's floating window (AI-R1, AI-R51): non-modal, so the
 * canvas stays usable behind it, except as a full-screen sheet below 640px,
 * where the workspace makes the rest of the page inert. Escape closes it and
 * focus returns to the launcher; the conversation lives in the store above,
 * so closing keeps it.
 */
export function AiPanel({ isNarrow }: AiPanelProps): JSX.Element {
  const { t } = useTranslation("ai");
  const titleId = useId();
  const minimizeRef = useRef<HTMLButtonElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const decidedTimeoutRef = useRef<number | undefined>(undefined);
  const isOpen = useEditorStore((state) => state.aiWindow.isOpen);
  const isMinimized = useEditorStore((state) => state.aiWindow.isMinimized);
  const closeAiWindow = useEditorStore((state) => state.closeAiWindow);
  useCloseOnEscape(sectionRef, closeAiWindow);
  useFocusBodyOnReopen(isOpen, bodyRef);
  useEffect(
    () => () => {
      window.clearTimeout(decidedTimeoutRef.current);
    },
    [],
  );

  return (
    <section
      ref={sectionRef}
      role="dialog"
      aria-modal={isNarrow && !isMinimized ? "true" : "false"}
      aria-labelledby={titleId}
      className="flex size-full min-h-0 flex-col"
    >
      <AiPanelHeader
        titleId={titleId}
        isNarrow={isNarrow}
        minimizeRef={minimizeRef}
        onClose={() => {
          closeToLauncher(closeAiWindow);
        }}
      />
      {isMinimized && (
        <MinimizedProposalActions
          onDecided={() => {
            // A task later, as in focusProposalCard: the confirm dialog's
            // focus trap would pull focus back while it is still mounted.
            decidedTimeoutRef.current = window.setTimeout(() => {
              minimizeRef.current?.focus();
            }, 0);
          }}
        />
      )}
      {/* Hidden, not unmounted, while minimized. */}
      <div
        ref={bodyRef}
        hidden={isMinimized}
        className="flex min-h-0 flex-1 flex-col"
      >
        <p className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
          {t("panel.dataNotice")}
        </p>
        <div className="flex min-h-0 flex-1 flex-col">
          <AiPanelBody />
        </div>
      </div>
    </section>
  );
}
