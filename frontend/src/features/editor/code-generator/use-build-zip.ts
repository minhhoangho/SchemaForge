"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { toImageFileName } from "@/lib/import-export/download-file-names";
import { toDownloadBaseName } from "@/lib/import-export/to-download-base-name";

import { captureCanvasImage } from "../import-export/capture-canvas-image";
import type { ImageFormat } from "../import-export/compute-image-frame";
import { toZipGeneratorRequests } from "../import-export/zip-selection";
import { useCanvasNodeControls } from "../lib/viewport-controls";
import { useEditorStore } from "../state/use-editor-store";
import type { BuildZipRequest, BuildZipResponse } from "./worker-protocol";

export type BuiltZip = {
  readonly bytes: Uint8Array;
  readonly diagnosticCount: number;
  // The base name the file name is built from.
  readonly baseName: string;
};

export type BuildZip = {
  readonly isBuilding: boolean;
  // Rejects when the capture or the worker fails; the caller reports it.
  readonly build: () => Promise<BuiltZip>;
};

const EXPORT_ROOT_SELECTOR = "[data-export-root]";

function createDefaultWorker(): Worker {
  return new Worker(new URL("./code-generator.worker.ts", import.meta.url), {
    type: "module",
  });
}

export function useBuildZip(options?: {
  readonly createWorker?: () => Worker;
}): BuildZip {
  const { t } = useTranslation("codeGenerator");
  const schema = useEditorStore((state) => state.document);
  const selection = useEditorStore((state) => state.zipSelection);
  const codeOptions = useEditorStore((state) => state.codeOptions);
  const { getMeasuredNodes } = useCanvasNodeControls();
  const [isBuilding, setIsBuilding] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const nextRequestId = useRef(0);
  const createWorker = options?.createWorker;

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  const captureImages = useCallback(
    async (baseName: string): Promise<BuildZipRequest["images"]> => {
      const formats: ImageFormat[] = [
        ...(selection.png ? (["png"] as const) : []),
        ...(selection.svg ? (["svg"] as const) : []),
      ];
      const images: { fileName: string; bytes: Uint8Array }[] = [];
      for (const format of formats) {
        const root = document.querySelector<HTMLElement>(EXPORT_ROOT_SELECTOR);
        if (root === null) {
          throw new Error("The canvas is not mounted.");
        }
        // One at a time: captures share the canvas's exporting state.
        const { blob } = await captureCanvasImage({
          root,
          nodes: getMeasuredNodes(),
          hasSelfRelation: Object.values(schema.relations).some(
            (relation) => relation.fromTableId === relation.toTableId,
          ),
          format,
        });
        images.push({
          fileName: toImageFileName(baseName, format),
          bytes: new Uint8Array(await blob.arrayBuffer()),
        });
      }
      return images;
    },
    [getMeasuredNodes, schema, selection.png, selection.svg],
  );

  const build = useCallback(async (): Promise<BuiltZip> => {
    if (isBuilding) {
      throw new Error("A zip is already being built.");
    }
    setIsBuilding(true);
    try {
      const baseName = toDownloadBaseName(schema.name);
      const images = await captureImages(baseName);
      workerRef.current ??= (createWorker ?? createDefaultWorker)();
      const worker = workerRef.current;
      const requestId = ++nextRequestId.current;
      const request: BuildZipRequest = {
        kind: "build-zip",
        requestId,
        document: schema,
        baseName,
        generators: toZipGeneratorRequests(
          selection,
          codeOptions,
          t("markdownLabels", { returnObjects: true }),
        ),
        includeJson: selection.json,
        images,
      };
      const response = await new Promise<BuildZipResponse>(
        (resolve, reject) => {
          worker.onmessage = (event: MessageEvent<BuildZipResponse>): void => {
            if (event.data.requestId === requestId) resolve(event.data);
          };
          const fail = (): void => {
            reject(new Error("The zip worker failed."));
          };
          worker.onerror = fail;
          worker.onmessageerror = fail;
          worker.postMessage(request, {
            transfer: images.map((image) => image.bytes.buffer),
          });
        },
      );
      if (response.kind !== "zip") {
        throw new Error("The zip could not be built.");
      }
      return {
        bytes: response.bytes,
        diagnosticCount: response.diagnosticCount,
        baseName,
      };
    } finally {
      setIsBuilding(false);
    }
  }, [
    captureImages,
    codeOptions,
    createWorker,
    isBuilding,
    schema,
    selection,
    t,
  ]);

  return { isBuilding, build };
}
