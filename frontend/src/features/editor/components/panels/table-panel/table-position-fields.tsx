"use client";

import type { Position, TableId } from "@schemaforge/core";
import type { JSX } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { useEditorStore } from "../../../state/use-editor-store";
import { CommittedTextField } from "../../committed-text-field";

type TablePositionFieldsProps = {
  readonly tableId: TableId;
  readonly position: Position;
};

type Axis = keyof Position;

// `Number("")` is 0, so an emptied field would otherwise move the table to
// the origin instead of restoring the shown value.
function parseCoordinate(value: string): number | null {
  if (value.trim() === "") {
    return null;
  }
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}

/**
 * The X and Y fields: the click and keyboard alternative to dragging a table
 * (spec section 2 "Vị trí", section 12). A committed value that is not a
 * finite number dispatches nothing, so the field shows the stored value again.
 */
export function TablePositionFields({
  tableId,
  position,
}: TablePositionFieldsProps): JSX.Element {
  const { t } = useTranslation("editor");
  const dispatch = useEditorStore((state) => state.dispatch);
  const baseId = useId();
  const hintId = `${baseId}-hint`;

  function commit(axis: Axis, value: string): void {
    const coordinate = parseCoordinate(value);
    if (coordinate === null) {
      return;
    }
    dispatch({
      type: "moveElements",
      moves: [
        { elementId: tableId, position: { ...position, [axis]: coordinate } },
      ],
    });
  }

  return (
    <fieldset className="grid gap-2" aria-describedby={hintId}>
      <legend className="mb-1 text-sm font-medium">
        {t("tablePanel.position.label")}
      </legend>
      <div className="grid grid-cols-2 gap-2">
        <CommittedTextField
          id={`${baseId}-x`}
          label={t("tablePanel.position.x")}
          value={String(Math.round(position.x))}
          inputMode="numeric"
          onCommit={(value) => {
            commit("x", value);
          }}
        />
        <CommittedTextField
          id={`${baseId}-y`}
          label={t("tablePanel.position.y")}
          value={String(Math.round(position.y))}
          inputMode="numeric"
          onCommit={(value) => {
            commit("y", value);
          }}
        />
      </div>
      <p id={hintId} className="text-xs text-muted-foreground">
        {t("tablePanel.position.hint")}
      </p>
    </fieldset>
  );
}
