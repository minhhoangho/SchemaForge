import type { Operation } from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeTable,
} from "@schemaforge/core/testing";
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import type { JSX } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as authProvider from "@/components/auth-provider";
import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";
import type { StorageBundle } from "@/lib/storage/create-browser-storage";
import { SchemaforgeDatabase } from "@/lib/storage/database";
import { createSchemaLockManager } from "@/lib/storage/schema-lock-manager";
import { createSchemaRepository } from "@/lib/storage/schema-repository";
import {
  AUTH_HINT_COOKIE,
  TEST_AI_USER_ID,
  aiChatStreamResponse,
  createAiFetch,
  createControlledAiChatStream,
  jsonResponse,
  openAiChatStreamResponse,
  proposalChunk,
  textChunks,
} from "@/testing/ai-chat-stream";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { createFakeLockRegistry } from "@/testing/fake-lock-registry";
import { renderWithProviders } from "@/testing/render-with-providers";

import { NARROW_VIEWPORT_QUERY } from "../../hooks/use-is-narrow-viewport";
import type { ViewportControls } from "../../lib/viewport-controls";
import { ViewportControlsProvider } from "../../lib/viewport-controls";
import { AiChatStoreProvider } from "../../state/ai-chat-store-provider";
import { createEditorStore } from "../../state/create-editor-store";
import { EditorStoreProvider } from "../../state/editor-store-provider";
import { aiConsentKey } from "./ai-consent";
import { AiLauncher } from "./ai-launcher";
import { AiWindow } from "./ai-panel-loader";
import { AiTurnStatus } from "./ai-turn-status";

const EDITOR_PATH = "/schemas/0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4";
const WINDOW_ID = "ai-window";
// The panel is a lazy chunk, so its first render can take a while.
const LAZY_PANEL_TIMEOUT_MS = 10_000;
const REMOVE_EMAIL: Operation = { type: "removeColumn", columnId: "col_email" };

vi.mock("next/navigation", () => ({
  usePathname: () => EDITOR_PATH,
}));

// The one state the real provider never reaches with a signed-in user (no
// Web Locks also means no session), so only this hook is replaceable.
vi.mock("@/components/auth-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof authProvider>();
  return {
    ...actual,
    useAiChatTransport: vi.fn(actual.useAiChatTransport),
  };
});

const databases = new Set<SchemaforgeDatabase>();

afterEach(() => {
  databases.forEach((database) => {
    database.close();
  });
  databases.clear();
  localStorage.clear();
  // Back to the real hook after the one test that replaces it.
  vi.mocked(authProvider.useAiChatTransport).mockReset();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function createStorage(): StorageBundle {
  const database = new SchemaforgeDatabase({
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  });
  databases.add(database);
  return {
    database,
    lockManager: createSchemaLockManager(createFakeLockRegistry().request),
    repository: createSchemaRepository({
      database,
      clock: () => 1,
      generateId: () => "id-1",
    }),
  };
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

// The launcher and the floating window as the workspace renders them, next
// to something else on the page (the canvas in the editor).
function PanelHarness(): JSX.Element {
  return (
    <>
      <button type="button">outside</button>
      <AiTurnStatus />
      <AiLauncher windowId={WINDOW_ID} />
      <AiWindow id={WINDOW_ID} />
    </>
  );
}

type PanelOptions = {
  readonly isSignedIn?: boolean;
  readonly hasConsent?: boolean;
  readonly fetchImpl?: typeof fetch;
  readonly themePreference?: "light" | "dark";
};

function renderPanel({
  isSignedIn = true,
  hasConsent = true,
  fetchImpl = createAiFetch(() => aiChatStreamResponse(textChunks("Hi there"))),
  themePreference = "light",
}: PanelOptions = {}) {
  if (hasConsent) {
    localStorage.setItem(aiConsentKey(TEST_AI_USER_ID), "1");
  }
  const editor = createEditorStore({
    schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    document: buildSchema({
      name: "shop",
      tables: [makeTable({ id: "tbl_users", name: "users" })],
      columns: [
        makeColumn({ id: "col_id", tableId: "tbl_users", name: "id" }),
        makeColumn({ id: "col_email", tableId: "tbl_users", name: "email" }),
      ],
    }),
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
  return renderWithProviders(
    <EditorStoreProvider store={editor}>
      <AiChatStoreProvider>
        <ViewportControlsProvider controls={createControls()}>
          <PanelHarness />
        </ViewportControlsProvider>
      </AiChatStoreProvider>
    </EditorStoreProvider>,
    {
      locale: "en",
      themePreference,
      auth: {
        storage: createStorage(),
        hasAuthHint: isSignedIn,
        dependencies: {
          fetchImpl,
          cookieJar: { cookie: isSignedIn ? AUTH_HINT_COOKIE : "" },
        },
      },
    },
  );
}

type Rendered = ReturnType<typeof renderPanel>;

async function openPanel(rendered: Rendered): Promise<HTMLElement> {
  await rendered.user.click(
    screen.getByRole("button", { name: "AI assistant" }),
  );
  return screen.findByRole(
    "dialog",
    { name: "AI assistant" },
    { timeout: LAZY_PANEL_TIMEOUT_MS },
  );
}

// The launcher keeps its name while the window is open; aria-expanded says so.
function getOpenLauncher(): HTMLElement {
  return screen.getByRole("button", { name: "AI assistant", expanded: true });
}

function stubNarrowViewport(): void {
  vi.stubGlobal("matchMedia", (media: string) => ({
    matches: media === NARROW_VIEWPORT_QUERY,
    media,
    addEventListener: (): void => undefined,
    removeEventListener: (): void => undefined,
  }));
}

function getComposer(panel: HTMLElement): HTMLElement {
  return within(panel).getByRole("textbox", {
    name: "Message to the AI assistant",
  });
}

async function openChat(rendered: Rendered): Promise<HTMLElement> {
  const panel = await openPanel(rendered);
  await within(panel).findByRole("textbox", {
    name: "Message to the AI assistant",
  });
  return panel;
}

async function sendMessage(rendered: Rendered, text: string): Promise<void> {
  await rendered.user.type(
    screen.getByRole("textbox", { name: "Message to the AI assistant" }),
    `${text}{Enter}`,
  );
}

const FINISHED_STATUS = "The assistant finished responding";

describe("AiPanel", () => {
  it("shows guests a sign-in invitation with a returnTo link and sends no request", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const rendered = renderPanel({ isSignedIn: false, fetchImpl });

    const panel = await openPanel(rendered);

    const link = await within(panel).findByRole("link", { name: "Sign in" });
    expect(link.getAttribute("href")).toBe(
      `/sign-in?returnTo=${encodeURIComponent(EDITOR_PATH)}`,
    );
    expect(within(panel).queryByRole("textbox")).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("shows the unavailable message when there is no transport", async () => {
    vi.mocked(authProvider.useAiChatTransport).mockReturnValue(null);
    const rendered = renderPanel();

    const panel = await openPanel(rendered);

    expect(
      await within(panel).findByText(
        "The AI assistant is not available right now.",
      ),
    ).toBeDefined();
    expect(within(panel).queryByRole("textbox")).toBeNull();
  });

  it("shows the consent block before the first message", async () => {
    const rendered = renderPanel({ hasConsent: false });

    const panel = await openPanel(rendered);

    const accept = await within(panel).findByRole("button", {
      name: "Agree and continue",
    });
    expect(
      within(panel).getByRole("heading", {
        level: 3,
        name: "Before you start",
      }),
    ).toBeDefined();
    expect(within(panel).queryByRole("textbox")).toBeNull();
    expect(document.activeElement).toBe(accept);
  });

  it("focuses the composer once consent is given", async () => {
    const rendered = renderPanel({ hasConsent: false });
    const panel = await openPanel(rendered);

    await rendered.user.click(
      await within(panel).findByRole("button", { name: "Agree and continue" }),
    );

    expect(document.activeElement).toBe(
      within(panel).getByRole("textbox", {
        name: "Message to the AI assistant",
      }),
    );
  });

  it("shows quick actions for an empty conversation", async () => {
    const rendered = renderPanel();
    const panel = await openChat(rendered);

    const group = within(panel).getByRole("group", { name: "Quick actions" });
    await rendered.user.click(
      within(group).getByRole("button", { name: "Explain" }),
    );

    expect(await within(panel).findByText("Hi there")).toBeDefined();
    // Still there as the compact row above the composer: one row, no wrapping.
    const compact = within(panel).getByRole("group", { name: "Quick actions" });
    expect(compact.className).toContain("overflow-x-auto");
    expect(compact.className).not.toContain("flex-wrap");
  });

  it("focuses the composer when the panel opens", async () => {
    const rendered = renderPanel();

    const panel = await openChat(rendered);

    expect(document.activeElement).toBe(
      within(panel).getByRole("textbox", {
        name: "Message to the AI assistant",
      }),
    );
  });

  async function sendWithButton(rendered: Rendered): Promise<HTMLElement> {
    const panel = await openChat(rendered);
    await rendered.user.type(
      within(panel).getByRole("textbox", {
        name: "Message to the AI assistant",
      }),
      "Add a table",
    );
    await rendered.user.click(
      within(panel).getByRole("button", { name: "Send" }),
    );
    return panel;
  }

  it("returns focus to the composer when the answer ends", async () => {
    const stream = createControlledAiChatStream();
    const rendered = renderPanel({
      fetchImpl: createAiFetch(() => stream.response),
    });
    const panel = await sendWithButton(rendered);

    await act(async () => {
      stream.finish(textChunks("Done"));
      await Promise.resolve();
    });
    await within(panel).findByText("Done");

    expect(document.activeElement).toBe(
      within(panel).getByRole("textbox", {
        name: "Message to the AI assistant",
      }),
    );
  });

  it("returns focus to the composer after Stop", async () => {
    const rendered = renderPanel({
      fetchImpl: createAiFetch((signal) =>
        openAiChatStreamResponse("Thinking", signal),
      ),
    });
    const panel = await sendWithButton(rendered);

    await rendered.user.click(
      within(panel).getByRole("button", { name: "Stop" }),
    );

    // The aborted stream settles a little later.
    await waitFor(() => {
      expect(document.activeElement).toBe(
        within(panel).getByRole("textbox", {
          name: "Message to the AI assistant",
        }),
      );
    });
  });

  it("leaves focus where the user moved it when the answer ends", async () => {
    const stream = createControlledAiChatStream();
    const rendered = renderPanel({
      fetchImpl: createAiFetch(() => stream.response),
    });
    const panel = await sendWithButton(rendered);
    const outside = screen.getByRole("button", { name: "outside" });
    act(() => {
      outside.focus();
    });

    await act(async () => {
      stream.finish(textChunks("Done"));
      await Promise.resolve();
    });
    await within(panel).findByText("Done");

    expect(document.activeElement).toBe(outside);
  });

  it("keeps focus on the send button as it becomes the stop button", async () => {
    const rendered = renderPanel({
      fetchImpl: createAiFetch(() => openAiChatStreamResponse("Thinking")),
    });
    const panel = await openChat(rendered);
    await rendered.user.type(
      within(panel).getByRole("textbox", {
        name: "Message to the AI assistant",
      }),
      "Add a table",
    );

    await rendered.user.click(
      within(panel).getByRole("button", { name: "Send" }),
    );

    expect(document.activeElement).toBe(
      within(panel).getByRole("button", { name: "Stop" }),
    );
  });

  it("returns focus to the launcher when the window closes", async () => {
    const rendered = renderPanel();
    const panel = await openChat(rendered);

    await rendered.user.click(
      within(panel).getByRole("button", { name: "Close AI assistant" }),
    );

    expect(screen.queryByRole("dialog", { name: "AI assistant" })).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "AI assistant", expanded: false }),
    );
  });

  it("is a non-modal dialog that the launcher opens, controls and closes", async () => {
    const rendered = renderPanel();
    const launcher = screen.getByRole("button", {
      name: "AI assistant",
      expanded: false,
    });

    const panel = await openChat(rendered);

    expect(panel.getAttribute("aria-modal")).toBe("false");
    expect(getOpenLauncher()).toBe(launcher);
    const controlled = document.getElementById(
      launcher.getAttribute("aria-controls") ?? "",
    );
    expect(controlled?.contains(panel)).toBe(true);
    await rendered.user.click(launcher);
    expect(screen.queryByRole("dialog", { name: "AI assistant" })).toBeNull();
    expect(launcher.getAttribute("aria-expanded")).toBe("false");
    expect(launcher.hasAttribute("aria-controls")).toBe(false);
  });

  it("closes on Escape and returns focus to the launcher", async () => {
    const rendered = renderPanel();
    await openChat(rendered);

    await rendered.user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "AI assistant" })).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "AI assistant", expanded: false }),
    );
  });

  it("keeps the rest of the page usable while it is open", async () => {
    const rendered = renderPanel();
    await openChat(rendered);

    await rendered.user.click(screen.getByRole("button", { name: "outside" }));

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "outside" }),
    );
    expect(screen.getByRole("dialog", { name: "AI assistant" })).toBeDefined();
  });

  it("announces the end of a turn once while the window is open, outside the log", async () => {
    const rendered = renderPanel();
    const panel = await openChat(rendered);
    await sendMessage(rendered, "Hello");
    await within(panel).findByText("Hi there");

    const status = await screen.findByText(FINISHED_STATUS);
    expect(screen.getAllByText(FINISHED_STATUS)).toHaveLength(1);
    expect(status.getAttribute("role")).toBe("status");
    expect(panel.contains(status)).toBe(false);
    expect(
      within(panel)
        .getByRole("log", { name: "Conversation" })
        .getAttribute("aria-busy"),
    ).toBe("false");
  });

  it("marks the launcher when a reply ends while the window is closed, until it opens", async () => {
    const stream = createControlledAiChatStream();
    const rendered = renderPanel({
      fetchImpl: createAiFetch(() => stream.response),
    });
    const panel = await sendWithButton(rendered);
    await rendered.user.click(
      within(panel).getByRole("button", { name: "Close AI assistant" }),
    );

    await act(async () => {
      stream.finish(textChunks("Done"));
      await Promise.resolve();
    });
    const launcher = await screen.findByRole("button", {
      name: "AI assistant, new reply",
      expanded: false,
    });
    // The window is gone, yet the end of the turn is still announced, once.
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getAllByText(FINISHED_STATUS)).toHaveLength(1);
    await rendered.user.click(launcher);

    const reopened = await screen.findByRole("dialog", {
      name: "AI assistant",
    });
    expect(within(reopened).getByText("Done")).toBeDefined();
    expect(screen.getAllByText(FINISHED_STATUS)).toHaveLength(1);
    await rendered.user.click(getOpenLauncher());
    expect(
      screen.getByRole("button", { name: "AI assistant", expanded: false }),
    ).toBe(launcher);
  });

  it("keeps the draft while minimized and shows only the header", async () => {
    const rendered = renderPanel();
    const panel = await openChat(rendered);
    await rendered.user.type(
      within(panel).getByRole("textbox", {
        name: "Message to the AI assistant",
      }),
      "A draft",
    );

    await rendered.user.click(
      within(panel).getByRole("button", { name: "Minimize" }),
    );
    expect(within(panel).queryByRole("textbox")).toBeNull();
    expect(
      within(panel).getByRole("heading", { name: "AI assistant" }),
    ).toBeDefined();
    await rendered.user.click(
      within(panel).getByRole("button", { name: "Restore" }),
    );

    expect(
      within(panel).getByRole("textbox", {
        name: "Message to the AI assistant",
      }),
    ).toHaveProperty("value", "A draft");
  });

  it("expands and shrinks the window", async () => {
    const rendered = renderPanel();
    const panel = await openChat(rendered);

    await rendered.user.click(
      within(panel).getByRole("button", { name: "Expand window" }),
    );
    await rendered.user.click(
      within(panel).getByRole("button", { name: "Shrink window" }),
    );

    expect(
      within(panel).getByRole("button", { name: "Expand window" }),
    ).toBeDefined();
  });

  it("offers no expand on a narrow screen, where it is a full-screen sheet", async () => {
    stubNarrowViewport();
    const rendered = renderPanel();

    const panel = await openChat(rendered);

    expect(
      within(panel).queryByRole("button", { name: "Expand window" }),
    ).toBeNull();
    expect(
      within(panel).getByRole("button", { name: "Minimize" }),
    ).toBeDefined();
  });

  async function minimizeWithPreview(rendered: Rendered): Promise<HTMLElement> {
    const panel = await openChat(rendered);
    await sendMessage(rendered, "Drop the email");
    await within(panel).findByRole("button", { name: "Accept" });
    await rendered.user.click(
      within(panel).getByRole("button", { name: "Minimize" }),
    );
    return panel;
  }

  it("keeps Accept and Discard of a live preview while minimized", async () => {
    const rendered = renderPanel({
      fetchImpl: createAiFetch(() =>
        aiChatStreamResponse([proposalChunk(REMOVE_EMAIL)]),
      ),
    });
    const panel = await minimizeWithPreview(rendered);

    const actions = within(panel).getByRole("group", {
      name: "Proposed changes",
    });
    await rendered.user.click(
      within(actions).getByRole("button", { name: "Discard" }),
    );

    expect(
      within(panel).queryByRole("group", { name: "Proposed changes" }),
    ).toBeNull();
    await waitFor(() => {
      expect(document.activeElement).toBe(
        within(panel).getByRole("button", { name: "Restore" }),
      );
    });
  });

  it("confirms a destructive accept while minimized, and Escape there leaves the window open", async () => {
    const rendered = renderPanel({
      fetchImpl: createAiFetch(() =>
        aiChatStreamResponse([proposalChunk(REMOVE_EMAIL)]),
      ),
    });
    const panel = await minimizeWithPreview(rendered);
    await rendered.user.click(
      within(panel).getByRole("button", { name: "Accept" }),
    );
    await rendered.user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("dialog", { name: "AI assistant" })).toBe(panel);

    await rendered.user.click(
      within(panel).getByRole("button", { name: "Accept" }),
    );
    await rendered.user.click(
      screen.getByRole("button", { name: "Accept and delete" }),
    );

    expect(
      within(panel).queryByRole("group", { name: "Proposed changes" }),
    ).toBeNull();
    await waitFor(() => {
      expect(document.activeElement).toBe(
        within(panel).getByRole("button", { name: "Restore" }),
      );
    });
  });

  it("starts a new conversation", async () => {
    const rendered = renderPanel();
    const panel = await openChat(rendered);
    await sendMessage(rendered, "Hello");
    await within(panel).findByText("Hi there");

    await rendered.user.click(
      within(panel).getByRole("button", { name: "New conversation" }),
    );

    expect(within(panel).queryByText("Hello")).toBeNull();
    expect(
      within(panel).getByRole("group", { name: "Quick actions" }),
    ).toBeDefined();
  });

  it("keeps the conversation after the panel is closed and opened again", async () => {
    const rendered = renderPanel();
    const panel = await openChat(rendered);
    await sendMessage(rendered, "Hello");
    await within(panel).findByText("Hi there");

    await rendered.user.click(
      within(panel).getByRole("button", { name: "Close AI assistant" }),
    );
    const reopened = await openPanel(rendered);

    expect(within(reopened).getByText("Hello")).toBeDefined();
    expect(within(reopened).getByText("Hi there")).toBeDefined();
  });

  it("keeps each message's time when the window is closed and opened again", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 5, 9, 30));
    const rendered = renderPanel();
    const panel = await openChat(rendered);
    await sendMessage(rendered, "Hello");
    await within(panel).findByText("Hi there");

    vi.setSystemTime(new Date(2026, 9, 5, 9, 45));
    await rendered.user.click(getOpenLauncher());
    const reopened = await openPanel(rendered);

    expect(within(reopened).getAllByText("09:30")).toHaveLength(2);
    expect(within(reopened).queryByText("09:45")).toBeNull();
  });

  it("keeps the draft when the window is closed with Escape and opened again", async () => {
    const rendered = renderPanel();
    const panel = await openChat(rendered);
    await rendered.user.type(getComposer(panel), "Half a thought");

    await rendered.user.keyboard("{Escape}");
    const reopened = await openPanel(rendered);

    expect(getComposer(reopened)).toHaveProperty("value", "Half a thought");
  });

  it("stays open on Escape while an IME is composing", async () => {
    const rendered = renderPanel();
    const panel = await openChat(rendered);

    fireEvent.keyDown(getComposer(panel), { key: "Escape", isComposing: true });

    expect(screen.getByRole("dialog", { name: "AI assistant" })).toBe(panel);
  });

  it("is a modal sheet without the launcher under it on a narrow screen", async () => {
    stubNarrowViewport();
    const rendered = renderPanel();

    const panel = await openChat(rendered);
    expect(panel.getAttribute("aria-modal")).toBe("true");
    expect(screen.queryByRole("button", { name: "AI assistant" })).toBeNull();
    await rendered.user.click(
      within(panel).getByRole("button", { name: "Minimize" }),
    );
    expect(panel.getAttribute("aria-modal")).toBe("false");
    expect(screen.queryByRole("button", { name: "AI assistant" })).toBeNull();
    await rendered.user.click(
      within(panel).getByRole("button", { name: "Close AI assistant" }),
    );

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "AI assistant", expanded: false }),
    );
  });

  it("marks a reply that ends while minimized as unread until the window is restored", async () => {
    const stream = createControlledAiChatStream();
    const rendered = renderPanel({
      fetchImpl: createAiFetch(() => stream.response),
    });
    const panel = await sendWithButton(rendered);
    await rendered.user.click(
      within(panel).getByRole("button", { name: "Minimize" }),
    );

    await act(async () => {
      stream.finish(textChunks("Done"));
      await Promise.resolve();
    });
    expect(
      await screen.findByRole("button", {
        name: "AI assistant, new reply",
        expanded: true,
      }),
    ).toBeDefined();
    await rendered.user.click(
      within(panel).getByRole("button", { name: "Restore, new reply" }),
    );

    expect(getOpenLauncher()).toBeDefined();
  });

  it("does not mark a failed reply as unread", async () => {
    const stream = createControlledAiChatStream();
    const rendered = renderPanel({
      fetchImpl: createAiFetch(() => stream.response),
    });
    const panel = await sendWithButton(rendered);
    await rendered.user.click(
      within(panel).getByRole("button", { name: "Close AI assistant" }),
    );

    await act(async () => {
      stream.finish([{ type: "error", errorText: "ai-timeout" }]);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).not.toBe("");
    });
    expect(
      screen.getByRole("button", { name: "AI assistant", expanded: false }),
    ).toBeDefined();
  });

  it("announces a failure once while the window is open: in the log, not the status region", async () => {
    const rendered = renderPanel({
      fetchImpl: createAiFetch(() =>
        jsonResponse(503, { statusCode: 503, code: "ai-unavailable" }),
      ),
    });
    const panel = await openChat(rendered);

    await sendMessage(rendered, "Hello");
    await within(panel).findByRole("button", { name: "Try again" });

    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("announces a failure in the status region when the window is closed", async () => {
    const stream = createControlledAiChatStream();
    const rendered = renderPanel({
      fetchImpl: createAiFetch(() => stream.response),
    });
    const panel = await sendWithButton(rendered);
    await rendered.user.click(
      within(panel).getByRole("button", { name: "Close AI assistant" }),
    );

    await act(async () => {
      stream.finish([{ type: "error", errorText: "ai-timeout" }]);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).not.toBe("");
    });
    expect(screen.getByRole("status").textContent).not.toBe(
      "The assistant is responding",
    );
  });

  describe("with an exit animation", () => {
    function stubExitAnimation(): void {
      const realGetComputedStyle = window.getComputedStyle.bind(window);
      vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
        const style = realGetComputedStyle(element);
        return element.getAttribute("data-state") === "closed"
          ? Object.assign(style, { animationName: "exit" })
          : style;
      });
    }

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("focuses the window when it opens again while still animating out", async () => {
      stubExitAnimation();
      const rendered = renderPanel();
      const panel = await openChat(rendered);

      await rendered.user.click(getOpenLauncher());
      expect(panel.isConnected).toBe(true);
      await rendered.user.click(
        screen.getByRole("button", { name: "AI assistant", expanded: false }),
      );

      expect(document.activeElement).toBe(getComposer(panel));
    });

    it("unmounts when the exit animation is cancelled", async () => {
      stubExitAnimation();
      const rendered = renderPanel();
      const panel = await openChat(rendered);
      await rendered.user.click(getOpenLauncher());
      const frame = document.getElementById(WINDOW_ID);

      act(() => {
        frame?.dispatchEvent(new Event("animationcancel"));
      });

      expect(panel.isConnected).toBe(false);
    });

    it("unmounts after a short fallback when the animation never ends", async () => {
      stubExitAnimation();
      const rendered = renderPanel();
      const panel = await openChat(rendered);

      await rendered.user.click(getOpenLauncher());

      await waitFor(() => {
        expect(panel.isConnected).toBe(false);
      });
    });
  });

  type AxeCase = {
    readonly options: PanelOptions;
    readonly arrange: (rendered: Rendered) => Promise<HTMLElement>;
  };
  const AXE_CASES: Readonly<Record<string, AxeCase>> = {
    "the closed launcher": {
      options: {},
      arrange: () => Promise.resolve(document.body),
    },
    guest: {
      options: { isSignedIn: false },
      arrange: async (rendered) => {
        const panel = await openPanel(rendered);
        await within(panel).findByRole("link", { name: "Sign in" });
        return panel;
      },
    },
    "no consent": {
      options: { hasConsent: false },
      arrange: async (rendered) => {
        const panel = await openPanel(rendered);
        await within(panel).findByRole("button", {
          name: "Agree and continue",
        });
        return panel;
      },
    },
    "an empty conversation": { options: {}, arrange: openChat },
    "a streaming answer": {
      options: {
        fetchImpl: createAiFetch(() => openAiChatStreamResponse("Thinking")),
      },
      arrange: async (rendered) => {
        const panel = await openChat(rendered);
        await sendMessage(rendered, "Hello");
        await within(panel).findByText("Thinking");
        return panel;
      },
    },
    "a failed answer": {
      options: {
        fetchImpl: createAiFetch(() =>
          jsonResponse(503, { statusCode: 503, code: "ai-unavailable" }),
        ),
      },
      arrange: async (rendered) => {
        const panel = await openChat(rendered);
        await sendMessage(rendered, "Hello");
        await within(panel).findByRole("button", { name: "Try again" });
        return panel;
      },
    },
  };

  it.each(
    Object.entries(AXE_CASES).flatMap(([name, axeCase]) =>
      (["light", "dark"] as const).map(
        (theme) => [name, theme, axeCase] as const,
      ),
    ),
  )(
    "has no axe violations for %s in the %s theme",
    async (_name, theme, axeCase) => {
      const rendered = renderPanel({
        ...axeCase.options,
        themePreference: theme,
      });
      await axeCase.arrange(rendered);

      // The whole page: the launcher and the window together.
      await expectNoAxeViolations(rendered.container);
    },
  );
});
