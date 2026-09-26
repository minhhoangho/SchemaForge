import { buildSchema, makeTable } from "@schemaforge/core/testing";
import { act, screen, waitFor, within } from "@testing-library/react";
import type * as XYFlow from "@xyflow/react";
import type { ReactFlowProps, Viewport } from "@xyflow/react";
import type { JSX } from "react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  LOCALE_COOKIE_NAME,
  THEME_COOKIE_NAME,
} from "@/lib/preferences/preference-cookies";
import { stubMatchMedia } from "@/testing/match-media-stub";
import {
  createJourneyEnvironment,
  setJourneyTestTimeout,
} from "@/testing/mount-editor-journey";
import type { JourneyEnvironment } from "@/testing/mount-editor-journey";

setJourneyTestTimeout();

// React Flow cannot pan or zoom in jsdom, which has no layout, so the real
// component renders while its props are recorded; a test calls `onMoveEnd`
// the way React Flow does when a pan or zoom ends (spec section 14).
const { recordFlowProps } = vi.hoisted(() => ({
  recordFlowProps: vi.fn<(props: ReactFlowProps) => void>(),
}));

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof XYFlow>();
  function RecordedReactFlow(props: ReactFlowProps): JSX.Element {
    recordFlowProps(props);
    return <actual.ReactFlow {...props} />;
  }
  return { ...actual, ReactFlow: RecordedReactFlow };
});

const { refresh } = vi.hoisted(() => ({
  refresh: vi.fn<() => void>(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn<(href: string) => void>(), refresh }),
  // The toolbar's account menu links back to the current page.
  usePathname: () => "/schemas",
}));

type OpenedEditor = {
  readonly environment: JourneyEnvironment;
  readonly schemaId: string;
};

const STORED_VIEWPORT = { x: 120, y: -40, zoom: 0.75 };

// One table, so the canvas has something to fit.
async function createShop(environment: JourneyEnvironment): Promise<string> {
  const schemaId = await environment.createSchema("shop");
  await environment.storage.repository.saveDocument(
    schemaId,
    buildSchema({ name: "shop", tables: [makeTable({ id: "tbl_users" })] }),
  );
  return schemaId;
}

async function openShop(): Promise<
  OpenedEditor & { readonly unmount: () => void }
> {
  const environment = createJourneyEnvironment();
  const schemaId = await createShop(environment);
  const { unmount } = environment.mountEditor(schemaId);
  await screen.findByRole("button", { name: "Schema name shop" });
  return { environment, schemaId, unmount };
}

function getFlowProps(): ReactFlowProps {
  const props = recordFlowProps.mock.lastCall?.[0];
  if (props === undefined) {
    throw new Error("React Flow has not rendered yet.");
  }
  return props;
}

function endMove(viewport: Viewport): void {
  act(() => {
    getFlowProps().onMoveEnd?.(null, viewport);
  });
}

afterEach(() => {
  // Sonner keeps its toasts in module state, which outlives each render.
  toast.dismiss();
  document.cookie = `${THEME_COOKIE_NAME}=; Path=/; Max-Age=0`;
  document.cookie = `${LOCALE_COOKIE_NAME}=; Path=/; Max-Age=0`;
  recordFlowProps.mockClear();
  refresh.mockClear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("viewport, theme and language journey", () => {
  it("stores the viewport on move end", async () => {
    const { environment, schemaId } = await openShop();

    endMove(STORED_VIEWPORT);

    await waitFor(async () => {
      await expect(
        environment.storage.repository.readViewport(schemaId),
      ).resolves.toEqual({ schemaId, ...STORED_VIEWPORT });
    });
  });

  it("uses the stored viewport when the editor is mounted again", async () => {
    const { environment, schemaId, unmount } = await openShop();
    endMove(STORED_VIEWPORT);
    await waitFor(async () => {
      await expect(
        environment.storage.repository.readViewport(schemaId),
      ).resolves.not.toBeNull();
    });

    unmount();
    recordFlowProps.mockClear();
    environment.mountEditor(schemaId);
    await screen.findByRole("button", { name: "Schema name shop" });

    expect({
      defaultViewport: getFlowProps().defaultViewport,
      fitView: getFlowProps().fitView,
    }).toEqual({ defaultViewport: STORED_VIEWPORT, fitView: false });
  });

  it("fits the view when there is no stored viewport", async () => {
    await openShop();

    expect({
      defaultViewport: getFlowProps().defaultViewport,
      fitView: getFlowProps().fitView,
    }).toEqual({ defaultViewport: undefined, fitView: true });
  });

  it("switches to the dark theme and writes the cookie", async () => {
    const environment = createJourneyEnvironment();
    const schemaId = await createShop(environment);
    const { user } = environment.mountEditor(schemaId);
    await screen.findByRole("button", { name: "Schema name shop" });

    await user.click(screen.getByRole("button", { name: "Theme" }));
    await user.click(
      await screen.findByRole("menuitemradio", { name: "Dark" }),
    );

    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
    expect({
      cookie: document.cookie.includes(`${THEME_COOKIE_NAME}=dark`),
      colorMode: getFlowProps().colorMode,
      isCanvasDark: screen.getByRole("application").classList.contains("dark"),
    }).toEqual({ cookie: true, colorMode: "dark", isCanvasDark: true });
  });

  it("follows the system color scheme", async () => {
    // Restored with the other globals after the test.
    stubMatchMedia({ isDarkPreferred: true });
    const environment = createJourneyEnvironment();
    const schemaId = await createShop(environment);
    const { user } = environment.mountEditor(schemaId);
    await screen.findByRole("button", { name: "Schema name shop" });

    await user.click(screen.getByRole("button", { name: "Theme" }));
    await user.click(
      await screen.findByRole("menuitemradio", { name: "System" }),
    );

    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
    expect({
      cookie: document.cookie.includes(`${THEME_COOKIE_NAME}=system`),
      colorMode: getFlowProps().colorMode,
      isCanvasDark: screen.getByRole("application").classList.contains("dark"),
    }).toEqual({ cookie: true, colorMode: "system", isCanvasDark: true });
  });

  it("switches to English and keeps the undo history", async () => {
    const environment = createJourneyEnvironment();
    const schemaId = await environment.createSchema("shop");
    const { user } = environment.mountEditor(schemaId, { locale: "vi" });
    await screen.findByRole("button", { name: "Tên schema shop" });
    await user.click(
      within(screen.getByRole("banner")).getByRole("button", {
        name: "Thêm bảng",
      }),
    );
    const tableCountBeforeSwitch = screen.getAllByRole("group", {
      name: /^Bảng /,
    }).length;

    await user.click(screen.getByRole("button", { name: "Ngôn ngữ VI" }));
    await user.click(
      await screen.findByRole("menuitemradio", { name: "English" }),
    );
    await screen.findByRole("button", { name: "Language EN" });
    await user.click(screen.getByRole("button", { name: "Undo" }));

    expect({
      tableCountBeforeSwitch,
      lang: document.documentElement.lang,
      cookie: document.cookie.includes(`${LOCALE_COOKIE_NAME}=en`),
      hasEnglishSchemaName: screen.getByRole("button", {
        name: "Schema name shop",
      }).isConnected,
      tableNodes: screen.queryAllByRole("group", { name: /^Table / }),
      hasEmptyState: screen.getByText("This schema has no tables yet")
        .isConnected,
    }).toEqual({
      tableCountBeforeSwitch: 1,
      lang: "en",
      cookie: true,
      hasEnglishSchemaName: true,
      tableNodes: [],
      hasEmptyState: true,
    });
  });
});
