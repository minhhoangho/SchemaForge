// This module is loaded in the browser, possibly before zod-config.ts, so it
// must not create Zod schemas: Zod would probe `new Function` under the CSP.
export const NODE_ENVIRONMENTS = ["development", "production", "test"] as const;

export type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];

export type Environment = {
  readonly nodeEnvironment: NodeEnvironment;
  readonly isDevelopment: boolean;
  readonly isProduction: boolean;
};

export type EnvironmentSource = {
  readonly NODE_ENV: string | undefined;
};

function isNodeEnvironment(
  value: string | undefined,
): value is NodeEnvironment {
  return NODE_ENVIRONMENTS.some((candidate) => candidate === value);
}

export function readEnvironment(source: EnvironmentSource): Environment {
  const nodeEnvironment = source.NODE_ENV;
  if (!isNodeEnvironment(nodeEnvironment)) {
    throw new Error(
      `Unsupported NODE_ENV "${String(nodeEnvironment)}"; expected one of ${NODE_ENVIRONMENTS.join(", ")}.`,
    );
  }

  return {
    nodeEnvironment,
    isDevelopment: nodeEnvironment === "development",
    isProduction: nodeEnvironment === "production",
  };
}

// Next.js inlines process.env.NODE_ENV into client bundles only when it is
// written out verbatim, so do not destructure process.env here.
export const env: Environment = readEnvironment({
  NODE_ENV: process.env.NODE_ENV,
});
