// This module is loaded in the browser, possibly before zod-config.ts, so it
// must not create Zod schemas: Zod would probe `new Function` under the CSP.
export const NODE_ENVIRONMENTS = ["development", "production", "test"] as const;

export type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];

export const DEFAULT_API_URL = "http://localhost:3001";

// Loopback hosts stay secure contexts without TLS, so http is accepted there
// even in production (Issue 5, option a of the auth-cloud plan).
const LOOPBACK_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]"];

export type Environment = {
  readonly nodeEnvironment: NodeEnvironment;
  readonly isDevelopment: boolean;
  readonly isProduction: boolean;
  readonly apiOrigin: string;
};

export type EnvironmentSource = {
  readonly NODE_ENV: string | undefined;
  readonly NEXT_PUBLIC_API_URL: string | undefined;
};

function isNodeEnvironment(
  value: string | undefined,
): value is NodeEnvironment {
  return NODE_ENVIRONMENTS.some((candidate) => candidate === value);
}

function parseApiUrl(value: string): URL {
  try {
    return new URL(value);
  } catch (cause) {
    throw new Error(`Invalid NEXT_PUBLIC_API_URL "${value}".`, { cause });
  }
}

function readApiOrigin(
  rawValue: string | undefined,
  isProduction: boolean,
): string {
  if (rawValue === undefined || rawValue === "") {
    return new URL(DEFAULT_API_URL).origin;
  }

  const url = parseApiUrl(rawValue);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(
      `NEXT_PUBLIC_API_URL "${rawValue}" must use http or https.`,
    );
  }
  if (url.username !== "" || url.password !== "") {
    throw new Error(
      `NEXT_PUBLIC_API_URL "${rawValue}" must not contain credentials.`,
    );
  }
  if (url.pathname !== "/" || url.search !== "" || url.hash !== "") {
    throw new Error(
      `NEXT_PUBLIC_API_URL "${rawValue}" must not contain a path, a query, or a hash.`,
    );
  }
  if (
    isProduction &&
    url.protocol === "http:" &&
    !LOOPBACK_HOSTNAMES.includes(url.hostname)
  ) {
    throw new Error(
      `NEXT_PUBLIC_API_URL "${rawValue}" must use https in production unless the host is a loopback address.`,
    );
  }

  return url.origin;
}

export function readEnvironment(source: EnvironmentSource): Environment {
  const nodeEnvironment = source.NODE_ENV;
  if (!isNodeEnvironment(nodeEnvironment)) {
    throw new Error(
      `Unsupported NODE_ENV "${String(nodeEnvironment)}"; expected one of ${NODE_ENVIRONMENTS.join(", ")}.`,
    );
  }

  const isProduction = nodeEnvironment === "production";

  return {
    nodeEnvironment,
    isDevelopment: nodeEnvironment === "development",
    isProduction,
    apiOrigin: readApiOrigin(source.NEXT_PUBLIC_API_URL, isProduction),
  };
}

// Next.js inlines process.env.NODE_ENV and process.env.NEXT_PUBLIC_API_URL
// into client bundles only when written out verbatim, so do not destructure
// process.env here.
export const env: Environment = readEnvironment({
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});
