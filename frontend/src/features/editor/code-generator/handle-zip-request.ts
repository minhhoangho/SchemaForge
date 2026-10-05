import { serializeSchemaDocument } from "@schemaforge/core";
import { strToU8 } from "fflate";

import {
  toGeneratedFileName,
  toSchemaJsonFileName,
} from "@/lib/import-export/download-file-names";

import { buildZip } from "./build-zip";
import type { ZipEntry } from "./build-zip";
import type { loadGenerator } from "./generator-registry";
import type { BuildZipRequest, BuildZipResponse } from "./worker-protocol";

export type ZipDependencies = {
  readonly loadGenerator: typeof loadGenerator;
};

export async function handleZipRequest(
  request: BuildZipRequest,
  deps: ZipDependencies,
): Promise<Extract<BuildZipResponse, { kind: "zip" }>> {
  const { baseName, document } = request;
  // PNG is already compressed; everything else is text (spec section 11).
  const entries: ZipEntry[] = request.images.map((image) => ({
    ...image,
    isCompressed: !image.fileName.endsWith(".png"),
  }));
  if (request.includeJson) {
    entries.push({
      fileName: toSchemaJsonFileName(baseName),
      bytes: strToU8(serializeSchemaDocument(document)),
      isCompressed: true,
    });
  }
  let diagnosticCount = 0;
  for (const generatorRequest of request.generators) {
    const generate = await deps.loadGenerator(generatorRequest.target);
    const { file, diagnostics } = generate(document, generatorRequest.options);
    diagnosticCount += diagnostics.length;
    entries.push({
      fileName: toGeneratedFileName(baseName, generatorRequest, file),
      bytes: strToU8(file.content),
      isCompressed: true,
    });
  }
  return {
    requestId: request.requestId,
    kind: "zip",
    bytes: buildZip(entries),
    diagnosticCount,
  };
}
