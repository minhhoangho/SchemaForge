"use client";

import type { ColumnPair, Issue, Relation } from "@schemaforge/core";
import { PlusIcon } from "lucide-react";
import type { JSX } from "react";
import { useId, useRef } from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { useEditorStore } from "../../state/use-editor-store";
import { RelationColumnPairRow } from "./relation-column-pair-row";
import type { RelationColumnPairRowProps } from "./relation-column-pair-row";
import { buildNextColumnPair, columnsOfTable } from "./relation-column-pairs";
import { pairIndexOfIssue } from "./relation-issue-fields";
import { RelationIssueMessages } from "./relation-issue-messages";

type ColumnPairEditing = {
  readonly registerFromTrigger: RelationColumnPairRowProps["registerFromTrigger"];
  readonly changePair: RelationColumnPairRowProps["onChange"];
  readonly removePair: RelationColumnPairRowProps["onRemove"];
  readonly addPair: () => void;
};

/**
 * Every change hands the whole new array to `onChange`, so one edit is one
 * `updateRelation`. After adding or removing a pair, focus moves to the first
 * select of the new or neighbouring pair instead of falling to the body.
 */
function useColumnPairEditing(
  columnPairs: readonly ColumnPair[],
  nextPair: ColumnPair | null,
  onChange: (columnPairs: readonly ColumnPair[]) => void,
): ColumnPairEditing {
  // The first select of every row, by position.
  const fromTriggers = useRef<(HTMLButtonElement | null)[]>([]);

  // flushSync commits the new rows before focusing, so the target exists.
  function changeAndFocus(next: readonly ColumnPair[], index: number): void {
    flushSync(() => {
      onChange(next);
    });
    fromTriggers.current[index]?.focus();
  }

  return {
    registerFromTrigger: (pairIndex, element) => {
      fromTriggers.current[pairIndex] = element;
    },
    changePair: (pairIndex, pair) => {
      onChange(
        columnPairs.map((current, index) =>
          index === pairIndex ? pair : current,
        ),
      );
    },
    removePair: (pairIndex) => {
      const next = columnPairs.filter((_, index) => index !== pairIndex);
      changeAndFocus(next, Math.min(pairIndex, next.length - 1));
    },
    addPair: () => {
      if (nextPair !== null) {
        changeAndFocus([...columnPairs, nextPair], columnPairs.length);
      }
    },
  };
}

function ColumnPairHeaders(): JSX.Element {
  const { t } = useTranslation("editor");

  return (
    <div
      aria-hidden
      className="grid grid-cols-[1fr_1fr_2rem] gap-2 text-xs text-muted-foreground"
    >
      <span>{t("relationPanel.columnPairs.fromHeader")}</span>
      <span>{t("relationPanel.columnPairs.toHeader")}</span>
    </div>
  );
}

type ColumnPairListProps = {
  readonly relation: Relation;
  // Issues of the `columnPairs` field, with or without a pair index.
  readonly issues: readonly Issue[];
  readonly onChange: (columnPairs: readonly ColumnPair[]) => void;
};

/** Edits the column pairs of a relation, which always keeps at least one. */
export function ColumnPairList({
  relation,
  issues,
  onChange,
}: ColumnPairListProps): JSX.Element {
  const { t } = useTranslation("editor");
  const schema = useEditorStore((state) => state.document);
  const lastPairHintId = useId();
  const listIssuesId = useId();
  const { columnPairs } = relation;
  const fromColumns = columnsOfTable(schema, relation.fromTableId);
  const toColumns = columnsOfTable(schema, relation.toTableId);
  const nextPair = buildNextColumnPair(fromColumns, toColumns, columnPairs);
  const { registerFromTrigger, changePair, removePair, addPair } =
    useColumnPairEditing(columnPairs, nextPair, onChange);
  const isLastPair = columnPairs.length === 1;
  const listIssues = issues.filter((issue) => pairIndexOfIssue(issue) === null);
  const hasListIssues = listIssues.length > 0;

  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-medium">
        {t("relationPanel.columnPairs.title")}
      </legend>
      <ColumnPairHeaders />
      <ul className="grid gap-2">
        {columnPairs.map((pair, index) => (
          // Pairs have no id and both columns change on edit, so the position
          // keeps a row (and its focus) mounted while its selects change.
          <RelationColumnPairRow
            key={index}
            relationId={relation.id}
            pair={pair}
            pairIndex={index}
            columnPairs={columnPairs}
            fromColumns={fromColumns}
            toColumns={toColumns}
            issues={issues}
            listIssuesId={hasListIssues ? listIssuesId : undefined}
            lastPairHintId={isLastPair ? lastPairHintId : undefined}
            registerFromTrigger={registerFromTrigger}
            onChange={changePair}
            onRemove={removePair}
          />
        ))}
      </ul>
      {isLastPair && (
        <p id={lastPairHintId} className="text-xs text-muted-foreground">
          {t("relationPanel.columnPairs.lastPair")}
        </p>
      )}
      {hasListIssues && (
        <RelationIssueMessages id={listIssuesId} issues={listIssues} />
      )}
      <Button
        variant="outline"
        size="sm"
        className="justify-self-start"
        disabled={nextPair === null}
        onClick={addPair}
      >
        <PlusIcon aria-hidden />
        {t("relationPanel.columnPairs.add")}
      </Button>
    </fieldset>
  );
}
