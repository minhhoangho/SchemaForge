import type { Operation, SchemaDocument } from "@schemaforge/core";
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

import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";
import type { StorageBundle } from "@/lib/storage/create-browser-storage";
import { SchemaforgeDatabase } from "@/lib/storage/database";
import { createSchemaLockManager } from "@/lib/storage/schema-lock-manager";
import { createSchemaRepository } from "@/lib/storage/schema-repository";
import {
  aiChatStreamResponse,
  createAiFetch,
  proposalChunk,
} from "@/testing/ai-chat-stream";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { createFakeLockRegistry } from "@/testing/fake-lock-registry";
import { renderWithProviders } from "@/testing/render-with-providers";

import type { ViewportControls } from "../../lib/viewport-controls";
import { ViewportControlsProvider } from "../../lib/viewport-controls";
import {
  AiChatStoreProvider,
  useAiChatStore,
  useAiChatStoreApi,
} from "../../state/ai-chat-store-provider";
import type { AiChatStore } from "../../state/create-ai-chat-store";
import {
  createEditorStore,
  selectIsPreviewing,
} from "../../state/create-editor-store";
import type { EditorStore } from "../../state/create-editor-store";
import { EditorStoreProvider } from "../../state/editor-store-provider";
import { useEditorStore } from "../../state/use-editor-store";
import { buildAddTableOperation } from "../../lib/build-add-table-operation";
import { AiMessageList } from "./ai-message-list";
import { AI_PANEL_TOGGLE_ID } from "./ai-panel-ids";
import { ProposalPreviewBar } from "./proposal-preview-bar";

const USERS_POSITION = { x: 120, y: 80 };
const ADD_PHONE: Operation = {
  type: "addColumn",
  column: makeColumn({ id: "col_phone", tableId: "tbl_users", name: "phone" }),
  insertAt: 2,
};
const REMOVE_EMAIL: Operation = { type: "removeColumn", columnId: "col_email" };

function createDocument(): SchemaDocument {
  return buildSchema({
    name: "shop",
    tables: [
      makeTable({ id: "tbl_users", name: "users", position: USERS_POSITION }),
    ],
    columns: [
      makeColumn({ id: "col_id", tableId: "tbl_users", name: "id" }),
      makeColumn({ id: "col_email", tableId: "tbl_users", name: "email" }),
    ],
  });
}

const databases = new Set<SchemaforgeDatabase>();

afterEach(() => {
  vi.unstubAllGlobals();
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

type Captured = { store: AiChatStore | null };

// The card the bar returns focus to lives in the conversation, so the
// harness renders the conversation next to the bar, as the workspace does.
type HarnessProps = {
  readonly captured: Captured;
  // False: the AI panel is closed, so no card is on screen.
  readonly isPanelOpen: boolean;
};

function Harness({ captured, isPanelOpen }: HarnessProps): JSX.Element {
  captured.store = useAiChatStoreApi();
  const messages = useAiChatStore((state) => state.messages);
  const acceptProposal = useAiChatStore((state) => state.acceptProposal);
  const discardProposal = useAiChatStore((state) => state.discardProposal);
  const isPreviewing = useEditorStore(selectIsPreviewing);
  return (
    <>
      <button id={AI_PANEL_TOGGLE_ID} type="button">
        toggle
      </button>
      {isPreviewing && <ProposalPreviewBar />}
      {isPanelOpen && (
        <AiMessageList
          messages={messages}
          isSending={false}
          onSend={vi.fn<(text: string) => void>()}
          onRetry={vi.fn<() => void>()}
          onAccept={(id) => {
            acceptProposal(id);
          }}
          onDiscard={discardProposal}
        />
      )}
    </>
  );
}

type Rendered = ReturnType<typeof renderWithProviders> & {
  readonly editor: EditorStore;
  readonly controls: ViewportControls;
};

type PreviewOptions = {
  readonly themePreference?: "light" | "dark";
  readonly isPanelOpen?: boolean;
};

async function renderPreview(
  operation: Operation,
  { themePreference = "light", isPanelOpen = true }: PreviewOptions = {},
): Promise<Rendered> {
  const editor = createEditorStore({
    schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    document: createDocument(),
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
  const controls: ViewportControls = {
    zoomIn: vi.fn<ViewportControls["zoomIn"]>(),
    zoomOut: vi.fn<ViewportControls["zoomOut"]>(),
    fitView: vi.fn<ViewportControls["fitView"]>(),
    setCenter: vi.fn<ViewportControls["setCenter"]>(),
    getZoom: vi.fn<ViewportControls["getZoom"]>(() => 1.5),
  };
  const captured: Captured = { store: null };
  const result = renderWithProviders(
    <EditorStoreProvider store={editor}>
      <AiChatStoreProvider>
        <ViewportControlsProvider controls={controls}>
          <Harness captured={captured} isPanelOpen={isPanelOpen} />
        </ViewportControlsProvider>
      </AiChatStoreProvider>
    </EditorStoreProvider>,
    {
      locale: "en",
      themePreference,
      auth: {
        storage: createStorage(),
        dependencies: {
          fetchImpl: createAiFetch(() =>
            aiChatStreamResponse([proposalChunk(operation)]),
          ),
        },
      },
    },
  );
  const { store } = captured;
  if (store === null) {
    throw new Error("The conversation store was not captured.");
  }
  await act(async () => {
    await store.getState().send("change the schema");
  });
  return { ...result, editor, controls };
}

function getBar(): HTMLElement {
  return screen.getByRole("region", { name: "Proposal preview" });
}

describe("ProposalPreviewBar", () => {
  it("summarizes the counts and accepts", async () => {
    const { user, editor } = await renderPreview(REMOVE_EMAIL);
    expect(within(getBar()).getByText("1 column removed")).toBeDefined();

    await user.click(within(getBar()).getByRole("button", { name: "Accept" }));
    await user.click(screen.getByRole("button", { name: "Accept and delete" }));

    expect(editor.getState().document.columns).not.toHaveProperty("col_email");
    expect(
      screen.queryByRole("region", { name: "Proposal preview" }),
    ).toBeNull();
  });

  it("asks for confirmation when tables or columns are removed", async () => {
    const { user, editor } = await renderPreview(REMOVE_EMAIL);

    await user.click(within(getBar()).getByRole("button", { name: "Accept" }));

    const dialog = screen.getByRole("alertdialog", {
      name: "Delete data with this proposal?",
    });
    expect(dialog).toBeDefined();
    expect(editor.getState().document.columns).toHaveProperty("col_email");
  });

  it("accepts a proposal without removals right away and focuses the card", async () => {
    const { user, editor } = await renderPreview(ADD_PHONE);

    await user.click(within(getBar()).getByRole("button", { name: "Accept" }));

    expect(editor.getState().document.columns).toHaveProperty("col_phone");
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("group", { name: "Proposed changes" }),
      );
    });
  });

  it("discards and returns focus to the proposal card", async () => {
    const { user, editor } = await renderPreview(REMOVE_EMAIL);

    await user.click(within(getBar()).getByRole("button", { name: "Discard" }));

    expect(editor.getState().proposal).toBeNull();
    expect(editor.getState().document.columns).toHaveProperty("col_email");
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("group", { name: "Proposed changes" }),
      );
    });
  });

  it("reveals the first added or changed table when a preview starts", async () => {
    const { controls } = await renderPreview(ADD_PHONE);

    expect(controls.setCenter).toHaveBeenCalledWith(
      USERS_POSITION.x,
      USERS_POSITION.y,
      expect.objectContaining({ zoom: 1.5 }),
    );
  });

  it.each(["light", "dark"] as const)(
    "has no axe violations in the %s theme",
    async (themePreference) => {
      await renderPreview(REMOVE_EMAIL, { themePreference });

      await expectNoAxeViolations(getBar());
    },
  );

  it("reveals an added table at its preview position", async () => {
    const position = { x: 640, y: 320 };
    const { operation } = buildAddTableOperation(createDocument(), {
      position,
      generateId: () => "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    });

    const { controls } = await renderPreview(operation);

    expect(controls.setCenter).toHaveBeenCalledWith(
      position.x,
      position.y,
      expect.objectContaining({ zoom: 1.5 }),
    );
  });

  it("moves without a transition under reduced motion", async () => {
    vi.stubGlobal("matchMedia", (media: string) => ({
      matches: media === "(prefers-reduced-motion: reduce)",
      media,
      addEventListener: (): void => undefined,
      removeEventListener: (): void => undefined,
    }));

    const { controls } = await renderPreview(ADD_PHONE);

    expect(controls.setCenter).toHaveBeenCalledWith(
      USERS_POSITION.x,
      USERS_POSITION.y,
      { zoom: 1.5, duration: 0 },
    );
  });

  it("focuses the AI toggle after a decision while the panel is closed", async () => {
    const { user } = await renderPreview(ADD_PHONE, { isPanelOpen: false });

    await user.click(within(getBar()).getByRole("button", { name: "Discard" }));

    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "toggle" }),
      );
    });
  });
});
