"use client";

import type { SchemaDocument } from "@schemaforge/core";
import type * as SeedNamespace from "@schemaforge/core/generators/seed";
import type { SeedDataset } from "@schemaforge/core/generators/seed";
import { CopyIcon, DownloadIcon, TriangleAlertIcon } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useId, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/class-names";
import { useNotify } from "@/lib/use-notify";

import { useEditorStore } from "../../state/use-editor-store";
import { AI_SMALL_TEXT_CLASS_NAME } from "./ai-text-styles";

// Loaded on demand so the seed module stays out of the editor's first chunk.
type SeedModule = typeof SeedNamespace;

// Sits in the assistant column at its full width, like the other cards.
const CARD_CLASS_NAME =
  "grid w-full min-w-0 gap-2.5 rounded-xl border border-border bg-card p-2.5 text-card-foreground shadow-sm";

const FORMATS = ["postgresql", "mysql", "sqlserver", "json"] as const;
type Format = (typeof FORMATS)[number];

export type AiSampleDataCardProps = {
  // `AiSampleData["dataset"]`, not yet checked.
  readonly dataset: unknown;
  // Sends the user's last message again.
  readonly onRetry: () => void;
};

function formatCell(value: unknown): string {
  if (value === undefined) {
    return "";
  }
  if (value === null) {
    return "NULL";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function isFormat(value: string): value is Format {
  return FORMATS.some((format) => format === value);
}

function SampleTable({
  document,
  entry,
}: {
  readonly document: SchemaDocument;
  readonly entry: SeedDataset["tables"][number];
}): JSX.Element {
  const { t } = useTranslation("ai");
  const captionId = useId();
  const table = document.tables[entry.tableId];
  const caption = t("sampleData.caption", { table: table?.name ?? "" });
  const columns = (table?.columnIds ?? []).filter((columnId) =>
    entry.rows.some((row) => columnId in row),
  );

  return (
    <div
      // eslint-disable-next-line jsx-a11y-x/no-noninteractive-tabindex -- a horizontally scrollable region must be keyboard focusable (WCAG 2.1.1)
      tabIndex={0}
      role="region"
      aria-labelledby={captionId}
      className="overflow-x-auto rounded-md border border-border outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <table className="w-full border-collapse text-left text-xs">
        <caption id={captionId} className="sr-only">
          {caption}
        </caption>
        <thead>
          <tr>
            {columns.map((columnId) => (
              <th
                key={columnId}
                scope="col"
                className="border-b border-border bg-muted px-2 py-1.5 font-medium whitespace-nowrap text-foreground"
              >
                {document.columns[columnId]?.name ?? ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entry.rows.map((row, rowIndex) => (
            // Rows have no identity beyond their position in this dataset.
            <tr key={rowIndex}>
              {columns.map((columnId) => (
                <td
                  key={columnId}
                  className="border-b border-border px-2 py-1.5 font-mono whitespace-nowrap text-foreground"
                >
                  {formatCell(row[columnId])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function downloadFile(fileName: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content]));
  const link = window.document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function ValidCard({
  seed,
  document,
  dataset,
}: {
  readonly seed: SeedModule;
  readonly document: SchemaDocument;
  readonly dataset: SeedDataset;
}): JSX.Element {
  const { t } = useTranslation("ai");
  const notify = useNotify();
  const formatId = useId();
  const titleId = useId();
  const [format, setFormat] = useState<Format>("postgresql");

  function file(): ReturnType<SeedModule["serializeSeedDataset"]> {
    return seed.serializeSeedDataset(document, dataset, format);
  }

  function copy(): void {
    navigator.clipboard.writeText(file().content).then(
      () => {
        notify({ tone: "success", titleKey: "ai:sampleData.copied" });
      },
      () => {
        notify({ tone: "error", titleKey: "ai:sampleData.copyFailed" });
      },
    );
  }

  function download(): void {
    const { fileName, content } = file();
    downloadFile(fileName, content);
  }

  const firstTableId = dataset.tables[0]?.tableId;

  return (
    <div role="group" aria-labelledby={titleId} className={CARD_CLASS_NAME}>
      <p id={titleId} className="text-sm font-semibold">
        {t("sampleData.title")}
      </p>
      {firstTableId === undefined ? null : (
        <Tabs defaultValue={firstTableId}>
          <TabsList>
            {dataset.tables.map((entry) => (
              <TabsTrigger key={entry.tableId} value={entry.tableId}>
                {document.tables[entry.tableId]?.name ?? ""}
                <span className="font-normal text-muted-foreground">
                  {t("sampleData.rowCount", { count: entry.rows.length })}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
          {dataset.tables.map((entry) => (
            <TabsContent key={entry.tableId} value={entry.tableId}>
              <SampleTable document={document} entry={entry} />
            </TabsContent>
          ))}
        </Tabs>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor={formatId}>{t("sampleData.format")}</Label>
        <Select
          value={format}
          onValueChange={(next) => {
            if (isFormat(next)) {
              setFormat(next);
            }
          }}
        >
          <SelectTrigger id={formatId} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FORMATS.map((option) => (
              <SelectItem key={option} value={option}>
                {t(`sampleData.formats.${option}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("sampleData.sqlReminder")}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={copy}>
          <CopyIcon aria-hidden />
          {t("sampleData.copy")}
        </Button>
        <Button variant="secondary" size="sm" onClick={download}>
          <DownloadIcon aria-hidden />
          {t("sampleData.download")}
        </Button>
      </div>
    </div>
  );
}

/**
 * AI-made sample rows for the current schema. The dataset is untrusted: it is
 * parsed and checked against the live document on every render, so a schema
 * change turns the card into the outdated message. Values show as text only,
 * and `serializeSeedDataset` does all the escaping of copied or downloaded
 * output.
 */
export function AiSampleDataCard({
  dataset,
  onRetry,
}: AiSampleDataCardProps): JSX.Element {
  const { t } = useTranslation("ai");
  const document = useEditorStore((state) => state.document);
  const [seed, setSeed] = useState<SeedModule | null>(null);

  useEffect(() => {
    let isCurrent = true;
    void import("@schemaforge/core/generators/seed").then((loaded) => {
      if (isCurrent) {
        setSeed(loaded);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, []);

  if (seed === null) {
    return <Skeleton aria-hidden className="h-32 w-full" />;
  }

  const parsed = seed.parseSeedDataset(dataset);
  if (
    !parsed.isOk ||
    seed.validateSeedDataset(document, parsed.value).length > 0
  ) {
    return (
      <div className={CARD_CLASS_NAME}>
        <div className="flex items-start gap-2 rounded-lg border border-l-[3px] border-border border-l-warning bg-background p-2">
          <TriangleAlertIcon
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-warning"
          />
          <div className="grid min-w-0 justify-items-start gap-2">
            <p className={cn(AI_SMALL_TEXT_CLASS_NAME, "text-foreground")}>
              {t("sampleData.outdated")}
            </p>
            <Button variant="secondary" size="sm" onClick={onRetry}>
              {t("sampleData.retry")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <ValidCard seed={seed} document={document} dataset={parsed.value} />;
}
