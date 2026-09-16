"use client";

import type { Index } from "@schemaforge/core";
import { Trash2Icon } from "lucide-react";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { useEditorStore } from "../../../state/use-editor-store";
import { CommittedTextField } from "../../committed-text-field";
import { IconActionButton } from "./icon-action-button";
import { IndexColumnList } from "./index-column-list";
import { LabeledCheckbox } from "./labeled-checkbox";
import { useDisplayName } from "./use-display-name";
import { controlId } from "./list-move-focus";

const INDEXES_SEGMENT = "indexes";
const NAME_FIELD = "name";
const UNIQUE_FIELD = "isUnique";

type IndexItemProps = {
  readonly index: Index;
  readonly baseId: string;
  readonly errorMessage: string | undefined;
  readonly requestFocus: (elementId: string) => void;
  readonly onRemove: () => void;
};

/**
 * One index: name, unique flag, its ordered columns, and a remove button. The
 * index is a group named after it, so its repeated labels keep their context.
 */
export function IndexItem({
  index,
  baseId,
  errorMessage,
  requestFocus,
  onRemove,
}: IndexItemProps): JSX.Element {
  const { t } = useTranslation("editor");
  const displayName = useDisplayName();
  const dispatch = useEditorStore((state) => state.dispatch);
  const indexId = index.id;

  return (
    <li>
      <fieldset className="grid gap-2 rounded-md border border-border p-2">
        <legend className="sr-only">{displayName(index.name)}</legend>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <CommittedTextField
              id={controlId(baseId, indexId, "name")}
              label={t("tablePanel.indexes.nameLabel")}
              isLabelHidden
              value={index.name}
              focusPath={[INDEXES_SEGMENT, indexId, NAME_FIELD]}
              errorMessage={errorMessage}
              onCommit={(name) => {
                dispatch({ type: "updateIndex", indexId, changes: { name } });
              }}
            />
          </div>
          <IconActionButton
            id={controlId(baseId, indexId, "remove")}
            label={t("tablePanel.indexes.remove", {
              index: displayName(index.name),
            })}
            icon={<Trash2Icon aria-hidden />}
            onClick={onRemove}
          />
        </div>
        <LabeledCheckbox
          id={controlId(baseId, indexId, "unique")}
          label={t("tablePanel.indexes.unique")}
          isChecked={index.isUnique}
          focusPath={[INDEXES_SEGMENT, indexId, UNIQUE_FIELD]}
          onCheckedChange={(isUnique) => {
            dispatch({ type: "updateIndex", indexId, changes: { isUnique } });
          }}
        />
        <IndexColumnList
          index={index}
          baseId={baseId}
          requestFocus={requestFocus}
        />
      </fieldset>
    </li>
  );
}
