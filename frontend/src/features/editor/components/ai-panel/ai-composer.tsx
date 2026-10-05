"use client";

import { AI_MAX_USER_MESSAGE_LENGTH } from "@schemaforge/api-contract";
import type { JSX, KeyboardEvent, Ref } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type AiComposerProps = {
  // The unsent text lives in the chat store, so it outlives the window.
  // Sending clears it there.
  readonly draft: string;
  readonly onDraftChange: (text: string) => void;
  readonly isSending: boolean;
  readonly onSend: (text: string) => void;
  readonly onStop: () => void;
  // The panel focuses the field when it opens.
  readonly inputRef?: Ref<HTMLTextAreaElement>;
};

const IME_PROCESS_KEY_CODE = 229;

export function AiComposer({
  draft: text,
  onDraftChange,
  isSending,
  onSend,
  onStop,
  inputRef,
}: AiComposerProps): JSX.Element {
  const { t } = useTranslation("ai");
  const inputId = useId();
  const counterId = useId();
  const canSend = text.trim() !== "";

  function send(): void {
    if (canSend) {
      onSend(text);
    }
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
    <div className="flex flex-col gap-1 rounded-xl border border-input bg-card p-2 pl-3 shadow-sm transition-[color,background-color,border-color,box-shadow] duration-150 has-[textarea:focus-visible]:border-ring has-[textarea:focus-visible]:ring-1 has-[textarea:focus-visible]:ring-ring dark:bg-input/30">
      <label htmlFor={inputId} className="sr-only">
        {t("composer.label")}
      </label>
      <Textarea
        id={inputId}
        ref={inputRef}
        rows={1}
        // The box carries the border and the focus ring.
        className="max-h-[120px] min-h-6 resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
        value={text}
        readOnly={isSending}
        maxLength={AI_MAX_USER_MESSAGE_LENGTH}
        placeholder={t("composer.placeholder")}
        aria-describedby={counterId}
        onChange={(event) => {
          onDraftChange(event.target.value);
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
