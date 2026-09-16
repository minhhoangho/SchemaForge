"use client";

import type {
  Issue,
  ReferentialAction,
  Relation,
  RelationId,
  RelationKind,
} from "@schemaforge/core";
import { Trash2Icon } from "lucide-react";
import type { JSX } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { getIssueIndex } from "../../lib/issue-index";
import { EMPTY_SELECTION } from "../../lib/selection";
import { useEditorStore } from "../../state/use-editor-store";
import { ColumnPairList } from "./column-pair-list";
import { issuesOfField, relationFieldPath } from "./relation-issue-fields";
import { RelationIssueMessages } from "./relation-issue-messages";
import { RelationSelectField } from "./relation-select-field";

// Many-to-many is not a kind: it is built from a junction table (spec section 2).
const RELATION_KINDS = [
  "oneToMany",
  "oneToOne",
] as const satisfies readonly RelationKind[];

const REFERENTIAL_ACTIONS = [
  "noAction",
  "restrict",
  "cascade",
  "setNull",
  "setDefault",
] as const satisfies readonly ReferentialAction[];

type RelationChanges = Partial<
  Pick<Relation, "kind" | "columnPairs" | "onDelete" | "onUpdate">
>;

type TableSide = "fromTableId" | "toTableId";

function useRelationTableName(relationId: RelationId, side: TableSide): string {
  return useEditorStore((state) => {
    const relation = state.document.relations[relationId];
    return relation === undefined
      ? ""
      : (state.document.tables[relation[side]]?.name ?? "");
  });
}

type RelationTablesProps = { readonly relationId: RelationId };

// Tables are shown, not edited: connecting other tables means removing the
// relation and creating a new one (spec section 2).
function RelationTables({ relationId }: RelationTablesProps): JSX.Element {
  const { t } = useTranslation("editor");
  const fromTableName = useRelationTableName(relationId, "fromTableId");
  const toTableName = useRelationTableName(relationId, "toTableId");

  return (
    <div className="grid gap-1 text-sm">
      <p>
        <span className="text-muted-foreground">
          {t("relationPanel.fromTable")}
        </span>{" "}
        <span className="font-medium">{fromTableName}</span>
      </p>
      <p>
        <span className="text-muted-foreground">
          {t("relationPanel.toTable")}
        </span>{" "}
        <span className="font-medium">{toTableName}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        {t("relationPanel.changeTablesHint")}
      </p>
    </div>
  );
}

type RelationFieldsProps = {
  readonly relation: Relation;
  readonly issues: readonly Issue[];
  readonly onChange: (changes: RelationChanges) => void;
};

function RelationFields({
  relation,
  issues,
  onChange,
}: RelationFieldsProps): JSX.Element {
  const { t } = useTranslation("editor");

  return (
    <>
      <RelationSelectField
        label={t("relationPanel.kindLabel")}
        value={relation.kind}
        options={RELATION_KINDS}
        optionLabel={(kind) => t(`relationPanel.kind.${kind}`)}
        onChange={(kind) => {
          onChange({ kind });
        }}
        issues={issuesOfField(issues, "kind")}
        focusPath={relationFieldPath(relation.id, "kind")}
        hint={t("relationPanel.kindHint")}
      />
      <RelationTables relationId={relation.id} />
      <ColumnPairList
        relation={relation}
        issues={issuesOfField(issues, "columnPairs")}
        onChange={(columnPairs) => {
          onChange({ columnPairs });
        }}
      />
      <RelationSelectField
        label={t("relationPanel.onDelete")}
        value={relation.onDelete}
        options={REFERENTIAL_ACTIONS}
        optionLabel={(action) => t(`relationPanel.actions.${action}`)}
        onChange={(onDelete) => {
          onChange({ onDelete });
        }}
        issues={issuesOfField(issues, "onDelete")}
        focusPath={relationFieldPath(relation.id, "onDelete")}
      />
      <RelationSelectField
        label={t("relationPanel.onUpdate")}
        value={relation.onUpdate}
        options={REFERENTIAL_ACTIONS}
        optionLabel={(action) => t(`relationPanel.actions.${action}`)}
        onChange={(onUpdate) => {
          onChange({ onUpdate });
        }}
        issues={issuesOfField(issues, "onUpdate")}
        focusPath={relationFieldPath(relation.id, "onUpdate")}
      />
    </>
  );
}

type RelationPanelProps = {
  readonly relationId: RelationId;
  // Called after the relation is removed and the selection cleared. The panel
  // unmounts with the selection, so the caller moves focus (to the canvas,
  // spec section 12) instead of leaving it on the removed button.
  readonly onDeleted: () => void;
};

/** Properties of one relation: kind, tables, column pairs, referential actions. */
export function RelationPanel({
  relationId,
  onDeleted,
}: RelationPanelProps): JSX.Element | null {
  const { t } = useTranslation("editor");
  const headingId = useId();
  const otherIssuesId = `${headingId}-issues`;
  const relation = useEditorStore(
    (state) => state.document.relations[relationId],
  );
  const issues = useEditorStore((state) =>
    getIssueIndex(state.document).issuesOfElement(relationId),
  );
  const dispatch = useEditorStore((state) => state.dispatch);
  const setSelection = useEditorStore((state) => state.setSelection);

  // Between removing the relation and the caller dropping the panel, the
  // store no longer holds it.
  if (relation === undefined) {
    return null;
  }

  function remove(): void {
    // A rejected dispatch already reported its error; the relation stays, so
    // the panel and the selection stay too.
    if (!dispatch({ type: "removeRelation", relationId }).isOk) {
      return;
    }
    setSelection(EMPTY_SELECTION);
    onDeleted();
  }

  const otherIssues = issuesOfField(issues, null);
  const hasOtherIssues = otherIssues.length > 0;

  return (
    <section
      aria-labelledby={headingId}
      aria-describedby={hasOtherIssues ? otherIssuesId : undefined}
      className="grid gap-4 p-4"
    >
      <h2 id={headingId} className="text-base font-semibold">
        {t("relationPanel.label")}
      </h2>
      {hasOtherIssues && (
        <RelationIssueMessages id={otherIssuesId} issues={otherIssues} />
      )}
      <RelationFields
        relation={relation}
        issues={issues}
        onChange={(changes) => {
          dispatch({ type: "updateRelation", relationId, changes });
        }}
      />
      <Button
        variant="destructive"
        className="justify-self-start"
        onClick={remove}
      >
        <Trash2Icon aria-hidden />
        {t("relationPanel.remove")}
      </Button>
    </section>
  );
}
