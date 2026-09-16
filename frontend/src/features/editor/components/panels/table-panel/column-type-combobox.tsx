"use client";

import { sortEnums } from "@schemaforge/core";
import type { ColumnId, ColumnType, Enum } from "@schemaforge/core";
import { ChevronsUpDownIcon } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import {
  buildColumnType,
  COMMON_COLUMN_TYPE_KINDS,
  scoreColumnTypeSearch,
} from "../../../lib/column-type-options";
import { formatColumnType } from "../../../lib/format-column-type";
import { useEditorStore } from "../../../state/use-editor-store";
import { CustomTypeForm } from "./custom-type-form";
import { useDisplayName } from "./use-display-name";

type ColumnTypeComboboxProps = {
  readonly columnId: ColumnId;
};

type ComboboxMode = "list" | "custom";

const COLUMNS_SEGMENT = "columns";
const TYPE_SEGMENT = "type";

// cmdk filters on an item's value; this one cannot collide with a kind name.
const CUSTOM_ITEM_VALUE = "custom-type-entry";

// Every value of a column type is a string or a number, so two types are
// equal when they have the same keys with the same values.
function isSameColumnType(left: ColumnType, right: ColumnType): boolean {
  const rightValues: Readonly<Record<string, unknown>> = right;
  const leftEntries = Object.entries(left);
  return (
    leftEntries.length === Object.keys(right).length &&
    leftEntries.every(([key, value]) => rightValues[key] === value)
  );
}

function isCurrentEnum(type: ColumnType, enumeration: Enum): boolean {
  return type.kind === "enum" && type.enumId === enumeration.id;
}

// The check mark of the chosen item is only visual, so screen readers get
// the same fact as text.
function CurrentTypeMarker(): JSX.Element {
  const { t } = useTranslation("editor");
  return (
    <>
      {" "}
      <span className="sr-only">{t("tablePanel.columns.currentType")}</span>
    </>
  );
}

type TypeCommandListProps = {
  readonly type: ColumnType;
  readonly enums: readonly Enum[];
  readonly onPick: (type: ColumnType) => void;
  readonly onPickCustom: () => void;
};

function TypeCommandList({
  type,
  enums,
  onPick,
  onPickCustom,
}: TypeCommandListProps): JSX.Element {
  const { t } = useTranslation("editor");

  return (
    <Command
      label={t("tablePanel.columns.search")}
      filter={scoreColumnTypeSearch}
    >
      <CommandInput placeholder={t("tablePanel.columns.search")} />
      <CommandList>
        <CommandEmpty>{t("tablePanel.columns.noResult")}</CommandEmpty>
        <CommandGroup heading={t("tablePanel.columns.typeGroups.common")}>
          {COMMON_COLUMN_TYPE_KINDS.map((kind) => (
            <CommandItem
              key={kind}
              value={kind}
              keywords={[kind]}
              data-checked={type.kind === kind}
              onSelect={() => {
                onPick(buildColumnType(kind, type));
              }}
            >
              {kind}
              {type.kind === kind && <CurrentTypeMarker />}
            </CommandItem>
          ))}
        </CommandGroup>
        {enums.length > 0 && (
          <CommandGroup heading={t("tablePanel.columns.typeGroups.enums")}>
            {enums.map((enumeration) => (
              <CommandItem
                key={enumeration.id}
                value={enumeration.id}
                keywords={[enumeration.name]}
                data-checked={isCurrentEnum(type, enumeration)}
                onSelect={() => {
                  onPick({ kind: "enum", enumId: enumeration.id });
                }}
              >
                {enumeration.name}
                {isCurrentEnum(type, enumeration) && <CurrentTypeMarker />}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading={t("tablePanel.columns.typeGroups.custom")}>
          <CommandItem
            value={CUSTOM_ITEM_VALUE}
            keywords={[t("tablePanel.columns.customTypeEntry")]}
            data-checked={type.kind === "custom"}
            onSelect={onPickCustom}
          >
            {t("tablePanel.columns.customTypeEntry")}
            {type.kind === "custom" && <CurrentTypeMarker />}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

/**
 * Picks a column type from the seventeen common kinds, the schema's enums, or
 * a custom type name (spec section 2 "Cột"). The trigger shows the current
 * type; Radix returns focus to it whenever the popover closes.
 */
export function ColumnTypeCombobox({
  columnId,
}: ColumnTypeComboboxProps): JSX.Element | null {
  const { t } = useTranslation("editor");
  const displayName = useDisplayName();
  const schema = useEditorStore((state) => state.document);
  const dispatch = useEditorStore((state) => state.dispatch);
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<ComboboxMode>("list");

  const column = schema.columns[columnId];
  if (column === undefined) {
    return null;
  }
  const typeLabel = t("tablePanel.columns.typeLabel", {
    column: displayName(column.name),
  });
  const typeText = formatColumnType(column.type, schema.enums);
  const initialCustomName =
    column.type.kind === "custom" ? column.type.name : "";

  function applyType(type: ColumnType): void {
    if (column !== undefined && !isSameColumnType(column.type, type)) {
      dispatch({ type: "updateColumn", columnId, changes: { type } });
    }
    setIsOpen(false);
  }

  return (
    <Popover
      open={isOpen}
      onOpenChange={(isNextOpen) => {
        setIsOpen(isNextOpen);
        setMode("list");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="max-w-40 font-mono"
          data-focus-path={JSON.stringify([
            COLUMNS_SEGMENT,
            columnId,
            TYPE_SEGMENT,
          ])}
        >
          <span className="sr-only">{typeLabel}</span>{" "}
          <span className="truncate" title={typeText}>
            {typeText}
          </span>
          <ChevronsUpDownIcon aria-hidden className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="end" aria-label={typeLabel}>
        {mode === "list" ? (
          <TypeCommandList
            type={column.type}
            enums={sortEnums(schema)}
            onPick={applyType}
            onPickCustom={() => {
              setMode("custom");
            }}
          />
        ) : (
          <CustomTypeForm
            initialName={initialCustomName}
            onApply={(name) => {
              applyType({ kind: "custom", name });
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
