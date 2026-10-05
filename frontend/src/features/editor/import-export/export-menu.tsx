"use client";

import { DownloadIcon } from "lucide-react";
import type { JSX } from "react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { ImageFormat } from "./compute-image-frame";
import { useExportActions } from "./use-export-actions";
import { ZipDialog } from "./zip-dialog";

const IMAGE_FORMATS = ["png", "svg"] as const satisfies readonly ImageFormat[];

export function ExportMenu(): JSX.Element {
  const { t } = useTranslation("importExport");
  const { isGeneratingImage, exportJson, exportImage } = useExportActions();
  const [isZipOpen, setIsZipOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button ref={triggerRef} variant="ghost">
            <DownloadIcon aria-hidden />
            {t("export.menu")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={exportJson}>
            {t("export.json")}
          </DropdownMenuItem>
          {IMAGE_FORMATS.map((format) => (
            <DropdownMenuItem
              key={format}
              disabled={isGeneratingImage}
              onSelect={() => {
                // The hook reports its own failures, so the promise never rejects.
                void exportImage(format);
              }}
            >
              {isGeneratingImage
                ? t("export.generatingImage")
                : t(`export.${format}`)}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              setIsZipOpen(true);
            }}
          >
            {t("export.zip")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ZipDialog
        open={isZipOpen}
        onOpenChange={setIsZipOpen}
        returnFocusRef={triggerRef}
      />
    </>
  );
}
