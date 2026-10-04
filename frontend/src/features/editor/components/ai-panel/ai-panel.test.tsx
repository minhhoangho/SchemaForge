import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeTable,
} from "@schemaforge/core/testing";
import { act, screen, waitFor, within } from "@testing-library/react";
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
  textChunks,
} from "@/testing/ai-chat-stream";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { createFakeLockRegistry } from "@/testing/fake-lock-registry";
import { renderWithProviders } from "@/testing/render-with-providers";

import type { ViewportControls } from "../../lib/viewport-controls";
import { ViewportControlsProvider } from "../../lib/viewport-controls";
import { AiChatStoreProvider } from "../../state/ai-chat-store-provider";
import { createEditorStore } from "../../state/create-editor-store";
import { EditorStoreProvider } from "../../state/editor-store-provider";
import { useEditorStore } from "../../state/use-editor-store";
import { aiConsentKey } from "./ai-consent";
import { AiPanel } from "./ai-panel";
import { AI_PANEL_TOGGLE_ID } from "./ai-panel-ids";

const EDITOR_PATH = "/schemas/0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4";

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

// The toolbar toggle and the right column, as the workspace renders them.
function PanelHarness(): JSX.Element {
  const isOpen = useEditorStore((state) => state.rightPanelMode === "ai");
  const setRightPanelMode = useEditorStore((state) => state.setRightPanelMode);
  return (
    <>
      <button
        id={AI_PANEL_TOGGLE_ID}
        type="button"
        onClick={() => {
          setRightPanelMode(isOpen ? "properties" : "ai");
        }}
      >
        toggle
      </button>
      {isOpen && <AiPanel id="ai-panel" />}
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
      columns: [makeColumn({ id: "col_id", tableId: "tbl_users", name: "id" })],
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
  await rendered.user.click(screen.getByRole("button", { name: "toggle" }));
  return screen.getByRole("region", { name: "AI assistant" });
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
    expect(
      within(panel).queryByRole("group", { name: "Quick actions" }),
    ).toBeNull();
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
    const toggle = screen.getByRole("button", { name: "toggle" });
    act(() => {
      toggle.focus();
    });

    await act(async () => {
      stream.finish(textChunks("Done"));
      await Promise.resolve();
    });
    await within(panel).findByText("Done");

    expect(document.activeElement).toBe(toggle);
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

  it("returns focus to the toolbar button when the panel closes", async () => {
    const rendered = renderPanel();
    const panel = await openChat(rendered);

    await rendered.user.click(
      within(panel).getByRole("button", { name: "Close AI assistant" }),
    );

    expect(screen.queryByRole("region", { name: "AI assistant" })).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "toggle" }),
    );
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

  type AxeCase = {
    readonly options: PanelOptions;
    readonly arrange: (rendered: Rendered) => Promise<HTMLElement>;
  };
  const AXE_CASES: Readonly<Record<string, AxeCase>> = {
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
      const panel = await axeCase.arrange(rendered);

      await expectNoAxeViolations(panel);
    },
  );
});
