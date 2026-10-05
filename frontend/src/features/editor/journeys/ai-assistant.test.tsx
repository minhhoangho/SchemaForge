import type { Operation } from "@schemaforge/core";
import {
  createCounterIdGenerator,
  makeColumn,
  makeEnum,
  makeRelation,
} from "@schemaforge/core/testing";
import { screen, waitFor, within } from "@testing-library/react";
import { Dexie } from "dexie";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { toast } from "sonner";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  clearJourneyCookies,
  createCloudJourneyEnvironment,
  setJourneyTestTimeout,
} from "@/testing/cloud-journeys/mount-cloud-journey";
import type { CloudJourneyEnvironment } from "@/testing/cloud-journeys/mount-cloud-journey";
import type { FakeAiTurn } from "@/testing/fake-ai-chat";
import { queryEdgeNames, queryOutlineRow } from "@/testing/journey-queries";

setJourneyTestTimeout();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn<(href: string) => void>(),
    replace: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
  }),
  usePathname: () => "/schemas",
}));

const LAZY_PANEL_TIMEOUT_MS = 10_000;
const EMAIL = "user@example.com";
const PASSWORD = "stapler-42";

beforeAll(() => {
  // liveQuery skips every query while Dexie finds no global IndexedDB.
  Dexie.dependencies.indexedDB = new IDBFactory();
  Dexie.dependencies.IDBKeyRange = IDBKeyRange;
});

afterEach(() => {
  toast.dismiss();
  // The consent is remembered per account, in local storage.
  localStorage.clear();
  clearJourneyCookies();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function addTableStep(id: `tbl_${string}`, name: string, x: number): Operation {
  return {
    type: "addTable",
    table: {
      id,
      name,
      comment: "",
      position: { x, y: 0 },
      subjectAreaId: null,
    },
  };
}

// Two tables, a relation between them and an enum, as one proposal.
function buildSystemOperation(): Operation {
  const nextId = createCounterIdGenerator();
  const usersId = `tbl_${nextId()}` as const;
  const ordersId = `tbl_${nextId()}` as const;
  const usersPk = `col_${nextId()}` as const;
  const ordersPk = `col_${nextId()}` as const;
  const ordersUser = `col_${nextId()}` as const;
  return {
    type: "batch",
    operations: [
      addTableStep(usersId, "users", 0),
      addTableStep(ordersId, "orders", 400),
      {
        type: "addColumn",
        column: makeColumn({ id: usersPk, tableId: usersId, name: "id" }),
        insertAt: 0,
      },
      {
        type: "addColumn",
        column: makeColumn({ id: ordersPk, tableId: ordersId, name: "id" }),
        insertAt: 0,
      },
      {
        type: "addColumn",
        column: makeColumn({
          id: ordersUser,
          tableId: ordersId,
          name: "user_id",
        }),
        insertAt: 1,
      },
      { type: "setPrimaryKey", tableId: usersId, columnIds: [usersPk] },
      { type: "setPrimaryKey", tableId: ordersId, columnIds: [ordersPk] },
      {
        type: "addRelation",
        relation: makeRelation({
          id: `rel_${nextId()}` as const,
          fromTableId: ordersId,
          toTableId: usersId,
          columnPairs: [{ fromColumnId: ordersUser, toColumnId: usersPk }],
        }),
      },
      {
        type: "addEnum",
        enum: makeEnum({ id: `enum_${nextId()}` as const, name: "status" }),
      },
    ],
  };
}

const SYSTEM_TURN: FakeAiTurn = {
  text: "I designed a small shop.",
  proposal: { operation: buildSystemOperation() },
};

async function openAssistant(): Promise<{
  readonly environment: CloudJourneyEnvironment;
  readonly user: ReturnType<CloudJourneyEnvironment["mountEditor"]>["user"];
}> {
  const environment = createCloudJourneyEnvironment();
  const schemaId = await environment.createGuestSchema("shop");
  environment.backend.signInAs(
    environment.backend.seedUser({ email: EMAIL, password: PASSWORD }),
  );
  environment.setAuthHint(true);
  const { user } = environment.mountEditor(schemaId);
  // The launcher over the canvas.
  await user.click(
    await screen.findByRole("button", {
      name: "AI assistant",
      expanded: false,
    }),
  );
  await user.click(
    // The panel is a lazy chunk, so its first render can take a while.
    await screen.findByRole(
      "button",
      { name: "Agree and continue" },
      { timeout: LAZY_PANEL_TIMEOUT_MS },
    ),
  );
  return { environment, user };
}

type Journey = Awaited<ReturnType<typeof openAssistant>>;

async function send({ user }: Journey, text: string): Promise<void> {
  await user.type(
    await screen.findByRole("textbox", { name: "Message to the AI assistant" }),
    text,
  );
  await user.click(screen.getByRole("button", { name: "Send" }));
}

function getChatBodies(
  environment: CloudJourneyEnvironment,
): readonly unknown[] {
  return environment.backend.requests
    .filter((request) => request.path === "/ai/chat")
    .map((request) => request.body);
}

describe("AI assistant journey", () => {
  it("describes a system, previews the proposal, accepts it, and undo and redo restore it", async () => {
    const journey = await openAssistant();
    const { user, environment } = journey;
    environment.backend.queueAiTurn(SYSTEM_TURN);

    await send(journey, "A shop with users and orders");

    expect(await screen.findByText("I designed a small shop.")).toBeTruthy();
    const bar = await screen.findByRole("region", { name: "Proposal preview" });
    expect(screen.getAllByText("New").length).toBeGreaterThan(0);
    await user.click(within(bar).getByRole("button", { name: "Accept" }));

    await waitFor(() => {
      expect(queryOutlineRow("users")).not.toBeNull();
    });
    expect(queryOutlineRow("orders")).not.toBeNull();
    expect(queryEdgeNames()).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => {
      expect(queryOutlineRow("users")).toBeNull();
    });
    expect(queryOutlineRow("orders")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Redo" }));
    await waitFor(() => {
      expect(queryOutlineRow("users")).not.toBeNull();
    });
    expect(queryEdgeNames()).toHaveLength(1);
  });

  it("applies a suggestion through a new proposal", async () => {
    const journey = await openAssistant();
    const { user, environment } = journey;
    const SUGGESTION = "Index the user_id column";
    environment.backend.queueAiTurn({
      text: "Here is my review.",
      findings: [
        {
          kind: "suggestion",
          category: "index",
          title: SUGGESTION,
          detail: "Lookups by user are slow.",
          targets: [],
        },
      ],
    });
    environment.backend.queueAiTurn(SYSTEM_TURN);

    await send(journey, "Review my schema");
    await user.click(await screen.findByRole("button", { name: "Apply" }));

    await screen.findByRole("region", { name: "Proposal preview" });
    const bodies = getChatBodies(environment);
    expect(bodies).toHaveLength(2);
    const last = JSON.stringify(bodies[1]);
    expect(last).toContain(SUGGESTION);
  });

  it("sending a message during a preview discards it", async () => {
    const journey = await openAssistant();
    const { environment } = journey;
    environment.backend.queueAiTurn(SYSTEM_TURN);
    environment.backend.queueAiTurn({ text: "Anything else?" });

    await send(journey, "A shop with users and orders");
    await screen.findByRole("region", { name: "Proposal preview" });

    await send(journey, "Never mind");

    await waitFor(() => {
      expect(
        screen.queryByRole("region", { name: "Proposal preview" }),
      ).toBeNull();
    });
    expect(queryOutlineRow("users")).toBeNull();
    const bodies = getChatBodies(environment);
    expect(JSON.stringify(bodies[1])).toContain(
      '"proposalOutcome":"discarded"',
    );
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Discard" })).toBeNull();
  });
});
