import { act, screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { StrictMode, useEffect, useState } from "react";
import type { JSX } from "react";
import type { Mock } from "vitest";

import { EditorScreen } from "@/features/editor/components/editor-screen";

import { getSchemaIdFromHref } from "./journey-queries";
import type { JourneyEnvironment } from "./mount-editor-journey";
import { renderWithProviders } from "./render-with-providers";

const NAVIGATE_EVENT = "test-navigate";

type EditorRouteHarnessProps = { readonly initialSchemaId: string };

// AppProviders keeps the pending import across the route change; the harness
// swaps editors inside one provider tree the same way, and a new schema id
// mounts a new editor, as a new route segment does.
function EditorRouteHarness({
  initialSchemaId,
}: EditorRouteHarnessProps): JSX.Element {
  const [schemaId, setSchemaId] = useState(initialSchemaId);
  useEffect(() => {
    const onNavigate = (event: Event): void => {
      if (event instanceof CustomEvent && typeof event.detail === "string") {
        setSchemaId(getSchemaIdFromHref(event.detail));
      }
    };
    window.addEventListener(NAVIGATE_EVENT, onNavigate);
    return () => {
      window.removeEventListener(NAVIGATE_EVENT, onNavigate);
    };
  }, []);
  return (
    <EditorScreen
      key={schemaId}
      schemaId={schemaId}
      onOpeningChange={() => {
        // The loader's live region is not rendered here.
      }}
    />
  );
}

/**
 * Opens the editor of `schemaId` under `<StrictMode>` and makes the test's
 * mocked `router.push` switch to the editor of the schema it names, resolving
 * once the toolbar shows a schema name.
 */
export async function mountRoutedEditor(
  environment: JourneyEnvironment,
  schemaId: string,
  push: Mock<(href: string) => void>,
): Promise<UserEvent> {
  push.mockImplementation((href) => {
    act(() => {
      window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: href }));
    });
  });
  const { user } = renderWithProviders(
    <StrictMode>
      <EditorRouteHarness initialSchemaId={schemaId} />
    </StrictMode>,
    { locale: "en", auth: { storage: environment.storage } },
  );
  await screen.findByRole("button", { name: /^Schema name / });
  return user;
}
