import type {
  AiChatRequest,
  AiFindingsData,
  AiLocale,
  AiProposalData,
} from "@schemaforge/api-contract";
import { AI_MAX_USER_MESSAGE_LENGTH } from "@schemaforge/api-contract";
import type { OperationError, Result } from "@schemaforge/core";
import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";

import type { ApiFailure } from "@/lib/api/api-failure";
// Type only: the module itself is loaded with import() (it pulls in `ai`).
import type { AiChatClient, AiChatErrorCode } from "@/lib/api/ai-chat-client";
import type { Logger } from "@/lib/logger";

import {
  INTERNAL_FAILURE,
  consumeStream,
  failedAccumulator,
} from "../lib/ai-turn-accumulator";
import type { Accumulator } from "../lib/ai-turn-accumulator";
import { buildAiChatHistory } from "../lib/build-ai-chat-history";
import type { EditorStore } from "./create-editor-store";

export type AiProposalState =
  "preview" | "accepted" | "discarded" | "stale" | "invalid";
export type AiChatFailure =
  | { readonly kind: "error"; readonly code: AiChatErrorCode }
  | { readonly kind: "http-failure"; readonly failure: ApiFailure };
export type AiUserMessage = {
  readonly id: string;
  readonly role: "user";
  readonly text: string;
  // Epoch milliseconds from the injected clock, shown under the bubble.
  readonly createdAt: number;
};
export type AiAssistantMessage = {
  readonly id: string;
  readonly role: "assistant";
  readonly text: string;
  readonly createdAt: number;
  readonly status: "streaming" | "done" | "stopped" | "failed";
  readonly failure: AiChatFailure | null;
  readonly proposal:
    | (AiProposalData & {
        readonly state: AiProposalState;
      })
    | null;
  readonly findings: AiFindingsData["findings"] | null;
  // Null when the turn had no sample data.
  readonly sampleDataset: unknown;
};
export type AiChatEntry = AiUserMessage | AiAssistantMessage;
export type AiChatState = {
  readonly messages: readonly AiChatEntry[];
  readonly isSending: boolean;
  // The composer's unsent text: it outlives the window, which unmounts.
  readonly draft: string;
};
export type AiChatActions = {
  readonly setDraft: (text: string) => void;
  readonly send: (text: string) => Promise<void>;
  readonly stop: () => void;
  readonly retry: () => Promise<void>;
  readonly reset: () => void;
  readonly acceptProposal: (messageId: string) => Result<void, OperationError>;
  readonly discardProposal: (messageId: string) => void;
};
export type AiChatStore = StoreApi<AiChatState & AiChatActions>;
export type CreateAiChatStoreInput = {
  readonly editor: EditorStore;
  readonly loadClient: () => Promise<AiChatClient | null>;
  readonly getLocale: () => AiLocale;
  readonly generateId: () => string;
  // Epoch milliseconds; stamps each message.
  readonly now: () => number;
  readonly scheduleFrame: (callback: () => void) => number;
  readonly cancelFrame: (handle: number) => void;
  // Called right before a preview starts (AI plan, issue 46).
  readonly beforePreview: () => void;
  readonly logger: Logger;
};

type Turn = { readonly controller: AbortController };

function endedProposalState(
  message: AiAssistantMessage,
): AiAssistantMessage["proposal"] {
  return message.proposal !== null && message.proposal.state !== "accepted"
    ? { ...message.proposal, state: "discarded" }
    : message.proposal;
}

export function createAiChatStore(input: CreateAiChatStoreInput): AiChatStore {
  const { editor, logger } = input;
  let activeTurn: Turn | null = null;

  const store = createStore<AiChatState & AiChatActions>(
    (set, get): AiChatState & AiChatActions => {
      function patchAssistant(
        id: string,
        patch: Partial<AiAssistantMessage>,
      ): void {
        set((state) => ({
          messages: state.messages.map((entry) =>
            entry.role === "assistant" && entry.id === id
              ? { ...entry, ...patch }
              : entry,
          ),
        }));
      }

      function findPreview(messageId: string): AiAssistantMessage | null {
        const message = get().messages.find((entry) => entry.id === messageId);
        return message?.role === "assistant" &&
          message.proposal?.state === "preview" &&
          editor.getState().proposal?.messageId === messageId
          ? message
          : null;
      }

      function setProposalState(id: string, state: AiProposalState): void {
        set((current) => ({
          messages: current.messages.map((entry) =>
            entry.role === "assistant" &&
            entry.id === id &&
            entry.proposal !== null
              ? { ...entry, proposal: { ...entry.proposal, state } }
              : entry,
          ),
        }));
      }

      // Puts the user's side and an empty streaming reply into the state.
      function beginTurn(
        base: readonly AiChatEntry[],
        assistantId: string,
      ): void {
        set({
          isSending: true,
          messages: [
            ...base.map((entry) =>
              entry.role === "assistant"
                ? { ...entry, proposal: endedProposalState(entry) }
                : entry,
            ),
            {
              id: assistantId,
              role: "assistant",
              text: "",
              createdAt: input.now(),
              status: "streaming",
              failure: null,
              proposal: null,
              findings: null,
              sampleDataset: null,
            },
          ],
        });
      }

      // Streams the reply; text reaches the state once per frame (section 15).
      async function readTurn(
        turn: Turn,
        assistantId: string,
        request: AiChatRequest,
      ): Promise<Accumulator> {
        const isCurrent = (): boolean => activeTurn === turn;
        const frame: { handle: number | null; text: string } = {
          handle: null,
          text: "",
        };
        const flush = (): void => {
          frame.handle = null;
          if (isCurrent()) {
            patchAssistant(assistantId, { text: frame.text });
          }
        };
        const onText = (text: string): void => {
          frame.text = text;
          frame.handle ??= input.scheduleFrame(flush);
        };
        let result: Accumulator;
        try {
          const client = await input.loadClient();
          if (client === null) {
            logger.error("ai.chat.no-client");
            result = failedAccumulator(INTERNAL_FAILURE);
          } else {
            result = await consumeStream({
              client,
              request,
              signal: turn.controller.signal,
              logger,
              isCurrent,
              onText,
            });
          }
        } catch (error) {
          logger.error("ai.chat.load-client-failed", {
            name: error instanceof Error ? error.name : "unknown",
          });
          result = failedAccumulator(INTERNAL_FAILURE);
        }
        if (frame.handle !== null) {
          input.cancelFrame(frame.handle);
        }
        return result;
      }

      // Shared body of send and retry: `base` ends with the user message.
      async function runTurn(base: readonly AiChatEntry[]): Promise<void> {
        if (editor.getState().proposal !== null) {
          editor.getState().discardProposal();
        }
        const assistantId = input.generateId();
        const turn: Turn = { controller: new AbortController() };
        activeTurn = turn;
        const request = {
          document: editor.getState().document,
          messages: buildAiChatHistory(base),
          locale: input.getLocale(),
        };
        beginTurn(base, assistantId);
        const result = await readTurn(turn, assistantId, request);
        if (activeTurn !== turn) {
          return;
        }
        activeTurn = null;
        try {
          finishTurn(assistantId, result, turn.controller.signal.aborted);
        } finally {
          set({ isSending: false });
        }
      }

      function finishTurn(
        id: string,
        acc: Accumulator,
        isStopped: boolean,
      ): void {
        const { text, failure, proposal, findings, sampleDataset } = acc;
        if (isStopped) {
          patchAssistant(id, { text, status: "stopped" });
        } else if (failure !== null) {
          patchAssistant(id, { text, status: "failed", failure });
        } else if (proposal === null) {
          patchAssistant(id, { text, status: "done", findings, sampleDataset });
        } else {
          // The document is checked as it is now: the user kept editing while
          // the reply was streaming (AI-R18).
          input.beforePreview();
          const started = editor
            .getState()
            .startProposalPreview(id, proposal.operation);
          patchAssistant(id, {
            text,
            status: "done",
            findings,
            sampleDataset,
            proposal: {
              operation: proposal.operation,
              stoppedEarly: proposal.stoppedEarly,
              state: started.isOk ? "preview" : started.error,
            },
          });
        }
      }

      return {
        messages: [],
        isSending: false,
        draft: "",
        setDraft: (text) => {
          set({ draft: text });
        },
        // Consent to send data is the interface's gate (AI plan, issue 57):
        // the panel offers sending only after the user agreed.
        send: async (text) => {
          if (
            get().isSending ||
            text.trim() === "" ||
            text.length > AI_MAX_USER_MESSAGE_LENGTH
          ) {
            return;
          }
          set({ draft: "" });
          await runTurn([
            ...get().messages,
            {
              id: input.generateId(),
              role: "user",
              text,
              createdAt: input.now(),
            },
          ]);
        },
        stop: () => {
          activeTurn?.controller.abort();
        },
        retry: async () => {
          const { isSending, messages } = get();
          if (isSending || !messages.some((entry) => entry.role === "user")) {
            return;
          }
          const last = messages.at(-1);
          await runTurn(
            last?.role === "assistant" && last.status === "failed"
              ? messages.slice(0, -1)
              : messages,
          );
        },
        reset: () => {
          activeTurn?.controller.abort();
          activeTurn = null;
          if (editor.getState().proposal !== null) {
            editor.getState().discardProposal();
          }
          set({ messages: [], isSending: false, draft: "" });
        },
        acceptProposal: (messageId) => {
          if (findPreview(messageId) === null) {
            throw new Error("acceptProposal called without a live preview");
          }
          const result = editor.getState().acceptProposal();
          setProposalState(messageId, result.isOk ? "accepted" : "discarded");
          return result;
        },
        discardProposal: (messageId) => {
          if (findPreview(messageId) === null) {
            return;
          }
          editor.getState().discardProposal();
          setProposalState(messageId, "discarded");
        },
      };
    },
  );
  return store;
}
