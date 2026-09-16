"use client";

import type {
  Column,
  ColumnId,
  ColumnPair,
  DocumentPath,
  Issue,
  RelationId,
} from "@schemaforge/core";
import { XIcon } from "lucide-react";
import type { JSX } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { selectableColumns } from "./relation-column-pairs";
import {
  columnPairPath,
  joinIds,
  pairIndexOfIssue,
  relationFieldPath,
} from "./relation-issue-fields";
import { RelationIssueMessages } from "./relation-issue-messages";

type PairColumnSelectProps = {
  readonly label: string;
  readonly value: ColumnId;
  readonly columns: readonly Column[];
  readonly onChange: (columnId: ColumnId) => void;
  // The ids of the issues describing this select; set means it is invalid.
  readonly describedBy: string | undefined;
  readonly focusPath: DocumentPath | undefined;
  readonly onTrigger?: (element: HTMLButtonElement | null) => void;
};

function PairColumnSelect({
  label,
  value,
  columns,
  onChange,
  describedBy,
  focusPath,
  onTrigger,
}: PairColumnSelectProps): JSX.Element {
  const triggerId = useId();

  return (
    <div className="grid min-w-0">
      {/* A visible header names the column above the list; this label adds
          the pair number so the two selects of every pair are distinct. */}
      <Label htmlFor={triggerId} className="sr-only">
        {label}
      </Label>
      <Select
        value={value}
        onValueChange={(next) => {
          const column = columns.find((candidate) => candidate.id === next);
          if (column !== undefined) {
            onChange(column.id);
          }
        }}
      >
        <SelectTrigger
          id={triggerId}
          ref={onTrigger}
          className="w-full"
          data-focus-path={
            focusPath === undefined ? undefined : JSON.stringify(focusPath)
          }
          aria-invalid={describedBy === undefined ? undefined : true}
          aria-describedby={describedBy}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {columns.map((column) => (
            <SelectItem key={column.id} value={column.id}>
              {column.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

type RemovePairButtonProps = {
  readonly label: string;
  // Set only on the last pair, which cannot be removed; it explains why.
  readonly lastPairHintId: string | undefined;
  readonly onRemove: () => void;
};

function RemovePairButton({
  label,
  lastPairHintId,
  onRemove,
}: RemovePairButtonProps): JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          aria-describedby={lastPairHintId}
          disabled={lastPairHintId !== undefined}
          onClick={onRemove}
        >
          <XIcon aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export type RelationColumnPairRowProps = {
  readonly relationId: RelationId;
  readonly pair: ColumnPair;
  readonly pairIndex: number;
  readonly columnPairs: readonly ColumnPair[];
  readonly fromColumns: readonly Column[];
  readonly toColumns: readonly Column[];
  // Issues of the `columnPairs` field; the row shows those of its own pair.
  readonly issues: readonly Issue[];
  // Set when an issue concerns the whole list (a target that is not unique).
  readonly listIssuesId: string | undefined;
  readonly lastPairHintId: string | undefined;
  readonly registerFromTrigger: (
    pairIndex: number,
    element: HTMLButtonElement | null,
  ) => void;
  readonly onChange: (pairIndex: number, pair: ColumnPair) => void;
  readonly onRemove: (pairIndex: number) => void;
};

/**
 * One column pair: the column on each side and an icon button removing it.
 * Issues of the pair describe both selects. Issues of the whole list are
 * about the target columns, so they describe every "to" select, and the one
 * of the first pair is where a focus request for the list lands.
 */
export function RelationColumnPairRow({
  relationId,
  pair,
  pairIndex,
  columnPairs,
  fromColumns,
  toColumns,
  issues,
  listIssuesId,
  lastPairHintId,
  registerFromTrigger,
  onChange,
  onRemove,
}: RelationColumnPairRowProps): JSX.Element {
  const { t } = useTranslation("editor");
  const issuesId = useId();
  const pairIssues = issues.filter(
    (issue) => pairIndexOfIssue(issue) === pairIndex,
  );
  const pairIssuesId = pairIssues.length > 0 ? issuesId : undefined;
  const values = { number: pairIndex + 1 };

  return (
    <li className="grid gap-1">
      <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
        <PairColumnSelect
          label={t("relationPanel.columnPairs.fromLabel", values)}
          value={pair.fromColumnId}
          columns={selectableColumns(
            fromColumns,
            columnPairs,
            "fromColumnId",
            pairIndex,
          )}
          onChange={(fromColumnId) => {
            onChange(pairIndex, { ...pair, fromColumnId });
          }}
          describedBy={pairIssuesId}
          focusPath={columnPairPath(relationId, pairIndex)}
          onTrigger={(element) => {
            registerFromTrigger(pairIndex, element);
          }}
        />
        <PairColumnSelect
          label={t("relationPanel.columnPairs.toLabel", values)}
          value={pair.toColumnId}
          columns={selectableColumns(
            toColumns,
            columnPairs,
            "toColumnId",
            pairIndex,
          )}
          onChange={(toColumnId) => {
            onChange(pairIndex, { ...pair, toColumnId });
          }}
          describedBy={joinIds([pairIssuesId, listIssuesId])}
          focusPath={
            pairIndex === 0
              ? relationFieldPath(relationId, "columnPairs")
              : undefined
          }
        />
        <RemovePairButton
          label={t("relationPanel.columnPairs.remove", values)}
          lastPairHintId={lastPairHintId}
          onRemove={() => {
            onRemove(pairIndex);
          }}
        />
      </div>
      {pairIssuesId !== undefined && (
        <RelationIssueMessages id={pairIssuesId} issues={pairIssues} />
      )}
    </li>
  );
}
