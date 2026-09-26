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
import type { SchemaRecord } from "@/lib/storage/records";
import type { SchemaListEntry } from "@/lib/storage/schema-repository";
import type { MergedSchemaRow } from "@/lib/sync/merge-schema-list";

import { SchemaStatusLabel } from "./schema-status-label";

const UPDATED_AT_FORMAT: Intl.DateTimeFormatOptions = {
  dateStyle: "medium",
  timeStyle: "short",
};

const LINK_CLASS_NAME =
  "truncate font-medium text-primary underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

// A guest row keeps the local actions of part 3. An owned row (merged from
// the cloud and the account's cache) only links to the editor; its actions
// arrive with Task 33 of the auth-cloud plan.
type SchemaListRowProps = OwnedRowProps | GuestRowProps;

type OwnedRowProps = {
  readonly kind: "owned";
  readonly row: MergedSchemaRow;
};

type GuestRowProps = {
  readonly kind: "guest";
  readonly entry: SchemaListEntry;
  // The trigger is passed back so the dialog can return focus to it.
  readonly onRename: (
    schema: SchemaRecord,
    trigger: HTMLElement | null,
  ) => void;
  readonly onDelete: (
    entry: SchemaListEntry,
    trigger: HTMLElement | null,
  ) => void;
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

export function SchemaListRow(props: SchemaListRowProps): JSX.Element {
  if (props.kind === "owned") {
    return (
      <li className={ROW_CLASS_NAME}>
        <RowSummary schema={props.row} label={props.row.label} />
      </li>
    );
  }
  return <GuestRow {...props} />;
}

function GuestRow({ entry, onRename, onDelete }: GuestRowProps): JSX.Element {
  const { t } = useTranslation("schemaList");
  const triggerRef = useRef<HTMLButtonElement>(null);
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {/* Icon-only button, so aria-label carries the whole name. */}
          <Button
            ref={triggerRef}
            variant="ghost"
            size="icon"
            aria-label={t("row.actions", { name: displayName })}
          >
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {schema !== null && (
            <>
              <DropdownMenuItem asChild>
                <Link href={getSchemaHref(schema.id)}>{t("row.open")}</Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  onRename(schema, triggerRef.current);
                }}
              >
                {t("row.rename")}
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              onDelete(entry, triggerRef.current);
            }}
          >
            {t("row.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
