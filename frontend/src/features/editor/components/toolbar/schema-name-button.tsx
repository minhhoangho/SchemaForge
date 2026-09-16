"use client";

import type { Issue } from "@schemaforge/core";
import { TriangleAlertIcon } from "lucide-react";
import type { JSX } from "react";
import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { getIssueIndex } from "../../lib/issue-index";
import { useEditorStore } from "../../state/use-editor-store";
import { CommittedTextField } from "../committed-text-field";

// Issues of the schema name are reported at this path (core `names` rule).
const SCHEMA_NAME_SEGMENT = "name";

function isSchemaNameIssue(issue: Issue): boolean {
  return issue.path.length === 1 && issue.path[0] === SCHEMA_NAME_SEGMENT;
}

type IssueMessagesProps = {
  readonly id?: string;
  readonly issues: readonly Issue[];
  readonly isHidden?: boolean;
};

function IssueMessages({
  id,
  issues,
  isHidden = false,
}: IssueMessagesProps): JSX.Element {
  const { t } = useTranslation("issues");
  return (
    <ul id={id} hidden={isHidden}>
      {issues.map((issue) => (
        <li key={issue.code}>{t(issue.code)}</li>
      ))}
    </ul>
  );
}

type RenameFormProps = {
  readonly name: string;
  readonly onDone: () => void;
};

// `DialogContent` mounts this only while the dialog is open, so every opening
// starts from the current name.
function RenameForm({ name, onDone }: RenameFormProps): JSX.Element {
  const { t } = useTranslation(["editor", "common"]);
  const dispatch = useEditorStore((state) => state.dispatch);
  const fieldId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  // The field reports a value only on blur or Enter, so submit reads the
  // input itself to include a draft the field has not committed yet.
  const [pendingName, setPendingName] = useState(name);

  function submit(): void {
    const nextName = inputRef.current?.value ?? pendingName;
    if (nextName !== name) {
      dispatch({ type: "renameSchema", name: nextName });
    }
    onDone();
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <DialogHeader>
        <DialogTitle>{t("toolbar.schemaName.dialogTitle")}</DialogTitle>
      </DialogHeader>
      <CommittedTextField
        id={fieldId}
        label={t("toolbar.schemaName.label")}
        value={pendingName}
        onCommit={setPendingName}
        inputRef={inputRef}
      />
      <DialogFooter hasCloseButton closeLabel={t("common:actions.cancel")}>
        <Button type="submit">{t("toolbar.schemaName.submit")}</Button>
      </DialogFooter>
    </form>
  );
}

/**
 * Shows the schema name and opens the rename dialog; as the dialog trigger,
 * the button gets focus back when the dialog closes. Issues of the name show
 * as an icon and a tooltip, and are the button's description for screen
 * readers, since `aria-invalid` is not allowed on a button. The tooltip
 * wrapper is always rendered, so the button element (and its focus) survives
 * issues coming and going.
 */
export function SchemaNameButton(): JSX.Element {
  const { t } = useTranslation(["editor", "common"]);
  const schema = useEditorStore((state) => state.document);
  const [isOpen, setIsOpen] = useState(false);
  const issuesId = useId();
  const nameIssues =
    getIssueIndex(schema).schemaIssues.filter(isSchemaNameIssue);
  const hasIssues = nameIssues.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              aria-describedby={hasIssues ? issuesId : undefined}
            >
              {hasIssues && (
                <TriangleAlertIcon aria-hidden className="text-destructive" />
              )}
              {/* The space keeps the visible name a separate word in the
                  accessible name, so voice control can match it (WCAG 2.5.3). */}
              <span className="sr-only">{t("toolbar.schemaName.label")}</span>{" "}
              {schema.name}
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        {hasIssues && (
          <TooltipContent>
            <IssueMessages issues={nameIssues} />
          </TooltipContent>
        )}
      </Tooltip>
      {hasIssues && (
        <IssueMessages id={issuesId} issues={nameIssues} isHidden />
      )}
      <DialogContent
        closeLabel={t("common:actions.close")}
        aria-describedby={undefined}
      >
        <RenameForm
          name={schema.name}
          onDone={() => {
            setIsOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
