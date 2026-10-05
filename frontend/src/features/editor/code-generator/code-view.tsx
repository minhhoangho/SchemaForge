"use client";

import { CopyIcon, DownloadIcon } from "lucide-react";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { downloadBlob } from "@/lib/download/download-blob";
import {
  toGeneratedFileName,
  toMimeType,
} from "@/lib/import-export/download-file-names";
import { toDownloadBaseName } from "@/lib/import-export/to-download-base-name";
import { useNotify } from "@/lib/use-notify";

import type { GeneratorRequest } from "./generator-request";
import type { GenerateCodeResponse } from "./worker-protocol";

type GeneratedOk = Extract<GenerateCodeResponse, { kind: "ok" }>;

export type CodeViewProps = {
  readonly response: GeneratedOk;
  // The translated name of the chosen output, for the accessible name.
  readonly targetLabel: string;
  readonly isBusy: boolean;
  // The schema name and the request that produced `response`, for the file name.
  readonly schemaName: string;
  readonly request: GeneratorRequest;
};

function Tokens({
  tokens,
}: {
  readonly tokens: GeneratedOk["tokens"];
}): JSX.Element {
  if (tokens === null) {
    return <></>;
  }
  return (
    <>
      {tokens.map((line, lineIndex) => (
        // A line has no identity beyond its position in this one output.
        <span key={lineIndex}>
          {line.map((token, tokenIndex) => (
            <span key={tokenIndex} style={{ color: token.color ?? undefined }}>
              {token.content}
            </span>
          ))}
          {"\n"}
        </span>
      ))}
    </>
  );
}

/**
 * The generated file as text in a scrollable, focusable region. Tokens render
 * as spans with a `var(--code-…)` color; without tokens (DBML) the raw text
 * shows. The page never builds HTML from the code.
 */
export function CodeView({
  response,
  targetLabel,
  isBusy,
  schemaName,
  request,
}: CodeViewProps): JSX.Element {
  const { t } = useTranslation("codeGenerator");
  const { t: tDownload } = useTranslation("importExport");
  const notify = useNotify();
  const { file, tokens } = response;

  function copy(): void {
    navigator.clipboard.writeText(file.content).then(
      () => {
        notify({ tone: "success", titleKey: "codeGenerator:copied" });
      },
      () => {
        notify({ tone: "error", titleKey: "codeGenerator:copyFailed" });
      },
    );
  }

  function download(): void {
    downloadBlob(
      new Blob([file.content], { type: toMimeType(file.language) }),
      toGeneratedFileName(toDownloadBaseName(schemaName), request, file),
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-xs text-muted-foreground">
          {file.fileName}
        </span>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" size="sm" onClick={copy}>
            <CopyIcon aria-hidden />
            {t("copy")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={isBusy}
            onClick={download}
          >
            <DownloadIcon aria-hidden />
            {tDownload("download.file")}
          </Button>
        </div>
      </div>
      <pre
        // eslint-disable-next-line jsx-a11y-x/no-noninteractive-tabindex -- a scrollable region must be keyboard focusable (WCAG 2.1.1)
        tabIndex={0}
        role="region"
        aria-label={t("codeArea", { target: targetLabel })}
        aria-busy={isBusy}
        className="min-h-48 flex-1 overflow-auto rounded-md border border-border bg-(--code-background) p-3 font-mono text-xs leading-5 text-(--code-foreground) outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <code>
          {tokens === null ? file.content : <Tokens tokens={tokens} />}
        </code>
      </pre>
    </div>
  );
}
