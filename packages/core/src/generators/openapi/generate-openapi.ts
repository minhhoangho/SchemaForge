import type { SchemaDocument } from "../../model/schema-document.js";
import { finalizeDiagnostics } from "../shared/diagnostics.js";
import type {
  Generate,
  GenerateResult,
  GeneratorOptions,
} from "../shared/generator-types.js";
import { buildRestApiNames } from "../shared/rest-resources.js";
import { renderFileContent } from "../shared/render-file.js";
import { buildPaths } from "./openapi-paths.js";
import { buildComponentSchemas } from "./openapi-schemas.js";

export type OpenApiOptions = GeneratorOptions["openapi"];

const OPENAPI_VERSION = "3.1.1";
// The schema has no version of its own, and the output must not carry a time.
const DOCUMENT_VERSION = "1.0.0";
const SERVER_URL = "/api";
const JSON_INDENT = 2;

// CG-07 has no options, so the implementation leaves out the second parameter
// of `Generate` instead of declaring an unused one.
export const generateOpenApi: Generate<"openapi"> = (
  schema: SchemaDocument,
): GenerateResult => {
  const names = buildRestApiNames(schema);
  const paths = buildPaths(schema, names);
  const components = buildComponentSchemas(schema, names);
  // Key order here is the key order of the file.
  const document = {
    openapi: OPENAPI_VERSION,
    info: { title: schema.name, version: DOCUMENT_VERSION },
    servers: [{ url: SERVER_URL }],
    paths: paths.paths,
    components: { schemas: components.schemas },
  };
  const content = renderFileContent([
    [JSON.stringify(document, null, JSON_INDENT)],
  ]);
  return {
    file: { fileName: "openapi.json", language: "json", content },
    diagnostics: finalizeDiagnostics([
      ...paths.diagnostics,
      ...components.diagnostics,
    ]),
  };
};
