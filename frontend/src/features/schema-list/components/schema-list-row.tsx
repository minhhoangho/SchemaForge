"use client";

import { EllipsisIcon } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SchemaActionTarget } from "@/features/schema-list/hooks/use-schema-actions";
import { getSchemaListEntryId } from "@/features/schema-list/hooks/use-schema-list";
import type { SchemaListEntry } from "@/lib/storage/schema-repository";
import type { MergedSchemaRow } from "@/lib/sync/merge-schema-list";

import { SchemaStatusLabel } from "./schema-status-label";

const UPDATED_AT_FORMAT: Intl.DateTimeFormatOptions = {
  dateStyle: "medium",
  timeStyle: "short",
};

const LINK_CLASS_NAME =
  "truncate font-medium text-primary underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

// The trigger is passed back so the dialog can return focus to it.
type RowAction = (
  target: SchemaActionTarget,
  trigger: HTMLElement | null,
) => void;

type SchemaListRowProps = OwnedRowProps | GuestRowProps;

type OwnedRowProps = {
  readonly kind: "owned";
  readonly row: MergedSchemaRow;
  readonly onRename: RowAction;
  readonly onDelete: RowAction;
};

type GuestRowProps = {
  readonly kind: "guest";
  readonly entry: SchemaListEntry;
  readonly onRename: RowAction;
  readonly onDelete: RowAction;
  readonly onUploadToCloud: RowAction;
};

const ROW_CLASS_NAME =
  "flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground";

function getSchemaHref(schemaId: string): string {
  return `/schemas/${schemaId}`;
}

type RowSummaryProps = {
  readonly schema: Pick<MergedSchemaRow, "id" | "name" | "updatedAt">;
  readonly label: MergedSchemaRow["label"];
};

function RowSummary({ schema, label }: RowSummaryProps): JSX.Element {
  const { t, i18n } = useTranslation("schemaList");

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <Link href={getSchemaHref(schema.id)} className={LINK_CLASS_NAME}>
        {schema.name}
      </Link>
      <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {t("row.updatedAt", {
          time: new Intl.DateTimeFormat(
            i18n.language,
            UPDATED_AT_FORMAT,
          ).format(schema.updatedAt),
        })}
        {label === null ? null : <SchemaStatusLabel label={label} />}
      </span>
    </div>
  );
}

type RowMenuProps = {
  readonly target: SchemaActionTarget;
  // A row whose metadata cannot be read can only be deleted.
  readonly isReadable: boolean;
  readonly onRename: RowAction;
  readonly onDelete: RowAction;
  readonly onUploadToCloud?: RowAction;
};

function RowMenu({
  target,
  isReadable,
  onRename,
  onDelete,
  onUploadToCloud,
}: RowMenuProps): JSX.Element {
  const { t } = useTranslation(["schemaList", "sync"]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Saving to the cloud may open the sign-in prompt, which returns focus to
  // whatever was focused when it opened. It therefore runs only once the menu
  // has closed and focus is back on the trigger, not on a vanished item.
  const pendingUploadRef = useRef<SchemaActionTarget | null>(null);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* Icon-only button, so aria-label carries the whole name. */}
        <Button
          ref={triggerRef}
          variant="ghost"
          size="icon"
          aria-label={t("row.actions", { name: target.name })}
        >
          <EllipsisIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onCloseAutoFocus={(event) => {
          const pending = pendingUploadRef.current;
          if (pending === null || onUploadToCloud === undefined) {
            return;
          }
          pendingUploadRef.current = null;
          event.preventDefault();
          triggerRef.current?.focus();
          onUploadToCloud(pending, triggerRef.current);
        }}
      >
        {isReadable && (
          <>
            <DropdownMenuItem asChild>
              <Link href={getSchemaHref(target.id)}>{t("row.open")}</Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                onRename(target, triggerRef.current);
              }}
            >
              {t("row.rename")}
            </DropdownMenuItem>
            {onUploadToCloud === undefined ? null : (
              <DropdownMenuItem
                onSelect={() => {
                  pendingUploadRef.current = target;
                }}
              >
                {t("sync:schemaList.saveToCloud")}
              </DropdownMenuItem>
            )}
          </>
        )}
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            onDelete(target, triggerRef.current);
          }}
        >
          {t("row.delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SchemaListRow(props: SchemaListRowProps): JSX.Element {
  if (props.kind === "owned") {
    const { row } = props;
    return (
      <li className={ROW_CLASS_NAME}>
        <RowSummary schema={row} label={row.label} />
        <RowMenu
          target={{
            id: row.id,
            name: row.name,
            source: row.source === "cache" ? "cached" : "cloud-only",
          }}
          isReadable
          onRename={props.onRename}
          onDelete={props.onDelete}
        />
      </li>
    );
  }
  return <GuestRow {...props} />;
}

function GuestRow({
  entry,
  onRename,
  onDelete,
  onUploadToCloud,
}: GuestRowProps): JSX.Element {
  const { t } = useTranslation("schemaList");
  const schema = entry.kind === "readable" ? entry.schema : null;
  const displayName = schema === null ? t("row.unreadable") : schema.name;

  return (
    <li className={ROW_CLASS_NAME}>
      {schema === null ? (
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-muted-foreground">{displayName}</span>
        </div>
      ) : (
        <RowSummary schema={schema} label={null} />
      )}
      <RowMenu
        target={{
          id: getSchemaListEntryId(entry),
          name: displayName,
          source: "guest",
        }}
        isReadable={schema !== null}
        onRename={onRename}
        onDelete={onDelete}
        onUploadToCloud={onUploadToCloud}
      />
    </li>
  );
}
