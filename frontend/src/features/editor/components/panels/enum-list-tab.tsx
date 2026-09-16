"use client";

import type { Enum, EnumId, Issue } from "@schemaforge/core";
import { sortEnums } from "@schemaforge/core";
import type { JSX } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { ScrollArea } from "@/components/ui/scroll-area";

import { getEnumUsage } from "../../lib/enum-usage";
import { getIssueIndex } from "../../lib/issue-index";
import { resolveIssueTarget } from "../../lib/resolve-issue-target";
import { useEditorStore } from "../../state/use-editor-store";
import { EnumItem } from "./enum-item";
import { usePendingFocus } from "./enum-pending-focus";
import { toIssueMessageValues } from "./issue-message-values";

// One shared empty list, so an unused enum always receives the same array.
const NO_USAGES: readonly string[] = [];

// The name field of the enum after the removed one, else the one before it,
// else the empty message, so focus never falls back to the page body.
function focusIdAfterRemoval(
  enums: readonly Enum[],
  position: number,
  enumIdPrefix: (enumId: EnumId) => string,
  emptyMessageId: string,
): string {
  const neighbor = enums[position + 1] ?? enums[position - 1];
  return neighbor === undefined
    ? emptyMessageId
    : `${enumIdPrefix(neighbor.id)}-name`;
}

/** Every enum of the schema with its name, values and delete button. */
export function EnumListTab(): JSX.Element {
  const { t } = useTranslation(["editor", "issues"]);
  const schema = useEditorStore((state) => state.document);
  const dispatch = useEditorStore((state) => state.dispatch);
  const focusLater = usePendingFocus();
  const baseId = useId();
  const emptyMessageId = `${baseId}-empty`;
  const enums = sortEnums(schema);
  const usage = getEnumUsage(schema);
  const issueIndex = getIssueIndex(schema);
  const enumIdPrefix = (enumId: EnumId): string => `${baseId}-${enumId}`;

  function translateIssues(issues: readonly Issue[]): string | undefined {
    if (issues.length === 0) {
      return undefined;
    }
    return issues
      .map((issue) =>
        t(
          `issues:${issue.code}`,
          toIssueMessageValues(resolveIssueTarget(schema, issue.path).values),
        ),
      )
      .join(" ");
  }

  function removeEnum(position: number, enumId: EnumId): void {
    if (dispatch({ type: "removeEnum", enumId }).isOk) {
      focusLater(
        focusIdAfterRemoval(enums, position, enumIdPrefix, emptyMessageId),
      );
    }
  }

  return (
    <ScrollArea className="h-full">
      {enums.length === 0 ? (
        // Focusable from script only, to receive focus after the last enum
        // is deleted.
        <p
          id={emptyMessageId}
          tabIndex={-1}
          className="p-3 text-sm text-muted-foreground outline-none"
        >
          {t("editor:leftPanel.enums.empty")}
        </p>
      ) : (
        <ul className="grid gap-2 p-2">
          {enums.map((enumDefinition, position) => (
            <li key={enumDefinition.id}>
              <EnumItem
                enumDefinition={enumDefinition}
                idPrefix={enumIdPrefix(enumDefinition.id)}
                usages={usage.get(enumDefinition.id) ?? NO_USAGES}
                issues={issueIndex.issuesOfElement(enumDefinition.id)}
                translateIssues={translateIssues}
                onRemove={() => {
                  removeEnum(position, enumDefinition.id);
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </ScrollArea>
  );
}
