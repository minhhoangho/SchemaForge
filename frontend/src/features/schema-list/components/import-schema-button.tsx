"use client";

import { UploadIcon } from "lucide-react";
import type { JSX } from "react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ImportDialog } from "@/components/import-dialog/import-dialog";
import { useCreateImportedSchema } from "@/components/import-dialog/use-create-imported-schema";
import { usePendingImport } from "@/components/pending-import-provider";
import { Button } from "@/components/ui/button";

/** Opens the import dialog in "new schema" mode (the list has no open schema). */
export function ImportSchemaButton(): JSX.Element {
  const { t } = useTranslation("importExport");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { lastSqlDialect, setLastSqlDialect } = usePendingImport();
  const createImportedSchema = useCreateImportedSchema();

  return (
    <>
      <Button
        ref={buttonRef}
        variant="outline"
        onClick={() => {
          setIsOpen(true);
        }}
      >
        <UploadIcon aria-hidden="true" />
        {t("import.open")}
      </Button>
      <ImportDialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        mergeTarget={null}
        rememberedSqlDialect={lastSqlDialect}
        onSqlDialectChange={setLastSqlDialect}
        onConfirm={(confirmation) => {
          if (confirmation.mode === "new") {
            void createImportedSchema(confirmation);
          }
        }}
        onReturnFocus={() => {
          buttonRef.current?.focus();
        }}
      />
    </>
  );
}
