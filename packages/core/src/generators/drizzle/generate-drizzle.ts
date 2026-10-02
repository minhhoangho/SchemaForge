import { sortEnums, sortTables } from "../../model/ordering.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import { finalizeDiagnostics } from "../shared/diagnostics.js";
import type {
  GenerateResult,
  GeneratorOptions,
} from "../shared/generator-types.js";
import { renderFileContent } from "../shared/render-file.js";
import type { DrizzleContext } from "./drizzle-context.js";
import { createDrizzleContext } from "./drizzle-context.js";
import type { DrizzleDialect } from "./drizzle-names.js";
import { BINARY_DATA_TYPES } from "./drizzle-names.js";
import { renderDrizzleRelations } from "./drizzle-relations.js";
import { EXTRA_CONFIG_TYPES, renderDrizzleTable } from "./drizzle-tables.js";

export type DrizzleOptions = GeneratorOptions["drizzle"];

const CORE_MODULES: Readonly<Record<DrizzleDialect, string>> = {
  postgresql: "drizzle-orm/pg-core",
  mysql: "drizzle-orm/mysql-core",
};

// Widened to string so the runtime guard also covers callers without types.
const DRIZZLE_DIALECTS: readonly string[] = ["postgresql", "mysql"];

// Imported from "drizzle-orm" rather than the dialect module.
const SQL_IMPORT = "sql";

function compareNames(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}

function renderEnums(context: DrizzleContext): readonly string[] {
  return sortEnums(context.schema).flatMap((element) => {
    const variable = context.names.enumVariables.get(element.id);
    if (variable === undefined) {
      return [];
    }
    // An enum without values is written as `[]`: part 2 already reports
    // enum-values-empty (orchestrator decision, Task 18).
    const values = element.values
      .map((value) => JSON.stringify(value))
      .join(", ");
    return [
      `export const ${variable} = pgEnum(${JSON.stringify(element.name)}, [${values}]);`,
    ];
  });
}

function renderCustomTypes(
  context: DrizzleContext,
): readonly (readonly string[])[] {
  return [...context.names.customTypeVariables].map(([dataType, variable]) => {
    const data =
      dataType === BINARY_DATA_TYPES[context.dialect]
        ? "Uint8Array"
        : "unknown";
    return [
      `export const ${variable} = customType<{ data: ${data} }>({`,
      "  dataType() {",
      `    return ${JSON.stringify(dataType)};`,
      "  },",
      "});",
    ];
  });
}

function renderImports(
  dialect: DrizzleDialect,
  builders: readonly string[],
  hasCallback: boolean,
  hasRelations: boolean,
): readonly string[] {
  const coreNames = [
    ...new Set([
      ...builders.filter((name) => name !== SQL_IMPORT),
      ...(hasCallback ? [EXTRA_CONFIG_TYPES[dialect]] : []),
    ]),
  ]
    .toSorted(compareNames)
    .map((name) =>
      name === EXTRA_CONFIG_TYPES[dialect] ? `type ${name}` : name,
    );
  const ormNames = [
    ...(hasRelations ? ["relations"] : []),
    ...(builders.includes(SQL_IMPORT) ? [SQL_IMPORT] : []),
  ];
  return [
    ...(coreNames.length === 0
      ? []
      : [
          `import { ${coreNames.join(", ")} } from "${CORE_MODULES[dialect]}";`,
        ]),
    ...(ormNames.length === 0
      ? []
      : [`import { ${ormNames.join(", ")} } from "drizzle-orm";`]),
  ];
}

/** `schema.ts` for drizzle-orm 0.45 with the given dialect (spec CG-03). */
export function generateDrizzle(
  schema: SchemaDocument,
  options: DrizzleOptions,
): GenerateResult {
  const { dialect } = options;
  if (!DRIZZLE_DIALECTS.includes(dialect)) {
    throw new RangeError(`Unknown Drizzle dialect: ${dialect}`);
  }
  const context = createDrizzleContext(schema, dialect);
  const tables = sortTables(schema);
  const tableBlocks = tables.map((table) =>
    renderDrizzleTable(context.value, table),
  );
  const relationBlocks = tables.map((table) =>
    renderDrizzleRelations(context.value, table),
  );
  const enums = dialect === "postgresql" ? renderEnums(context.value) : [];
  const customTypes = renderCustomTypes(context.value);
  const builders = [
    ...(enums.length > 0 ? ["pgEnum"] : []),
    ...(customTypes.length > 0 ? ["customType"] : []),
    ...tableBlocks.flatMap((block) => block.value.builders),
  ];
  const content = renderFileContent([
    renderImports(
      dialect,
      builders,
      tableBlocks.some((block) => block.value.hasCallback),
      relationBlocks.some((block) => block.length > 0),
    ),
    enums,
    ...customTypes,
    ...tableBlocks.map((block) => block.value.lines),
    ...relationBlocks,
  ]);
  return {
    file: { fileName: "schema.ts", language: "typescript", content },
    diagnostics: finalizeDiagnostics([
      ...context.diagnostics,
      ...tableBlocks.flatMap((block) => block.diagnostics),
    ]),
  };
}
