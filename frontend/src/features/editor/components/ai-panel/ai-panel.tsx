"use client";

import {
  ChevronUpIcon,
  Maximize2Icon,
  Minimize2Icon,
  MinusIcon,
  SquarePenIcon,
  XIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { JSX, Ref, RefObject } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAiChatTransport, useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { buildAuthHref } from "@/lib/auth/sanitize-return-to";

import { useAiChatStore } from "../../state/ai-chat-store-provider";
import { useEditorStore } from "../../state/use-editor-store";
import { AiComposer } from "./ai-composer";
import { AiConsent, readAiConsent } from "./ai-consent";
import { AiMessageList } from "./ai-message-list";
import { AI_LAUNCHER_ID } from "./ai-panel-ids";
import { AiQuickActions } from "./ai-quick-actions";
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

// Focus goes back to the launcher, which stays while the window leaves.
function closeWindow(closeAiWindow: () => void): void {
  closeAiWindow();
  document.getElementById(AI_LAUNCHER_ID)?.focus();
}

type HeaderButtonProps = {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly onClick: () => void;
  readonly buttonRef?: Ref<HTMLButtonElement>;
};

// Icon-only, named by aria-label. No tooltip: Escape on it would also close
// the window.
function HeaderButton({
  label,
  icon: Icon,
  onClick,
  buttonRef,
}: HeaderButtonProps): JSX.Element {
  return (
    <Button
      ref={buttonRef}
      variant="ghost"
      size="icon"
      aria-label={label}
      onClick={onClick}
    >
      <Icon aria-hidden />
    </Button>
  );
}

export type AiPanelProps = {
  readonly id: string;
  // Below 640px the window is a full-screen sheet and cannot expand.
  readonly isNarrow: boolean;
};

/**
 * The AI assistant's floating, non-modal window (AI-R1, AI-R51): the canvas
 * stays usable behind it. Escape closes it and focus returns to the
 * launcher; the conversation lives in the store above, so closing keeps it.
 */
export function AiPanel({ id, isNarrow }: AiPanelProps): JSX.Element {
  const { t } = useTranslation("ai");
  const titleId = useId();
  const minimizeRef = useRef<HTMLButtonElement>(null);
  const reset = useAiChatStore((state) => state.reset);
  const isMinimized = useEditorStore((state) => state.aiWindow.isMinimized);
  const isExpanded = useEditorStore((state) => state.aiWindow.isExpanded);
  const closeAiWindow = useEditorStore((state) => state.closeAiWindow);
  const toggleMinimized = useEditorStore(
    (state) => state.toggleAiWindowMinimized,
  );
  const toggleExpanded = useEditorStore(
    (state) => state.toggleAiWindowExpanded,
  );

  const sectionRef = useRef<HTMLElement>(null);
  const close = (): void => {
    closeWindow(closeAiWindow);
  };

  // A native listener: keys from a portal opened inside (the confirm dialog,
  // which handles its own Escape) do not reach it, unlike React's bubbling.
  useEffect(() => {
    const section = sectionRef.current;
    if (section === null) {
      return;
    }
    function handleKeyDown(event: globalThis.KeyboardEvent): void {
      if (event.key === "Escape" && !event.defaultPrevented) {
        closeWindow(closeAiWindow);
      }
    }
    section.addEventListener("keydown", handleKeyDown);
    return () => {
      section.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeAiWindow]);

  return (
    <section
      ref={sectionRef}
      id={id}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className="flex size-full min-h-0 flex-col"
    >
      <div className="flex items-center gap-1 border-b border-border py-1 pr-1 pl-3">
        <h2 id={titleId} className="mr-auto text-sm font-semibold">
          {t("panel.title")}
        </h2>
        <HeaderButton
          label={t("panel.newConversation")}
          icon={SquarePenIcon}
          onClick={reset}
        />
        <HeaderButton
          label={isMinimized ? t("panel.restore") : t("panel.minimize")}
          icon={isMinimized ? ChevronUpIcon : MinusIcon}
          onClick={toggleMinimized}
          buttonRef={minimizeRef}
        />
        {!isNarrow && (
          <HeaderButton
            label={isExpanded ? t("panel.shrink") : t("panel.expand")}
            icon={isExpanded ? Minimize2Icon : Maximize2Icon}
            onClick={toggleExpanded}
          />
        )}
        <HeaderButton label={t("panel.close")} icon={XIcon} onClick={close} />
      </div>
      {isMinimized && (
        <MinimizedProposalActions
          onDecided={() => {
            // A task later, as in focusProposalCard: the confirm dialog's
            // focus trap would pull focus back while it is still mounted.
            window.setTimeout(() => {
              minimizeRef.current?.focus();
            }, 0);
          }}
        />
      )}
      {/* Hidden, not unmounted, while minimized, so the draft stays. */}
      <div hidden={isMinimized} className="flex min-h-0 flex-1 flex-col">
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
