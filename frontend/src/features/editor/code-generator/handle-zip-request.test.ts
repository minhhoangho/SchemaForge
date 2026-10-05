import { createEmptySchema, serializeSchemaDocument } from "@schemaforge/core";
import type { Generate, GeneratorTarget } from "@schemaforge/core";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { handleZipRequest } from "./handle-zip-request";
import type { ZipDependencies } from "./handle-zip-request";
import type { BuildZipRequest } from "./worker-protocol";

const document = createEmptySchema("Shop");

function fakeLoad(diagnosticCount: number): ZipDependencies["loadGenerator"] {
  return <T extends GeneratorTarget>(target: T): Promise<Generate<T>> => {
    const generate = (): ReturnType<Generate<T>> => ({
      file: {
        fileName: `x.${target === "prisma" ? "prisma" : "sql"}`,
        language: target === "prisma" ? "prisma" : "sql",
        content: `-- ${target}`,
      },
      diagnostics: Array.from({ length: diagnosticCount }, () => ({
        code: "seed-table-skipped" as const,
        path: ["tables", "tbl_users"],
      })),
    });
    return Promise.resolve(generate);
  };
}

const request: BuildZipRequest = {
  kind: "build-zip",
  requestId: 5,
  document,
  baseName: "shop",
  generators: [
    { target: "postgresql", options: {} },
    { target: "prisma", options: { provider: "mysql" } },
  ],
  includeJson: true,
  images: [{ fileName: "shop.png", bytes: new Uint8Array([1, 2, 3]) }],
};

describe("handleZipRequest", () => {
  it("zips the selected generator outputs, json and images with spec file names", async () => {
    const response = await handleZipRequest(request, {
      loadGenerator: fakeLoad(0),
    });
    const files = unzipSync(response.bytes);

    expect(response.requestId).toBe(5);
    expect(Object.keys(files)).toStrictEqual([
      "shop.mysql.prisma",
      "shop.png",
      "shop.postgresql.sql",
      "shop.schemaforge.json",
    ]);
    expect(strFromU8(files["shop.postgresql.sql"] ?? new Uint8Array())).toBe(
      "-- postgresql",
    );
    expect(strFromU8(files["shop.schemaforge.json"] ?? new Uint8Array())).toBe(
      serializeSchemaDocument(document),
    );
    expect(Array.from(files["shop.png"] ?? [])).toStrictEqual([1, 2, 3]);
  });

  it("sums generator diagnostics", async () => {
    const response = await handleZipRequest(
      { ...request, includeJson: false, images: [] },
      { loadGenerator: fakeLoad(2) },
    );
    expect(response.diagnosticCount).toBe(4);
  });
});
