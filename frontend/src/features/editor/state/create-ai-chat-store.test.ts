import type { AiChatRequest } from "@schemaforge/api-contract";
import { parseApiErrorBody } from "@schemaforge/api-contract";
import type { Operation, SchemaDocument } from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeTable,
} from "@schemaforge/core/testing";
import { describe, expect, it, vi } from "vitest";

import type { AiChatClient, AiChatEvent } from "@/lib/api/ai-chat-client";
import type { ApiFailure } from "@/lib/api/api-failure";
import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";

import { AI_MAX_STREAMED_TEXT_LENGTH } from "../lib/ai-turn-accumulator";
import { createAiChatStore } from "./create-ai-chat-store";
import type { AiAssistantMessage, AiChatStore } from "./create-ai-chat-store";
import { createEditorStore } from "./create-editor-store";

const addEmail: Operation = {
  type: "addColumn",
  column: makeColumn({ id: "col_email", tableId: "tbl_users", name: "email" }),
  insertAt: 1,
};
const addColumnProposal = { operation: addEmail, stoppedEarly: false };
const START_TIME = Date.UTC(2026, 9, 5, 9, 30);

function createDocument(): SchemaDocument {
  return buildSchema({
    name: "shop",
    tables: [makeTable({ id: "tbl_users", name: "users" })],
    columns: [makeColumn({ id: "col_id", tableId: "tbl_users", name: "id" })],
  });
}

type Script = (signal: AbortSignal) => AsyncIterable<AiChatEvent>;

function events(list: readonly AiChatEvent[]): Script {
  return async function* run() {
    await Promise.resolve();
    yield* list;
  };
}

// Yields the given events, then waits until the request is aborted.
function hanging(list: readonly AiChatEvent[]): Script {
  return async function* run(signal) {
    await Promise.resolve();
    yield* list;
    await new Promise<void>((resolve) => {
      if (signal.aborted) {
        resolve();
      }
      signal.addEventListener("abort", () => {
        resolve();
      });
    });
  };
}

function createHarness(scripts: readonly Script[] = []) {
  const editor = createEditorStore({
    schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    document: createDocument(),
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
  const requests: AiChatRequest[] = [];
  let call = 0;
  const client: AiChatClient = {
    stream: (request, { signal }) => {
      requests.push(request);
      const script = scripts[call] ?? events([]);
      call += 1;
      return script(signal);
    },
  };
  const frames = new Map<number, () => void>();
  let nextFrame = 1;
  const scheduleFrame = vi.fn((callback: () => void) => {
    const handle = nextFrame;
    nextFrame += 1;
    frames.set(handle, callback);
    return handle;
  });
  const cancelFrame = vi.fn((handle: number) => {
    frames.delete(handle);
  });
  const beforePreview = vi.fn<() => void>();
  const logger = {
    error: vi.fn<Logger["error"]>(),
    warn: vi.fn<Logger["warn"]>(),
  };
  const loadClient = vi.fn(() => Promise.resolve<AiChatClient | null>(client));
  const clock = { now: START_TIME };
  const store: AiChatStore = createAiChatStore({
    editor,
    loadClient,
    getLocale: () => "vi",
    generateId: createCounterIdGenerator(),
    now: () => clock.now,
    scheduleFrame,
    cancelFrame,
    beforePreview,
    logger,
  });
  const runFrames = (): void => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => {
      callback();
    });
  };
  return {
    editor,
    store,
    clock,
    requests,
    scheduleFrame,
    cancelFrame,
    runFrames,
    beforePreview,
    loadClient,
    logger,
  };
}

function lastAssistant(store: AiChatStore): AiAssistantMessage {
  const message = store.getState().messages.at(-1);
  if (message?.role !== "assistant") {
    throw new Error("expected an assistant message");
  }
  return message;
}

describe("createAiChatStore", () => {
  it("stamps each message with the injected clock", async () => {
    const { store, clock } = createHarness([
      async function* run() {
        await Promise.resolve();
        clock.now = START_TIME + 60_000;
        yield { kind: "text", text: "hi" } as const;
      },
    ]);

    await store.getState().send("hello");

    expect(store.getState().messages.map((entry) => entry.createdAt)).toEqual([
      START_TIME,
      START_TIME,
    ]);
  });

  it("keeps the draft until a message is sent", async () => {
    const { store } = createHarness([events([])]);

    store.getState().setDraft("add a ta");
    expect(store.getState().draft).toBe("add a ta");

    await store.getState().send("add a table");
    expect(store.getState().draft).toBe("");
  });

  it("keeps the draft when sending is refused", async () => {
    const { store } = createHarness();
    store.getState().setDraft("   ");

    await store.getState().send("   ");

    expect(store.getState().draft).toBe("   ");
  });

  it("clears the draft on a new conversation", () => {
    const { store } = createHarness();
    store.getState().setDraft("half written");

    store.getState().reset();

    expect(store.getState().draft).toBe("");
  });

  it("sends the current document, the history and the locale", async () => {
    const { store, editor, requests } = createHarness([events([])]);

    await store.getState().send("add a table");

    expect(requests).toEqual([
      {
        document: editor.getState().document,
        messages: [{ role: "user", text: "add a table" }],
        locale: "vi",
      },
    ]);
  });

  it("shows streamed text once per frame", async () => {
    const { store, scheduleFrame, runFrames, cancelFrame } = createHarness([
      hanging([
        { kind: "text", text: "He" },
        { kind: "text", text: "Hello" },
      ]),
    ]);

    const sending = store.getState().send("hi");
    await vi.waitFor(() => {
      expect(scheduleFrame).toHaveBeenCalledTimes(1);
    });
    expect(lastAssistant(store).text).toBe("");
    runFrames();
    expect(lastAssistant(store).text).toBe("Hello");

    store.getState().stop();
    await sending;
    expect(cancelFrame).not.toHaveBeenCalled();
    expect(lastAssistant(store).status).toBe("stopped");
  });

  it("writes the final text at once and cancels a pending frame", async () => {
    const { store, cancelFrame } = createHarness([
      events([{ kind: "text", text: "done" }]),
    ]);

    await store.getState().send("hi");

    expect(cancelFrame).toHaveBeenCalledTimes(1);
    expect(lastAssistant(store)).toMatchObject({
      text: "done",
      status: "done",
    });
  });

  it("cuts streamed text over the cap and does not schedule a frame for unchanged text", async () => {
    const { store, logger, scheduleFrame } = createHarness([
      events([
        { kind: "text", text: "a".repeat(AI_MAX_STREAMED_TEXT_LENGTH + 10) },
        { kind: "text", text: "a".repeat(AI_MAX_STREAMED_TEXT_LENGTH + 20) },
      ]),
    ]);

    await store.getState().send("hi");

    expect(lastAssistant(store).text).toHaveLength(AI_MAX_STREAMED_TEXT_LENGTH);
    expect(lastAssistant(store).status).toBe("done");
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(scheduleFrame).toHaveBeenCalledTimes(1);
  });

  it("starts a preview when a turn ends with a proposal", async () => {
    const { store, editor } = createHarness([
      events([{ kind: "proposal", data: addColumnProposal }]),
    ]);

    await store.getState().send("add email");

    const message = lastAssistant(store);
    expect(message.proposal?.state).toBe("preview");
    expect(editor.getState().proposal?.messageId).toBe(message.id);
    expect(store.getState().isSending).toBe(false);
  });

  it("marks a proposal stale when it no longer applies to the document at the end of the turn", async () => {
    const { store, editor } = createHarness([
      async function* run() {
        await Promise.resolve();
        // The user edits while the reply streams.
        editor.getState().dispatch(addEmail);
        yield { kind: "proposal", data: addColumnProposal } as const;
      },
    ]);

    await store.getState().send("add email");

    expect(lastAssistant(store).proposal?.state).toBe("stale");
    expect(editor.getState().proposal).toBeNull();
  });

  it("marks a proposal invalid when it is not an operation", async () => {
    const { store } = createHarness([
      events([
        {
          kind: "proposal",
          data: { operation: { type: "nope" }, stoppedEarly: false },
        },
      ]),
    ]);

    await store.getState().send("x");

    expect(lastAssistant(store).proposal?.state).toBe("invalid");
  });

  it("a text-only turn does not change the document", async () => {
    const { store, editor } = createHarness([
      events([{ kind: "text", text: "just words" }]),
    ]);
    const before = editor.getState().document;

    await store.getState().send("explain");

    expect(editor.getState().document).toBe(before);
    expect(editor.getState().proposal).toBeNull();
    expect(lastAssistant(store).proposal).toBeNull();
  });

  it("keeps findings and sample data on the assistant message", async () => {
    const findings = [
      {
        kind: "issue" as const,
        category: "index" as const,
        title: "Missing index",
        detail: "",
        targets: [],
      },
    ];
    const { store } = createHarness([
      events([
        { kind: "findings", data: { findings } },
        { kind: "sampleData", data: { dataset: { rows: [] } } },
      ]),
    ]);

    await store.getState().send("review");

    expect(lastAssistant(store)).toMatchObject({
      findings,
      sampleDataset: { rows: [] },
    });
  });

  it("stop aborts the request and keeps the received text as stopped without attachments", async () => {
    const { store, editor } = createHarness([
      hanging([
        { kind: "text", text: "partial" },
        { kind: "proposal", data: addColumnProposal },
      ]),
    ]);

    const sending = store.getState().send("go");
    await vi.waitFor(() => {
      expect(store.getState().isSending).toBe(true);
    });
    await Promise.resolve();
    store.getState().stop();
    await sending;

    expect(lastAssistant(store)).toMatchObject({
      text: "partial",
      status: "stopped",
      proposal: null,
      findings: null,
    });
    expect(editor.getState().proposal).toBeNull();
    expect(store.getState().isSending).toBe(false);
  });

  it("records a stream error code on a failed message", async () => {
    const { store, editor } = createHarness([
      events([
        { kind: "text", text: "half" },
        { kind: "proposal", data: addColumnProposal },
        {
          kind: "findings",
          data: {
            findings: [
              {
                kind: "issue",
                category: "other",
                title: "Late finding",
                detail: "",
                targets: [],
              },
            ],
          },
        },
        { kind: "sampleData", data: { dataset: { rows: [] } } },
        { kind: "error", code: "ai-timeout" },
      ]),
    ]);

    await store.getState().send("go");

    expect(lastAssistant(store)).toMatchObject({
      status: "failed",
      text: "half",
      failure: { kind: "error", code: "ai-timeout" },
      proposal: null,
      findings: null,
      sampleDataset: null,
    });
    expect(editor.getState().proposal).toBeNull();
    expect(store.getState().isSending).toBe(false);
  });

  it("does not send a failed message in the history of the next turn", async () => {
    const { store, requests } = createHarness([
      events([
        { kind: "text", text: "half" },
        { kind: "error", code: "ai-output-invalid" },
      ]),
      events([]),
    ]);
    await store.getState().send("first");

    await store.getState().send("second");

    expect(requests[1]?.messages).toEqual([
      { role: "user", text: "first" },
      { role: "user", text: "second" },
    ]);
  });

  it("records an http failure with its retry after seconds", async () => {
    const body = parseApiErrorBody({
      statusCode: 429,
      code: "too-many-requests",
    });
    if (body === null) {
      throw new Error("fixture body is invalid");
    }
    const failure: ApiFailure = {
      kind: "http",
      status: 429,
      body,
      retryAfterSeconds: 30,
    };
    const { store } = createHarness([
      events([{ kind: "http-failure", failure }]),
    ]);

    await store.getState().send("go");

    expect(lastAssistant(store).failure).toEqual({
      kind: "http-failure",
      failure,
    });
  });

  it("fails with an internal error when no client can be loaded", async () => {
    const { store, loadClient, logger } = createHarness();
    loadClient.mockResolvedValueOnce(null);

    await store.getState().send("go");

    expect(lastAssistant(store).failure).toEqual({
      kind: "error",
      code: "internal-error",
    });
    expect(logger.error).toHaveBeenCalledWith("ai.chat.no-client");
  });

  it("fails with an internal error when the stream throws", async () => {
    const { store, logger } = createHarness([
      async function* run() {
        await Promise.resolve();
        throw new Error("boom");
      },
    ]);

    await store.getState().send("go");

    expect(lastAssistant(store).failure).toEqual({
      kind: "error",
      code: "internal-error",
    });
    expect(logger.error).toHaveBeenCalledWith("ai.chat.stream-failed", {
      name: "Error",
    });
  });

  it("retry drops the failed message and resends the last user message", async () => {
    const { store, requests } = createHarness([
      events([{ kind: "error", code: "ai-upstream-failed" }]),
      events([{ kind: "text", text: "ok" }]),
    ]);

    await store.getState().send("go");
    await store.getState().retry();

    const { messages } = store.getState();
    expect(messages.map((entry) => entry.role)).toEqual(["user", "assistant"]);
    expect(lastAssistant(store)).toMatchObject({ text: "ok", status: "done" });
    expect(requests[1]?.messages).toEqual([{ role: "user", text: "go" }]);
  });

  it("retry resends the last user message after a stale proposal", async () => {
    const { store, editor, requests } = createHarness([
      async function* run() {
        await Promise.resolve();
        editor.getState().dispatch(addEmail);
        yield { kind: "proposal", data: addColumnProposal } as const;
      },
      events([{ kind: "text", text: "again" }]),
    ]);
    await store.getState().send("add email");
    expect(lastAssistant(store).proposal?.state).toBe("stale");

    await store.getState().retry();

    expect(requests[1]?.messages.at(-1)).toEqual({
      role: "user",
      text: "add email",
    });
    const { messages } = store.getState();
    expect(messages.map((entry) => entry.role)).toEqual([
      "user",
      "assistant",
      "assistant",
    ]);
    const stale = messages[1];
    expect(stale?.role === "assistant" && stale.proposal?.state).toBe(
      "discarded",
    );
    expect(lastAssistant(store).text).toBe("again");
  });

  it("retry does nothing without a user message", async () => {
    const { store, requests } = createHarness();

    await store.getState().retry();

    expect(requests).toHaveLength(0);
  });

  it("retry does nothing during a turn", async () => {
    const { store, requests } = createHarness([hanging([])]);
    const sending = store.getState().send("go");

    await store.getState().retry();

    expect(requests).toHaveLength(1);
    store.getState().stop();
    await sending;
  });

  it("ignores send while a turn is running", async () => {
    const { store, requests } = createHarness([hanging([])]);
    const sending = store.getState().send("one");

    await store.getState().send("two");

    expect(requests).toHaveLength(1);
    store.getState().stop();
    await sending;
  });

  it.each([
    ["only whitespace", "   "],
    ["over the length limit", "x".repeat(4001)],
  ])("ignores send for text that is %s", async (_name, text) => {
    const { store, requests } = createHarness();

    await store.getState().send(text);

    expect(requests).toHaveLength(0);
    expect(store.getState().messages).toEqual([]);
  });

  it("sending a message during preview discards the proposal", async () => {
    const { store, editor } = createHarness([
      events([{ kind: "proposal", data: addColumnProposal }]),
      events([]),
    ]);
    await store.getState().send("add email");
    expect(editor.getState().proposal).not.toBeNull();

    const next = store.getState().send("another");
    expect(editor.getState().proposal).toBeNull();
    await next;
  });

  it("older proposal cannot be previewed after a newer turn starts", async () => {
    const { store, editor } = createHarness([
      events([{ kind: "proposal", data: addColumnProposal }]),
      events([]),
    ]);
    await store.getState().send("add email");
    const first = lastAssistant(store);

    await store.getState().send("next");

    const old = store
      .getState()
      .messages.find((entry) => entry.id === first.id);
    expect(old?.role === "assistant" && old.proposal?.state).toBe("discarded");
    expect(() => store.getState().acceptProposal(first.id)).toThrow();
    expect(editor.getState().proposal).toBeNull();
  });

  it("accepting a proposal marks it accepted and records one undo entry", async () => {
    const { store, editor } = createHarness([
      events([{ kind: "proposal", data: addColumnProposal }]),
    ]);
    await store.getState().send("add email");
    const { id } = lastAssistant(store);
    const entriesBefore = editor.getState().history.past.length;

    const result = store.getState().acceptProposal(id);

    expect(result.isOk).toBe(true);
    expect(lastAssistant(store).proposal?.state).toBe("accepted");
    expect(editor.getState().history.past).toHaveLength(entriesBefore + 1);
    expect(Object.keys(editor.getState().document.columns)).toHaveLength(2);
  });

  it("discarding a proposal ends the preview", async () => {
    const { store, editor } = createHarness([
      events([{ kind: "proposal", data: addColumnProposal }]),
    ]);
    await store.getState().send("add email");
    const { id } = lastAssistant(store);

    store.getState().discardProposal(id);
    store.getState().discardProposal(id);

    expect(lastAssistant(store).proposal?.state).toBe("discarded");
    expect(editor.getState().proposal).toBeNull();
  });

  it("reset aborts the turn, discards the preview and clears the messages", async () => {
    const { store, editor } = createHarness([
      events([{ kind: "proposal", data: addColumnProposal }]),
      hanging([{ kind: "text", text: "late" }]),
    ]);
    await store.getState().send("add email");

    const sending = store.getState().send("more");
    store.getState().reset();
    await sending;

    expect(store.getState().messages).toEqual([]);
    expect(store.getState().isSending).toBe(false);
    expect(editor.getState().proposal).toBeNull();
  });

  it("calls beforePreview right before starting a preview", async () => {
    const { store, editor, beforePreview } = createHarness([
      events([{ kind: "proposal", data: addColumnProposal }]),
    ]);
    beforePreview.mockImplementation(() => {
      expect(editor.getState().proposal).toBeNull();
    });

    await store.getState().send("add email");

    expect(beforePreview).toHaveBeenCalledTimes(1);
    expect(editor.getState().proposal).not.toBeNull();
  });
});
