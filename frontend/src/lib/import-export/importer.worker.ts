import "@/lib/zod-config";

import { handleImportRequest } from "./handle-import-request";
import { loadImporter } from "./importer-loaders";
import { isImportRequest, type ImportResponse } from "./import-protocol";

self.onmessage = async (event: MessageEvent<unknown>): Promise<void> => {
  const request = event.data;
  if (!isImportRequest(request)) return;
  let response: ImportResponse;
  try {
    response = await handleImportRequest(request, {
      loadImporter,
      generateId: () => crypto.randomUUID(),
    });
  } catch {
    // Not logged: the error may quote the user's source.
    response = { requestId: request.requestId, kind: "crashed" };
  }
  self.postMessage(response);
};
