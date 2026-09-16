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

const UPDATED_AT_FORMAT: Intl.DateTimeFormatOptions = {
  dateStyle: "medium",
  timeStyle: "short",
};

const LINK_CLASS_NAME =
  "truncate font-medium text-primary underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

type SchemaListRowProps = {
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

function getSchemaHref(schemaId: string): string {
  return `/schemas/${schemaId}`;
}

export function SchemaListRow({
  entry,
  onRename,
  onDelete,
}: SchemaListRowProps): JSX.Element {
  const { t, i18n } = useTranslation("schemaList");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const schema = entry.kind === "readable" ? entry.schema : null;
  const displayName = schema === null ? t("row.unreadable") : schema.name;

  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {schema === null ? (
          <span className="text-muted-foreground">{displayName}</span>
        ) : (
          <>
            <Link href={getSchemaHref(schema.id)} className={LINK_CLASS_NAME}>
              {schema.name}
            </Link>
            <span className="text-sm text-muted-foreground">
              {t("row.updatedAt", {
                time: new Intl.DateTimeFormat(
                  i18n.language,
                  UPDATED_AT_FORMAT,
                ).format(schema.updatedAt),
              })}
            </span>
          </>
        )}
      </div>
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
