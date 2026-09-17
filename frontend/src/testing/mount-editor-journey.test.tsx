import { screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getSchemaLockName } from "@/lib/storage/schema-lock-manager";

import { createJourneyEnvironment } from "./mount-editor-journey";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
  }),
}));

afterEach(() => {
  toast.dismiss();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("createJourneyEnvironment", () => {
  it("creates schemas with fixed ids and a counter clock", async () => {
    const environment = createJourneyEnvironment();

    const schemaIds = [
      await environment.createSchema("shop"),
      await environment.createSchema("blog"),
    ];

    expect({
      schemaIds,
      entries: await environment.storage.repository.listSchemas(),
    }).toMatchObject({
      schemaIds: [
        "00000000-0000-4000-8000-000000000001",
        "00000000-0000-4000-8000-000000000002",
      ],
      entries: [
        { kind: "readable", schema: { name: "blog", updatedAt: 2 } },
        { kind: "readable", schema: { name: "shop", updatedAt: 1 } },
      ],
    });
  });

  it("holds the schema lock in the shared registry while an editor is mounted", async () => {
    const environment = createJourneyEnvironment();
    const schemaId = await environment.createSchema("shop");
    const lockName = getSchemaLockName(schemaId);

    const { unmount } = environment.mountEditor(schemaId);
    await screen.findByRole("button", { name: "Schema name shop" });
    const isHeldWhileMounted = environment.lockRegistry.isHeld(lockName);
    unmount();

    await waitFor(() => {
      expect(environment.lockRegistry.isHeld(lockName)).toBe(false);
    });
    expect(isHeldWhileMounted).toBe(true);
  });

  it("mounts the editor in the requested locale", async () => {
    const environment = createJourneyEnvironment();
    const schemaId = await environment.createSchema("shop");

    environment.mountEditor(schemaId, { locale: "vi" });

    expect(
      await screen.findByRole("button", { name: "Tên schema shop" }),
    ).toBeDefined();
  });

  it("sizes an element without an inline height by its list rows", () => {
    createJourneyEnvironment();
    const node = document.createElement("div");
    node.append(document.createElement("li"), document.createElement("li"));

    expect(node.offsetHeight).toBe(60);
  });
});
