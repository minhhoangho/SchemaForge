"use client";

import { AI_MAX_USER_MESSAGE_LENGTH } from "@schemaforge/api-contract";
import type { JSX, KeyboardEvent, Ref } from "react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type AiComposerProps = {
  readonly isSending: boolean;
  readonly onSend: (text: string) => void;
  readonly onStop: () => void;
  // The panel focuses the field when it opens.
  readonly inputRef?: Ref<HTMLTextAreaElement>;
};

const IME_PROCESS_KEY_CODE = 229;

export function AiComposer({
  isSending,
  onSend,
  onStop,
  inputRef,
}: AiComposerProps): JSX.Element {
  const { t } = useTranslation("ai");
  const [text, setText] = useState("");
  const inputId = useId();
  const counterId = useId();
  const canSend = text.trim() !== "";

  function send(): void {
    if (!canSend) {
      return;
    }
    onSend(text);
    setText("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    // Enter confirms an IME candidate while composing (Vietnamese input).
    // Safari fires compositionend before this keydown, so isComposing is
    // already false there; only the legacy keyCode 229 still marks it.
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- keyCode 229 is the only IME signal left after Safari's early compositionend
    const isImeKey = event.nativeEvent.keyCode === IME_PROCESS_KEY_CODE;
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing ||
      isImeKey
    ) {
      return;
    }
    event.preventDefault();
    if (!isSending) {
      send();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="sr-only">
        {t("composer.label")}
      </label>
      <Textarea
        id={inputId}
        ref={inputRef}
        value={text}
        readOnly={isSending}
        maxLength={AI_MAX_USER_MESSAGE_LENGTH}
        placeholder={t("composer.placeholder")}
        aria-describedby={counterId}
        onChange={(event) => {
          setText(event.target.value);
        }}
        onKeyDown={handleKeyDown}
      />
      <div className="flex items-center justify-between gap-2">
        <span id={counterId} className="text-xs text-muted-foreground">
          {t("composer.counter", {
            count: text.length,
            max: AI_MAX_USER_MESSAGE_LENGTH,
          })}
        </span>
        {isSending ? (
          <Button variant="outline" onClick={onStop}>
            {t("composer.stop")}
          </Button>
        ) : (
          <Button disabled={!canSend} onClick={send}>
            {t("composer.send")}
          </Button>
        )}
      </div>
    </div>
  );
}
