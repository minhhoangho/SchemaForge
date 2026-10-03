export const enAiErrors = {
  "ai-upstream-busy": "The AI service is busy. Try again in a moment.",
  "ai-upstream-failed": "The AI service could not answer. Try again.",
  "ai-timeout": "The AI service took too long to answer. Try again.",
  "ai-output-invalid":
    "The AI answer was not valid and was discarded. Try again.",
  "internal-error": "Something went wrong. Try again.",
  network: "Could not reach the server. Check your connection.",
  timeout: "The request took too long. Try again.",
  "invalid-response": "The server sent an unexpected response.",
  retry: "Try again",
  rateLimited_one: "Too many requests. Try again in {{count}} second.",
  rateLimited_other: "Too many requests. Try again in {{count}} seconds.",
} as const;
