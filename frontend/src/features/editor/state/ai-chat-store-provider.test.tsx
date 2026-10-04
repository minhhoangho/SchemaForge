import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeTable,
} from "@schemaforge/core/testing";
import { act, render, screen } from "@testing-library/react";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import type { JSX } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "@/components/auth-provider";
import type { Locale } from "@/lib/i18n/supported-locales";
import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";
import type { StorageBundle } from "@/lib/storage/create-browser-storage";
import { SchemaforgeDatabase } from "@/lib/storage/database";
import { createSchemaLockManager } from "@/lib/storage/schema-lock-manager";
import { createSchemaRepository } from "@/lib/storage/schema-repository";
import { StorageProvider } from "@/lib/storage/storage-context";
import { createFakeLockRegistry } from "@/testing/fake-lock-registry";
import { renderWithProviders } from "@/testing/render-with-providers";

import {
  AI_COMMIT_ON_PREVIEW_ATTRIBUTE,
  AiChatStoreProvider,
  commitPendingEdits,
  useAiChatStore,
  useAiChatStoreApi,
} from "./ai-chat-store-provider";
import { createEditorStore } from "./create-editor-store";
import type { EditorStore } from "./create-editor-store";
import { EditorStoreProvider } from "./editor-store-provider";

function createEditor(): EditorStore {
  return createEditorStore({
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
}

type Captured = { store: ReturnType<typeof useAiChatStoreApi> | null };

const databases = new Set<SchemaforgeDatabase>();

afterEach(() => {
  databases.forEach((database) => {
    database.close();
  });
  databases.clear();
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

function Probe({ captured }: { readonly captured: Captured }): JSX.Element {
  captured.store = useAiChatStoreApi();
  const count = useAiChatStore((state) => state.messages.length);
  return <p>messages: {count}</p>;
}

function AuthControls(): JSX.Element {
  const status = useAuth((state) => state.auth.status);
  const markSignedOut = useAuth((state) => state.markSignedOut);
  const signIn = useAuth((state) => state.signIn);
  return (
    <div>
      <p>{`status:${status}`}</p>
      <button type="button" onClick={markSignedOut}>
        leave
      </button>
      <button
        type="button"
        onClick={() => {
          void signIn({ email: "b@example.com", password: "b".repeat(12) });
        }}
      >
        switch
      </button>
    </div>
  );
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function userResponse(id: string): Response {
  return jsonResponse({
    user: {
      id,
      email: `${id}@example.com`,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  });
}

function getStore(captured: Captured): NonNullable<Captured["store"]> {
  if (captured.store === null) {
    throw new Error("store not captured");
  }
  return captured.store;
}

async function sendOnce(captured: Captured): Promise<void> {
  await act(async () => {
    await getStore(captured).getState().send("hello");
  });
}

function textStream(text: string): Response {
  const chunks = [
    { type: "start" },
    { type: "text-start", id: "t1" },
    { type: "text-delta", id: "t1", delta: text },
    { type: "text-end", id: "t1" },
    { type: "finish" },
  ];
  const body = `${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("")}data: [DONE]\n\n`;
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

type RenderOptions = {
  readonly locale?: Locale;
  readonly fetchImpl?: typeof fetch;
  readonly editor?: EditorStore;
  readonly hasAuthHint?: boolean;
};

// The real AuthProvider and transport; only fetch is a stand-in.
function renderProvider(captured: Captured, options: RenderOptions = {}) {
  const fetchImpl: typeof fetch =
    options.fetchImpl ?? (() => Promise.resolve(textStream("ok")));
  const editor = options.editor ?? createEditor();
  const buildTree = (): JSX.Element => (
    <EditorStoreProvider store={editor}>
      <AiChatStoreProvider>
        <Probe captured={captured} />
        <AuthControls />
      </AiChatStoreProvider>
    </EditorStoreProvider>
  );
  return renderWithProviders(buildTree(), {
    locale: options.locale ?? "en",
    auth: {
      storage: createStorage(),
      hasAuthHint: options.hasAuthHint ?? false,
      dependencies: {
        fetchImpl,
        cookieJar: { cookie: options.hasAuthHint ? "sf-auth-hint=1" : "" },
      },
    },
  });
}

describe("AiChatStoreProvider", () => {
  it("provides one store to its children", () => {
    const captured: Captured = { store: null };
    const { rerender } = renderProvider(captured);
    const initial = captured.store;

    rerender(
      <EditorStoreProvider store={createEditor()}>
        <AiChatStoreProvider>
          <Probe captured={captured} />
        </AiChatStoreProvider>
      </EditorStoreProvider>,
    );

    expect(screen.getByText("messages: 0")).toBeDefined();
    expect(captured.store).toBe(initial);
  });

  it("throws when the store is read outside the provider", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());

    expect(() => render(<Probe captured={{ store: null }} />)).toThrow(
      /AiChatStoreProvider/,
    );
    errorSpy.mockRestore();
  });

  it("resets the store on unmount", async () => {
    const captured: Captured = { store: null };
    const { unmount } = renderProvider(captured);
    await sendOnce(captured);
    expect(getStore(captured).getState().messages).toHaveLength(2);

    unmount();

    expect(getStore(captured).getState().messages).toEqual([]);
  });

  it("sends through the real transport as a POST to /ai/chat", async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(textStream("answer")),
    );
    const captured: Captured = { store: null };
    renderProvider(captured, { fetchImpl });

    await sendOnce(captured);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url instanceof URL && url.pathname).toBe("/ai/chat");
    expect(init?.method).toBe("POST");
    const last = getStore(captured).getState().messages.at(-1);
    expect(last?.role === "assistant" && last.text).toBe("answer");
  });

  it("sends the interface language as the request locale", async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(textStream("ok")),
    );
    const captured: Captured = { store: null };
    renderProvider(captured, { locale: "vi", fetchImpl });

    await sendOnce(captured);

    const body = fetchImpl.mock.calls[0]?.[1]?.body;
    expect(typeof body === "string" && JSON.parse(body)).toMatchObject({
      locale: "vi",
    });
  });

  it.each([
    ["the user signs out", "leave"],
    ["the account changes", "switch"],
  ])("clears the conversation when %s", async (_name, buttonName) => {
    const fetchImpl = vi.fn<typeof fetch>((input) => {
      const path = input instanceof URL ? input.pathname : "";
      if (path === "/auth/me") {
        return Promise.resolve(
          userResponse("11111111-1111-4111-8111-111111111111"),
        );
      }
      if (path === "/auth/login") {
        return Promise.resolve(
          userResponse("22222222-2222-4222-8222-222222222222"),
        );
      }
      return Promise.resolve(textStream("ok"));
    });
    const captured: Captured = { store: null };
    const { user } = renderProvider(captured, {
      fetchImpl,
      hasAuthHint: true,
    });
    await screen.findByText("status:signed-in");
    await sendOnce(captured);
    expect(getStore(captured).getState().messages).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: buttonName }));

    await vi.waitFor(() => {
      expect(getStore(captured).getState().messages).toEqual([]);
    });
  });

  it("loads no client when there is no transport", async () => {
    const captured: Captured = { store: null };
    // Without injected dependencies the provider builds browser ones, and
    // jsdom has no Web Locks, so there is no transport.
    renderWithProviders(
      <StorageProvider storage={createStorage()}>
        <AuthProvider hasAuthHint={false}>
          <EditorStoreProvider store={createEditor()}>
            <AiChatStoreProvider>
              <Probe captured={captured} />
            </AiChatStoreProvider>
          </EditorStoreProvider>
        </AuthProvider>
      </StorageProvider>,
    );

    await sendOnce(captured);

    const last = getStore(captured).getState().messages.at(-1);
    expect(last?.role === "assistant" && last.failure).toEqual({
      kind: "error",
      code: "internal-error",
    });
  });
});

describe("commitPendingEdits", () => {
  function renderFields(): void {
    render(
      <div>
        <div {...{ [AI_COMMIT_ON_PREVIEW_ATTRIBUTE]: "" }}>
          <input aria-label="inside" />
        </div>
        <input aria-label="outside" />
      </div>,
    );
  }

  it("blurs a focused field inside a commit-on-preview region before a preview starts", () => {
    renderFields();
    const input = screen.getByLabelText("inside");
    const onBlur = vi.fn<() => void>();
    input.addEventListener("blur", onBlur);
    input.focus();

    commitPendingEdits();

    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(document.activeElement).not.toBe(input);
  });

  it("keeps focus outside those regions when a preview starts", () => {
    renderFields();
    const input = screen.getByLabelText("outside");
    input.focus();

    commitPendingEdits();

    expect(document.activeElement).toBe(input);
  });
});
