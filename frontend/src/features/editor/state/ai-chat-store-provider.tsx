"use client";

import type { AiLocale } from "@schemaforge/api-contract";
import type { JSX, ReactNode } from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";

import { useAiChatTransport, useAuth } from "@/components/auth-provider";
import type { AiChatClient, AiChatTransport } from "@/lib/api/ai-chat-client";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/supported-locales";
import { logger } from "@/lib/logger";

import { createAiChatStore } from "./create-ai-chat-store";
import type {
  AiChatActions,
  AiChatState,
  AiChatStore,
} from "./create-ai-chat-store";
import { useEditorStoreApi } from "./use-editor-store";

// Task 27b puts this on the wrappers of the left panel and the properties
// panel, whose fields commit their text on blur.
export const AI_COMMIT_ON_PREVIEW_ATTRIBUTE = "data-ai-commit-on-preview";

const AiChatStoreContext = createContext<AiChatStore | null>(null);

/**
 * Blurs the focused field when it sits in a commit-on-preview region, so its
 * text is committed before the preview locks the editor (AI plan, issue 46).
 * Focus anywhere else, such as the AI panel, stays where it is.
 */
export function commitPendingEdits(): void {
  const active = document.activeElement;
  if (
    active instanceof HTMLElement &&
    active.closest(`[${AI_COMMIT_ON_PREVIEW_ATTRIBUTE}]`) !== null
  ) {
    active.blur();
  }
}

async function loadAiChatClient(
  transport: AiChatTransport | null,
): Promise<AiChatClient | null> {
  if (transport === null) {
    return null;
  }
  // Dynamic: the module pulls in the AI SDK, which stays out of the initial
  // editor bundle (AI plan, issue 26).
  const { createAiChatClient } = await import("@/lib/api/ai-chat-client");
  return createAiChatClient(transport);
}

export function AiChatStoreProvider({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  const editor = useEditorStoreApi();
  const transport = useAiChatTransport();
  const { i18n } = useTranslation();
  const userId = useAuth((auth) =>
    auth.auth.status === "signed-in" ? auth.auth.user.id : null,
  );
  const transportRef = useRef(transport);
  const languageRef = useRef(i18n.language);
  useEffect(() => {
    transportRef.current = transport;
    languageRef.current = i18n.language;
  });

  const [store] = useState(() =>
    createAiChatStore({
      editor,
      loadClient: () => loadAiChatClient(transportRef.current),
      getLocale: (): AiLocale =>
        isLocale(languageRef.current) ? languageRef.current : DEFAULT_LOCALE,
      generateId: () => crypto.randomUUID(),
      now: () => Date.now(),
      scheduleFrame: (callback) => requestAnimationFrame(callback),
      cancelFrame: (handle) => {
        cancelAnimationFrame(handle);
      },
      beforePreview: commitPendingEdits,
      logger,
    }),
  );

  // The conversation belongs to the account (AI-R46): signing out does not
  // leave the editor, so this is the only place that clears it.
  const previousUserId = useRef(userId);
  useEffect(() => {
    if (previousUserId.current !== null && previousUserId.current !== userId) {
      store.getState().reset();
    }
    previousUserId.current = userId;
  }, [store, userId]);

  useEffect(
    () => () => {
      store.getState().reset();
    },
    [store],
  );

  return <AiChatStoreContext value={store}>{children}</AiChatStoreContext>;
}

export function useAiChatStoreApi(): AiChatStore {
  const store = useContext(AiChatStoreContext);
  if (store === null) {
    throw new Error(
      "useAiChatStore must be used inside an AiChatStoreProvider.",
    );
  }
  return store;
}

export function useAiChatStore<Slice>(
  selector: (state: AiChatState & AiChatActions) => Slice,
): Slice {
  return useStore(useAiChatStoreApi(), selector);
}
