import type { SchemaDocument } from "@schemaforge/core";
import { screen, within } from "@testing-library/react";

import type { JourneyEnvironment } from "./mount-editor-journey";

const SCHEMA_PATH_PATTERN = /^\/schemas\/(.+)$/;
const EDGE_NAME_PATTERN = /→/;

/** Reads the stored document back through the real repository. */
export async function readDocument(
  environment: JourneyEnvironment,
  schemaId: string,
): Promise<SchemaDocument> {
  const opened = await environment.storage.repository.openSchema(schemaId);
  if (opened.kind !== "opened") {
    throw new Error(`The schema could not be opened: ${opened.kind}.`);
  }
  return opened.document;
}

/**
 * The editor's left panel. Hidden elements count too, so rows stay reachable
 * while a modal dialog hides the rest of the page.
 */
export function getOutline(): HTMLElement {
  return screen.getByRole("complementary", {
    name: "Schema outline",
    hidden: true,
  });
}

// A row's name also holds its column count, so it is matched by prefix.
export function queryOutlineRow(tableName: string): HTMLElement | null {
  return within(getOutline()).queryByRole("button", {
    name: new RegExp(`^${tableName} `),
    hidden: true,
  });
}

export function getOutlineRow(tableName: string): HTMLElement {
  const row = queryOutlineRow(tableName);
  if (row === null) {
    throw new Error(`The outline has no row for ${tableName}.`);
  }
  return row;
}

/** The accessible names of the canvas edges, which read "from → to". */
export function queryEdgeNames(): readonly string[] {
  return screen
    .queryAllByRole("group", { name: EDGE_NAME_PATTERN })
    .map((edge) => edge.getAttribute("aria-label") ?? "");
}

/** The schema id in an editor path the list navigated to. */
export function getSchemaIdFromHref(href: string | undefined): string {
  const schemaId = SCHEMA_PATH_PATTERN.exec(href ?? "")?.[1];
  if (schemaId === undefined) {
    throw new Error(`The list did not navigate to an editor: "${href ?? ""}".`);
  }
  return schemaId;
}
