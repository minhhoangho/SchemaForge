import type { ApiClient, RequestOptions } from "@/lib/api/api-client";
import type { CloudFetchResult } from "@/lib/sync/decide-open-action";

export type CloudFetchAttempt =
  | { readonly kind: "result"; readonly result: CloudFetchResult }
  | { readonly kind: "session-expired" };

const NOT_FOUND_STATUS = 404;
const UNAUTHORIZED_STATUS = 401;

/**
 * Asks the cloud for one schema. A 401 reaches here only after the API client
 * tried to refresh and already marked the session expired; any other failure
 * says nothing about the schema, so it reads as an unreachable cloud.
 */
export async function fetchCloudSchema(
  api: ApiClient,
  schemaId: string,
  options?: RequestOptions,
): Promise<CloudFetchAttempt> {
  const response = await api.schemas.get(schemaId, options);
  if (response.isOk) {
    return {
      kind: "result",
      result: { kind: "found", detail: response.value },
    };
  }
  const failure = response.error;
  if (failure.kind === "http" && failure.status === UNAUTHORIZED_STATUS) {
    return { kind: "session-expired" };
  }
  if (failure.kind === "http" && failure.status === NOT_FOUND_STATUS) {
    return { kind: "result", result: { kind: "not-found" } };
  }
  return { kind: "result", result: { kind: "unavailable" } };
}
