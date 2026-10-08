import "@/lib/zod-config";

import { handleImportRequest } from "./handle-import-request";
import { loadImporter } from "./importer-loaders";
import { isImportRequest, type ImportResponse } from "./import-protocol";

self.onmessage = async (event: MessageEvent<unknown>): Promise<void> => {
  const request = event.data;
  if (!isImportRequest(request)) return;
  const crashed: ImportResponse = {
    requestId: request.requestId,
    kind: "crashed",
  };
  try {
    self.postMessage(
      await handleImportRequest(request, {
        loadImporter,
        generateId: () => crypto.randomUUID(),
      }),
    );
  } catch {
    // Not logged: the error may quote the user's source. Also reached when
    // the result cannot be cloned; the plain `crashed` message always can.
    self.postMessage(crashed);
  }
};
