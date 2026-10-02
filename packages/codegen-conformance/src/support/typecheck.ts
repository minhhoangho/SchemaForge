import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import ts from "typescript";

import { withTempDirectory } from "./temp-directory.js";

export type SourceFile = {
  readonly fileName: string;
  readonly content: string;
};

// tsconfig.base.json plus the module settings of an ESM package.
const COMPILER_OPTIONS: ts.CompilerOptions = {
  strict: true,
  noUncheckedIndexedAccess: true,
  noImplicitOverride: true,
  noFallthroughCasesInSwitch: true,
  verbatimModuleSyntax: true,
  isolatedModules: true,
  skipLibCheck: true,
  target: ts.ScriptTarget.ES2023,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  noEmit: true,
  types: [],
};

const ESM_PACKAGE_JSON = JSON.stringify({ type: "module" });

async function writeSourceFile(
  directory: string,
  file: SourceFile,
): Promise<string> {
  const path = join(directory, file.fileName);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, file.content);
  return path;
}

/** Type-checks the files as one ESM program; an empty result means they pass. */
export function typecheckFiles(
  files: readonly SourceFile[],
): Promise<readonly string[]> {
  return withTempDirectory(async (directory) => {
    await writeFile(join(directory, "package.json"), ESM_PACKAGE_JSON);
    const rootNames = await Promise.all(
      files.map((file) => writeSourceFile(directory, file)),
    );
    const program = ts.createProgram(rootNames, COMPILER_OPTIONS);
    const formatHost: ts.FormatDiagnosticsHost = {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => directory,
      getNewLine: () => "\n",
    };
    return ts
      .getPreEmitDiagnostics(program)
      .map((diagnostic) =>
        ts.formatDiagnostics([diagnostic], formatHost).trimEnd(),
      );
  });
}
