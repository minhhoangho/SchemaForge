import "@/lib/zod-config";

import { loadGenerator } from "./generator-registry";
import { handleZipRequest } from "./handle-zip-request";
import { highlightCode, toHighlightLanguage } from "./highlight-code";
import {
  isBuildZipRequest,
  isGenerateCodeRequest,
  type BuildZipRequest,
  type BuildZipResponse,
  type GenerateCodeResponse,
} from "./worker-protocol";

async function answerZip(request: BuildZipRequest): Promise<void> {
  let response: BuildZipResponse;
  try {
    response = await handleZipRequest(request, { loadGenerator });
  } catch {
    // Not logged: the error may quote the user's document.
    response = { requestId: request.requestId, kind: "zip-failed" };
  }
  self.postMessage(
    response,
    response.kind === "zip" ? { transfer: [response.bytes.buffer] } : undefined,
  );
}

self.onmessage = async (event: MessageEvent<unknown>): Promise<void> => {
  const request = event.data;
  if (isBuildZipRequest(request)) {
    await answerZip(request);
    return;
  }
  if (!isGenerateCodeRequest(request)) return;
  const { requestId } = request;
  let response: GenerateCodeResponse;
  try {
    const generate = await loadGenerator(request.target);
    const { file, diagnostics } = generate(request.document, request.options);
    const language = toHighlightLanguage(file.language);
    const tokens =
      language === null ? null : await highlightCode(file.content, language);
    response = { requestId, kind: "ok", file, diagnostics, tokens };
  } catch {
    // Not logged: the error may quote the user's document.
    response = { requestId, kind: "failed" };
  }
  self.postMessage(response);
};
