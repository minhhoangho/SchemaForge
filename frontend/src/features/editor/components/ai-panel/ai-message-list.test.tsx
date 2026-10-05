import { parseApiErrorBody } from "@schemaforge/api-contract";
import type { Operation, SchemaDocument } from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeTable,
} from "@schemaforge/core/testing";
import { act, fireEvent, screen } from "@testing-library/react";
import type { JSX } from "react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { ApiFailure } from "@/lib/api/api-failure";
import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { renderWithProviders } from "@/testing/render-with-providers";

import type { ViewportControls } from "../../lib/viewport-controls";
import { ViewportControlsProvider } from "../../lib/viewport-controls";
import type {
  AiAssistantMessage,
  AiChatEntry,
  AiChatFailure,
} from "../../state/create-ai-chat-store";
import { createEditorStore } from "../../state/create-editor-store";
import type { EditorStore } from "../../state/create-editor-store";
import { EditorStoreProvider } from "../../state/editor-store-provider";
import { AiMessageList } from "./ai-message-list";
import type { AiMessageListProps } from "./ai-message-list";

const ADD_EMAIL: Operation = {
  type: "addColumn",
  column: makeColumn({ id: "col_email", tableId: "tbl_users", name: "email" }),
  insertAt: 1,
};
const REMOVE_EMAIL: Operation = { type: "removeColumn", columnId: "col_email" };

function createDocument(hasEmail: boolean): SchemaDocument {
  return buildSchema({
    name: "shop",
    tables: [makeTable({ id: "tbl_users", name: "users" })],
    columns: [
      makeColumn({ id: "col_id", tableId: "tbl_users", name: "id" }),
      ...(hasEmail
        ? [makeColumn({ id: "col_email", tableId: "tbl_users", name: "email" })]
        : []),
    ],
  });
}

function createEditor(hasEmail = false): EditorStore {
  return createEditorStore({
    schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    document: createDocument(hasEmail),
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
}

function createControls(): ViewportControls {
  return {
    zoomIn: vi.fn<ViewportControls["zoomIn"]>(),
    zoomOut: vi.fn<ViewportControls["zoomOut"]>(),
    fitView: vi.fn<ViewportControls["fitView"]>(),
    setCenter: vi.fn<ViewportControls["setCenter"]>(),
    getZoom: vi.fn<ViewportControls["getZoom"]>(() => 1),
  };
}

function assistant(patch: Partial<AiAssistantMessage>): AiAssistantMessage {
  return {
    id: "a1",
    role: "assistant",
    text: "",
    status: "done",
    failure: null,
    proposal: null,
    findings: null,
    sampleDataset: null,
    ...patch,
  };
}

const USER_MESSAGE: AiChatEntry = { id: "u1", role: "user", text: "hello" };

function httpFailure(
  status: number,
  code: string,
  retryAfterSeconds: number | null,
): AiChatFailure {
  const body = parseApiErrorBody({ statusCode: status, code });
  if (body === null) {
    throw new Error(`Unknown error code ${code}.`);
  }
  const failure: ApiFailure = { kind: "http", status, body, retryAfterSeconds };
  return { kind: "http-failure", failure };
}

type ListOptions = Partial<AiMessageListProps> & {
  readonly editor?: EditorStore;
};

function renderList(options: ListOptions = {}) {
  const props: AiMessageListProps = {
    messages: [USER_MESSAGE, assistant({ text: "hi" })],
    isSending: false,
    onSend: vi.fn<AiMessageListProps["onSend"]>(),
    onRetry: vi.fn<AiMessageListProps["onRetry"]>(),
    onAccept: vi.fn<AiMessageListProps["onAccept"]>(),
    onDiscard: vi.fn<AiMessageListProps["onDiscard"]>(),
    ...options,
  };
  const editor = options.editor ?? createEditor();
  const tree = (current: AiMessageListProps): JSX.Element => (
    <EditorStoreProvider store={editor}>
      <ViewportControlsProvider controls={createControls()}>
        <AiMessageList {...current} />
      </ViewportControlsProvider>
    </EditorStoreProvider>
  );
  const result = renderWithProviders(tree(props), { locale: "en" });
  return {
    ...result,
    props,
    rerenderWith: (patch: Partial<AiMessageListProps>) => {
      result.rerender(tree({ ...props, ...patch }));
    },
  };
}

function getStatusText(): string {
  return screen.getByRole("status", { name: "" }).textContent;
}

describe("AiMessageList", () => {
  it("marks the streaming answer busy and announces when it is done", () => {
    const { rerenderWith } = renderList({
      messages: [
        USER_MESSAGE,
        assistant({ text: "Part", status: "streaming" }),
      ],
      isSending: true,
    });
    const log = screen.getByRole("log", { name: "Conversation" });
    expect(log.getAttribute("aria-busy")).toBe("true");
    expect(getStatusText()).toBe("The assistant is responding");

    rerenderWith({
      messages: [USER_MESSAGE, assistant({ text: "Part done" })],
      isSending: false,
    });

    expect(log.getAttribute("aria-busy")).toBe("false");
    expect(getStatusText()).toBe("The assistant finished responding");
  });

  it("renders AI text as plain text without HTML", () => {
    const text = "<b>bold</b>\n- item";
    const { container } = renderList({
      messages: [USER_MESSAGE, assistant({ text })],
    });

    expect(container.querySelector("b")).toBeNull();
    expect(screen.getByText("<b>bold</b>", { selector: "p" })).toBeDefined();
    expect(screen.getByText("item", { selector: "ul li" })).toBeDefined();
  });

  it("renders consecutive dash lines as one list and keeps other lines pre-wrapped", () => {
    renderList({
      messages: [
        USER_MESSAGE,
        assistant({ text: "Intro\nsecond line\n- one\n- two\nOutro" }),
      ],
    });

    const items = screen.getAllByText(/^(one|two)$/, { selector: "ul li" });
    expect(items.map((item) => item.textContent)).toEqual(["one", "two"]);
    const intro = screen.getByText(
      (_content, element) => element?.textContent === "Intro\nsecond line",
      { selector: "p" },
    );
    expect(intro.className).toContain("whitespace-pre-wrap");
    expect(screen.getByText("Outro", { selector: "p" })).toBeDefined();
  });

  it("groups consecutive messages of one sender: one avatar, one tail corner", () => {
    const { container } = renderList({
      messages: [
        USER_MESSAGE,
        { id: "u2", role: "user", text: "more" },
        assistant({ id: "a1", text: "first" }),
        assistant({ id: "a2", text: "second" }),
      ],
    });

    expect(screen.getAllByText("You")).toHaveLength(2);
    expect(screen.getAllByText("Assistant")).toHaveLength(2);
    expect(container.querySelectorAll(".bg-accent")).toHaveLength(1);
    expect(container.querySelectorAll(".rounded-tr-sm")).toHaveLength(1);
    expect(container.querySelectorAll(".rounded-tl-sm")).toHaveLength(1);
  });

  it("puts a machine-readable time beside every bubble", () => {
    const { container } = renderList();

    const times = container.querySelectorAll("time");
    expect(times).toHaveLength(2);
    for (const time of times) {
      expect(time.textContent).toMatch(/^\d{2}:\d{2}$/);
      expect(Number.isNaN(Date.parse(time.dateTime))).toBe(false);
    }
  });

  it("shows the empty state before the first message", () => {
    renderList({ messages: [] });

    expect(
      screen.getByRole("heading", { name: "How can I help with this schema?" }),
    ).toBeDefined();
    expect(
      screen.getByText("Ask for a change or pick a quick action."),
    ).toBeDefined();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("shows typing dots before the first text and a caret while text streams", () => {
    const { container, rerenderWith } = renderList({
      messages: [USER_MESSAGE, assistant({ text: "", status: "streaming" })],
      isSending: true,
    });
    expect(container.querySelectorAll("i.animate-bounce")).toHaveLength(3);

    rerenderWith({
      messages: [
        USER_MESSAGE,
        assistant({ text: "Part", status: "streaming" }),
      ],
    });

    expect(container.querySelector("i.animate-bounce")).toBeNull();
    expect(screen.getByText("Part").className).toContain("after:animate-pulse");
    expect(screen.getByText("Part").className).toContain(
      "motion-reduce:after:animate-none",
    );
  });

  it("shows the partial text of a failed turn muted in a dashed bubble", () => {
    renderList({
      messages: [
        USER_MESSAGE,
        assistant({
          text: "Partial",
          status: "failed",
          failure: { kind: "error", code: "ai-timeout" },
        }),
      ],
    });

    const bubble = screen.getByText("Partial").closest("div.rounded-2xl");
    expect(bubble?.className).toContain("border-dashed");
    expect(bubble?.className).toContain("text-muted-foreground");
    expect(screen.getByRole("button", { name: "Try again" })).toBeDefined();
  });

  it("shows the stopped label", () => {
    renderList({
      messages: [USER_MESSAGE, assistant({ text: "Half", status: "stopped" })],
    });

    expect(screen.getAllByText("The response was stopped")).not.toHaveLength(0);
  });

  it("shows a stream error with a retry button", async () => {
    const { user, props } = renderList({
      messages: [
        USER_MESSAGE,
        assistant({
          text: "Partial answer",
          status: "failed",
          failure: { kind: "error", code: "ai-timeout" },
        }),
      ],
    });

    expect(screen.getByText("Partial answer")).toBeDefined();
    expect(
      screen.getAllByText("The AI service took too long to answer. Try again."),
    ).not.toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows the rate limit message with the seconds to wait", () => {
    renderList({
      messages: [
        USER_MESSAGE,
        assistant({
          status: "failed",
          failure: httpFailure(429, "too-many-requests", 12),
        }),
      ],
    });

    expect(
      screen.getAllByText("Too many requests. Try again in 12 seconds."),
    ).not.toHaveLength(0);
  });

  it("falls back to the apiErrors message when the wait is unknown", () => {
    renderList({
      messages: [
        USER_MESSAGE,
        assistant({
          status: "failed",
          failure: httpFailure(429, "too-many-requests", null),
        }),
      ],
    });

    expect(
      screen.getAllByText(
        "You tried too many times. Wait a moment and try again.",
      ),
    ).not.toHaveLength(0);
  });

  it("shows the apiErrors message for ai-unavailable", () => {
    renderList({
      messages: [
        USER_MESSAGE,
        assistant({
          status: "failed",
          failure: httpFailure(503, "ai-unavailable", 30),
        }),
      ],
    });

    expect(
      screen.getAllByText(
        "The AI assistant is not available on this server right now.",
      ),
    ).not.toHaveLength(0);
    expect(screen.getByRole("button", { name: "Try again" })).toBeDefined();
  });

  it("shows the proposal of an older turn as discarded", () => {
    renderList({
      messages: [
        USER_MESSAGE,
        assistant({
          proposal: {
            operation: ADD_EMAIL,
            stoppedEarly: false,
            state: "preview",
          },
        }),
      ],
    });

    expect(screen.getByText("Discarded")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Discard" })).toBeNull();
  });

  it("accepts the previewed proposal and focuses its card", async () => {
    const editor = createEditor();
    editor.getState().startProposalPreview("a1", ADD_EMAIL);
    const { user, props } = renderList({
      editor,
      messages: [
        USER_MESSAGE,
        assistant({
          proposal: {
            operation: ADD_EMAIL,
            stoppedEarly: false,
            state: "preview",
          },
        }),
      ],
    });

    await user.click(screen.getByRole("button", { name: "Accept" }));

    expect(props.onAccept).toHaveBeenCalledWith("a1");
    expect(document.activeElement).toBe(
      screen.getByRole("group", { name: "Proposed changes" }),
    );
  });

  it("returns focus to the card after confirming a destructive proposal", async () => {
    const editor = createEditor(true);
    editor.getState().startProposalPreview("a1", REMOVE_EMAIL);
    const previewed = assistant({
      proposal: {
        operation: REMOVE_EMAIL,
        stoppedEarly: false,
        state: "preview",
      },
    });
    // Accepting ends the preview, as the conversation store does.
    function StatefulList(): JSX.Element {
      const [messages, setMessages] = useState<readonly AiChatEntry[]>([
        USER_MESSAGE,
        previewed,
      ]);
      return (
        <AiMessageList
          messages={messages}
          isSending={false}
          onSend={vi.fn<(text: string) => void>()}
          onRetry={vi.fn<() => void>()}
          onDiscard={vi.fn<(id: string) => void>()}
          onAccept={() => {
            editor.getState().acceptProposal();
            setMessages([
              USER_MESSAGE,
              assistant({
                proposal: {
                  operation: REMOVE_EMAIL,
                  stoppedEarly: false,
                  state: "accepted",
                },
              }),
            ]);
          }}
        />
      );
    }
    const { user } = renderWithProviders(
      <EditorStoreProvider store={editor}>
        <ViewportControlsProvider controls={createControls()}>
          <StatefulList />
        </ViewportControlsProvider>
      </EditorStoreProvider>,
      { locale: "en" },
    );

    await user.click(screen.getByRole("button", { name: "Accept" }));
    await user.click(screen.getByRole("button", { name: "Accept and delete" }));
    // Radix restores focus a task after the dialog unmounts.
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    });

    expect(document.activeElement).toBe(
      screen.getByRole("group", { name: "Proposed changes" }),
    );
  });

  it("discards the previewed proposal and focuses its card", async () => {
    const editor = createEditor();
    editor.getState().startProposalPreview("a1", ADD_EMAIL);
    const { user, props } = renderList({
      editor,
      messages: [
        USER_MESSAGE,
        assistant({
          proposal: {
            operation: ADD_EMAIL,
            stoppedEarly: false,
            state: "preview",
          },
        }),
      ],
    });

    await user.click(screen.getByRole("button", { name: "Discard" }));

    expect(props.onDiscard).toHaveBeenCalledWith("a1");
    expect(document.activeElement).toBe(
      screen.getByRole("group", { name: "Proposed changes" }),
    );
  });

  it("applies a finding by sending its message", async () => {
    const { user, props } = renderList({
      messages: [
        USER_MESSAGE,
        assistant({
          findings: [
            {
              kind: "suggestion",
              category: "index",
              title: "Add an index",
              detail: "users.id is queried often.",
              targets: [],
            },
          ],
        }),
      ],
    });

    await user.click(screen.getByRole("button", { name: /Apply/ }));

    expect(props.onSend).toHaveBeenCalledTimes(1);
  });

  it("lets keyboard users focus the scrollable log", () => {
    renderList();

    expect(
      screen
        .getByRole("log", { name: "Conversation" })
        .getAttribute("tabindex"),
    ).toBe("0");
  });

  function sizeLog(log: HTMLElement): void {
    Object.defineProperty(log, "scrollHeight", {
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(log, "clientHeight", {
      configurable: true,
      value: 200,
    });
  }

  it("follows a streaming answer while the log is scrolled to the end", () => {
    const { rerenderWith } = renderList({
      messages: [USER_MESSAGE, assistant({ text: "A", status: "streaming" })],
    });
    const log = screen.getByRole("log", { name: "Conversation" });
    sizeLog(log);

    rerenderWith({
      messages: [USER_MESSAGE, assistant({ text: "AB", status: "streaming" })],
    });

    expect(log.scrollTop).toBe(1000);
  });

  it("keeps the reading position when the user scrolled up", () => {
    const { rerenderWith } = renderList({
      messages: [USER_MESSAGE, assistant({ text: "A", status: "streaming" })],
    });
    const log = screen.getByRole("log", { name: "Conversation" });
    sizeLog(log);
    log.scrollTop = 100;
    fireEvent.scroll(log);

    rerenderWith({
      messages: [USER_MESSAGE, assistant({ text: "AB", status: "streaming" })],
    });

    expect(log.scrollTop).toBe(100);
  });

  it.each(["light", "dark"] as const)(
    "has no axe violations with a failed answer and a proposal in the %s theme",
    async (themePreference) => {
      const editor = createEditor();
      editor.getState().startProposalPreview("a1", ADD_EMAIL);
      const { container } = renderWithProviders(
        <EditorStoreProvider store={editor}>
          <ViewportControlsProvider controls={createControls()}>
            <AiMessageList
              messages={[
                USER_MESSAGE,
                assistant({
                  proposal: {
                    operation: ADD_EMAIL,
                    stoppedEarly: false,
                    state: "preview",
                  },
                }),
                { id: "u2", role: "user", text: "again" },
                assistant({
                  id: "a2",
                  text: "Partial",
                  status: "failed",
                  failure: { kind: "error", code: "ai-timeout" },
                }),
              ]}
              isSending={false}
              onSend={vi.fn<(text: string) => void>()}
              onRetry={vi.fn<() => void>()}
              onAccept={vi.fn<(id: string) => void>()}
              onDiscard={vi.fn<(id: string) => void>()}
            />
          </ViewportControlsProvider>
        </EditorStoreProvider>,
        { locale: "en", themePreference },
      );

      await expectNoAxeViolations(container);
    },
  );

  it.each(["light", "dark"] as const)(
    "has no axe violations with grouped bubbles, a list, findings and streaming in the %s theme",
    async (themePreference) => {
      const { container } = renderWithProviders(
        <EditorStoreProvider store={createEditor()}>
          <ViewportControlsProvider controls={createControls()}>
            <AiMessageList
              messages={[
                USER_MESSAGE,
                { id: "u2", role: "user", text: "and" },
                assistant({
                  id: "a1",
                  text: "Two things:\n- one\n- two",
                  findings: [
                    {
                      kind: "issue",
                      category: "naming",
                      title: "Rename it",
                      detail: "Use the full word.",
                      targets: [],
                    },
                  ],
                }),
                assistant({ id: "a2", text: "More", status: "stopped" }),
                { id: "u3", role: "user", text: "go on" },
                assistant({ id: "a3", text: "", status: "streaming" }),
              ]}
              isSending
              onSend={vi.fn<(text: string) => void>()}
              onRetry={vi.fn<() => void>()}
              onAccept={vi.fn<(id: string) => void>()}
              onDiscard={vi.fn<(id: string) => void>()}
            />
          </ViewportControlsProvider>
        </EditorStoreProvider>,
        { locale: "en", themePreference },
      );

      await expectNoAxeViolations(container);
    },
  );
});
