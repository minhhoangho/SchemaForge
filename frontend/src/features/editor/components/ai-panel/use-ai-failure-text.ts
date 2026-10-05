"use client";

import { useTranslation } from "react-i18next";

import { toApiErrorMessageKey } from "@/lib/api/api-failure";

import type { AiChatFailure } from "../../state/create-ai-chat-store";

const TOO_MANY_REQUESTS_STATUS = 429;

export function useAiFailureText(): (failure: AiChatFailure) => string {
  const { t } = useTranslation("ai");
  const { t: tApiErrors } = useTranslation("apiErrors");

  return (failure) => {
    if (failure.kind === "error") {
      return t(`errors.${failure.code}`);
    }
    const { failure: apiFailure } = failure;
    if (
      apiFailure.kind === "http" &&
      apiFailure.status === TOO_MANY_REQUESTS_STATUS &&
      apiFailure.retryAfterSeconds !== null
    ) {
      return t("errors.rateLimited", { count: apiFailure.retryAfterSeconds });
    }
    return tApiErrors(toApiErrorMessageKey(apiFailure));
  };
}
