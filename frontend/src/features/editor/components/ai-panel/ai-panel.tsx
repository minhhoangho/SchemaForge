"use client";

import { XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { JSX, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAiChatTransport, useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { buildAuthHref } from "@/lib/auth/sanitize-return-to";

import { useAiChatStore } from "../../state/ai-chat-store-provider";
import { useEditorStore } from "../../state/use-editor-store";
import { AiComposer } from "./ai-composer";
import { AiConsent, readAiConsent } from "./ai-consent";
import { AiMessageList } from "./ai-message-list";
import { AI_PANEL_TOGGLE_ID } from "./ai-panel-ids";
import { AiQuickActions } from "./ai-quick-actions";
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
  // The store turns every failure into a failed message, so nothing is
  // left to handle here.
  const sendText = (text: string): void => {
    void send(text);
  };
  const retryLast = (): void => {
    void retry();
  };
  useFocusComposerAfterTurn(isSending, inputRef);

  return (
    <>
      <AiMessageList
        messages={messages}
        isSending={isSending}
        onSend={sendText}
        onRetry={retryLast}
        onAccept={(messageId) => {
          acceptSafely(() => {
            acceptProposal(messageId);
          });
        }}
        onDiscard={discardProposal}
      />
      <div className="flex flex-col gap-3 border-t border-border p-3">
        {messages.length === 0 ? (
          <AiQuickActions isDisabled={isSending} onSend={sendText} />
        ) : null}
        <AiComposer
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

/**
 * The AI assistant in the right column (AI-R1, AI-R51). The conversation
 * lives in the store above the panel, so closing the panel keeps it.
 */
export function AiPanel({ id }: { readonly id: string }): JSX.Element {
  const { t } = useTranslation("ai");
  const reset = useAiChatStore((state) => state.reset);
  const setRightPanelMode = useEditorStore((state) => state.setRightPanelMode);

  function close(): void {
    setRightPanelMode("properties");
    // The toggle stays mounted in the toolbar while the panel goes away.
    document.getElementById(AI_PANEL_TOGGLE_ID)?.focus();
  }

  return (
    <section
      id={id}
      tabIndex={-1}
      aria-label={t("panel.title")}
      className="flex h-full min-h-0 w-80 shrink-0 flex-col border-l border-border bg-background outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
    >
      <div className="flex items-center gap-1 border-b border-border py-1 pr-1 pl-3">
        <h2 className="mr-auto text-sm font-semibold">{t("panel.title")}</h2>
        <Button variant="ghost" size="sm" onClick={reset}>
          {t("panel.newConversation")}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("panel.close")}
          onClick={close}
        >
          <XIcon aria-hidden />
        </Button>
      </div>
      <p className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
        {t("panel.dataNotice")}
      </p>
      <div className="flex min-h-0 flex-1 flex-col">
        <AiPanelBody />
      </div>
    </section>
  );
}
