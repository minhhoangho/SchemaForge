import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Response } from "supertest";

import type { HttpClient, HttpMethod } from "./http-client.js";

export type RouteEntry = {
  readonly method: HttpMethod;
  readonly path: string;
};

/** Spec section 5: exactly these five routes carry `@Public()`. */
export const PUBLIC_ROUTES: readonly RouteEntry[] = [
  { method: "GET", path: "/health" },
  { method: "POST", path: "/auth/register" },
  { method: "POST", path: "/auth/login" },
  { method: "POST", path: "/auth/refresh" },
  { method: "POST", path: "/auth/logout" },
];

const HTTP_METHODS: readonly HttpMethod[] = ["GET", "POST", "PUT", "DELETE"];
const PATH_SEPARATOR = "/";
const PARAMETER_PREFIX = ":";
// Route params are ids, and every id in this API is a UUID.
const PROBE_UUID = "00000000-0000-4000-8000-000000000000";

/** The Express app and its router are functions, so a plain object check is not enough. */
function readProperty(value: unknown, key: string): unknown {
  const isContainer =
    (typeof value === "object" || typeof value === "function") &&
    value !== null;
  if (!isContainer || !(key in value)) {
    return undefined;
  }
  const property: unknown = Reflect.get(value, key);
  return property;
}

function readRouteLayer(layer: unknown): readonly RouteEntry[] {
  const route = readProperty(layer, "route");
  const path = readProperty(route, "path");
  const methods = readProperty(route, "methods");
  if (typeof path !== "string" || methods === undefined) {
    return [];
  }
  return HTTP_METHODS.filter(
    (method) => readProperty(methods, method.toLowerCase()) === true,
  ).map((method) => ({ method, path }));
}

/**
 * Every route Nest registered on the Express instance. Reading them back from
 * the running app is what makes a route added later, public or not, visible to
 * the tests instead of silently uncovered.
 */
export function listRoutes(app: NestExpressApplication): readonly RouteEntry[] {
  const router = readProperty(app.getHttpAdapter().getInstance(), "router");
  const stack = readProperty(router, "stack");
  const layers: readonly unknown[] = Array.isArray(stack) ? stack : [];
  return layers.flatMap(readRouteLayer);
}

export function isPublicRoute(route: RouteEntry): boolean {
  return PUBLIC_ROUTES.some(
    (publicRoute) =>
      publicRoute.method === route.method && publicRoute.path === route.path,
  );
}

function toProbePath(path: string): string {
  return path
    .split(PATH_SEPARATOR)
    .map((segment) =>
      segment.startsWith(PARAMETER_PREFIX) ? PROBE_UUID : segment,
    )
    .join(PATH_SEPARATOR);
}

/** Sequential on purpose: supertest opens the listening socket per request. */
export async function probeRoutes(
  client: HttpClient,
  routes: readonly RouteEntry[],
): Promise<readonly Response[]> {
  const responses: Response[] = [];
  for (const route of routes) {
    responses.push(await client.request(route.method, toProbePath(route.path)));
  }
  return responses;
}
