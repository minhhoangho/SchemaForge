"use client";

import type { Enum, Issue } from "@schemaforge/core";
import { Trash2Icon } from "lucide-react";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { useEditorStore } from "../../state/use-editor-store";
import { CommittedTextField } from "../committed-text-field";
import { EnumValueList } from "./enum-value-list";

const ENUMS_SEGMENT = "enums";
const NAME_SEGMENT = "name";
const VALUES_SEGMENT = "values";
// `enum-values-empty` points at the list itself: ["enums", id, "values"].
const VALUE_LIST_PATH_LENGTH = 3;

function isNameIssue(issue: Issue): boolean {
  return issue.path[2] === NAME_SEGMENT;
}

function isValueListIssue(issue: Issue): boolean {
  return (
    issue.path.length === VALUE_LIST_PATH_LENGTH &&
    issue.path[2] === VALUES_SEGMENT
  );
}

type EnumUsageNoteProps = {
  readonly id: string;
  readonly usages: readonly string[];
};

function EnumUsageNote({ id, usages }: EnumUsageNoteProps): JSX.Element {
  const { t } = useTranslation("editor");

  return (
    <div id={id} className="text-xs text-muted-foreground">
      <p>{t("leftPanel.enums.inUse")}</p>
      <ul className="list-inside list-disc">
        {usages.map((usage) => (
          <li key={usage}>{usage}</li>
        ))}
      </ul>
    </div>
  );
}

export type EnumItemProps = {
  readonly enumDefinition: Enum;
  readonly idPrefix: string;
  readonly usages: readonly string[];
  readonly issues: readonly Issue[];
  readonly translateIssues: (issues: readonly Issue[]) => string | undefined;
  readonly onRemove: () => void;
};

/** One enum of the enum tab: its name, its values and the delete button. */
export function EnumItem({
  enumDefinition,
  idPrefix,
  usages,
  issues,
  translateIssues,
  onRemove,
}: EnumItemProps): JSX.Element {
  const { t } = useTranslation("editor");
  const dispatch = useEditorStore((state) => state.dispatch);
  const isInUse = usages.length > 0;
  const usageId = `${idPrefix}-usage`;
  const valueListIssueId = `${idPrefix}-values-issue`;
  const valueListIssueMessage = translateIssues(
    issues.filter(isValueListIssue),
  );

  return (
    <fieldset className="grid gap-2 rounded-md border border-border p-2">
      {/* An enum being renamed can have an empty name for a moment; the
          group still needs a name. */}
      <legend className="sr-only">
        {enumDefinition.name === ""
          ? t("leftPanel.enums.nameLabel")
          : enumDefinition.name}
      </legend>
      <CommittedTextField
        id={`${idPrefix}-name`}
        label={t("leftPanel.enums.nameLabel")}
        value={enumDefinition.name}
        focusPath={[ENUMS_SEGMENT, enumDefinition.id, NAME_SEGMENT]}
        errorMessage={translateIssues(issues.filter(isNameIssue))}
        onCommit={(name) => {
          dispatch({
            type: "updateEnum",
            enumId: enumDefinition.id,
            changes: { name },
          });
        }}
      />
      <EnumValueList
        enumId={enumDefinition.id}
        idPrefix={idPrefix}
        values={enumDefinition.values}
        issues={issues}
        emptyIssueId={
          valueListIssueMessage === undefined ? undefined : valueListIssueId
        }
        translateIssues={translateIssues}
      />
      {valueListIssueMessage !== undefined && (
        <p id={valueListIssueId} className="text-xs text-destructive">
          {valueListIssueMessage}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="justify-self-start"
        disabled={isInUse}
        aria-describedby={isInUse ? usageId : undefined}
        onClick={onRemove}
      >
        <Trash2Icon aria-hidden />
        {t("leftPanel.enums.remove")}
      </Button>
      {isInUse && <EnumUsageNote id={usageId} usages={usages} />}
    </fieldset>
  );
}
