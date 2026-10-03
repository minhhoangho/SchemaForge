import "@/lib/zod-config";

import { loadGenerator } from "./generator-registry";
import { highlightCode, toHighlightLanguage } from "./highlight-code";
import {
  isGenerateCodeRequest,
  type GenerateCodeResponse,
} from "./worker-protocol";

self.onmessage = async (event: MessageEvent<unknown>): Promise<void> => {
  const request = event.data;
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
