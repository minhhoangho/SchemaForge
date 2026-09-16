"use client";

import type { EnumId, Issue } from "@schemaforge/core";
import { PlusIcon } from "lucide-react";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { suggestEnumValue } from "../../lib/name-suggestions";
import { useEditorStore } from "../../state/use-editor-store";
import { usePendingFocus } from "./enum-pending-focus";
import { EnumValueRow } from "./enum-value-row";
import type { EnumValueRowIds } from "./enum-value-row";

type ValueAction = "up" | "down" | "remove";

const ENUMS_SEGMENT = "enums";
const VALUES_SEGMENT = "values";

function moveValue(
  values: readonly string[],
  from: number,
  to: number,
): readonly string[] {
  const moved = values[from];
  if (moved === undefined) {
    return values;
  }
  return values.toSpliced(from, 1).toSpliced(to, 0, moved);
}

// After a move the value keeps focus on the same button, unless the value
// reached an end where that button is disabled.
function focusActionAfterMove(
  index: number,
  lastIndex: number,
  action: "up" | "down",
): ValueAction {
  if (action === "up") {
    return index === 0 ? "down" : "up";
  }
  return index === lastIndex ? "up" : "down";
}

function valueFieldId(idPrefix: string, index: number): string {
  return `${idPrefix}-value-${String(index)}`;
}

function valueActionId(
  idPrefix: string,
  index: number,
  action: ValueAction,
): string {
  return `${valueFieldId(idPrefix, index)}-${action}`;
}

function valueRowIds(idPrefix: string, index: number): EnumValueRowIds {
  return {
    field: valueFieldId(idPrefix, index),
    up: valueActionId(idPrefix, index, "up"),
    down: valueActionId(idPrefix, index, "down"),
    remove: valueActionId(idPrefix, index, "remove"),
  };
}

function issuesOfValue(
  issues: readonly Issue[],
  index: number,
): readonly Issue[] {
  return issues.filter(
    (issue) => issue.path[2] === VALUES_SEGMENT && issue.path[3] === index,
  );
}

export type EnumValueListProps = {
  readonly enumId: EnumId;
  readonly idPrefix: string;
  readonly values: readonly string[];
  readonly issues: readonly Issue[];
  readonly emptyIssueId: string | undefined;
  readonly translateIssues: (issues: readonly Issue[]) => string | undefined;
};

/**
 * The values of one enum. Every change dispatches `updateEnum` with the whole
 * new list of values (spec section 2), so one change is one undo step.
 */
export function EnumValueList({
  enumId,
  idPrefix,
  values,
  issues,
  emptyIssueId,
  translateIssues,
}: EnumValueListProps): JSX.Element {
  const { t } = useTranslation("editor");
  const dispatch = useEditorStore((state) => state.dispatch);
  const focusLater = usePendingFocus();
  const lastIndex = values.length - 1;

  // `focusId` is null when focus already sits where it belongs, such as
  // after a field commits on blur and the user has tabbed on.
  function update(nextValues: readonly string[], focusId: string | null): void {
    const result = dispatch({
      type: "updateEnum",
      enumId,
      changes: { values: nextValues },
    });
    if (result.isOk && focusId !== null) {
      focusLater(focusId);
    }
  }

  function move(index: number, action: "up" | "down"): void {
    const target = action === "up" ? index - 1 : index + 1;
    const focusAction = focusActionAfterMove(target, lastIndex, action);
    update(
      moveValue(values, index, target),
      valueActionId(idPrefix, target, focusAction),
    );
  }

  function remove(index: number): void {
    const remaining = values.toSpliced(index, 1);
    const focusId =
      remaining.length === 0
        ? `${idPrefix}-add-value`
        : valueActionId(idPrefix, Math.min(index, lastIndex - 1), "remove");
    update(remaining, focusId);
  }

  return (
    <div className="grid gap-1.5">
      <ul className="grid gap-1">
        {values.map((value, index) => (
          // Values are plain strings that may repeat, so the position is the
          // only key; each field shows the value it is given again.
          <EnumValueRow
            key={index}
            ids={valueRowIds(idPrefix, index)}
            position={index + 1}
            value={value}
            focusPath={[ENUMS_SEGMENT, enumId, VALUES_SEGMENT, index]}
            isFirst={index === 0}
            isLast={index === lastIndex}
            errorMessage={translateIssues(issuesOfValue(issues, index))}
            onCommit={(nextValue) => {
              update(values.with(index, nextValue), null);
            }}
            onMoveUp={() => {
              move(index, "up");
            }}
            onMoveDown={() => {
              move(index, "down");
            }}
            onRemove={() => {
              remove(index);
            }}
          />
        ))}
      </ul>
      <Button
        id={`${idPrefix}-add-value`}
        type="button"
        variant="outline"
        size="sm"
        className="justify-self-start"
        // The target of a focus request for `enum-values-empty`.
        data-focus-path={JSON.stringify([
          ENUMS_SEGMENT,
          enumId,
          VALUES_SEGMENT,
        ])}
        aria-describedby={emptyIssueId}
        onClick={() => {
          update(
            [...values, suggestEnumValue(values)],
            valueFieldId(idPrefix, values.length),
          );
        }}
      >
        <PlusIcon aria-hidden />
        {t("leftPanel.enums.addValue")}
      </Button>
    </div>
  );
}
