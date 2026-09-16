import type { ParseKeys } from "i18next";
import { toast } from "sonner";

import type { NAMESPACES } from "@/lib/i18n/resources";

/**
 * Every key i18next can resolve across the app namespaces, in the
 * namespace-prefixed form (`"storage:unknown"`, `"common:actions.retry"`).
 * Toasts take only these keys, so a toast can never carry a hardcoded string.
 *
 * The namespace tuple, not `Namespace[]`, is what `ParseKeys` needs: i18next
 * derives the unprefixed keys from `Ns[0]`, so an array of the namespace union
 * would also admit unprefixed keys of every namespace, which only the default
 * namespace can resolve at run time.
 */
export type TranslationKey = ParseKeys<typeof NAMESPACES>;

export type NotifyTone = "success" | "error" | "info";

export type NotifyInput = {
  readonly tone: NotifyTone;
  readonly titleKey: TranslationKey;
  readonly descriptionKey?: TranslationKey;
  readonly values?: Readonly<Record<string, string | number>>;
  readonly action?: {
    readonly labelKey: TranslationKey;
    readonly onSelect: () => void;
  };
};

export type Notify = (input: NotifyInput) => void;

export type Translate = (
  key: TranslationKey,
  values?: Readonly<Record<string, string | number>>,
) => string;

export type ToastPort = Pick<typeof toast, NotifyTone>;

export function createNotify(
  translate: Translate,
  toastPort: ToastPort = toast,
): Notify {
  return ({ tone, titleKey, descriptionKey, values, action }) => {
    toastPort[tone](translate(titleKey, values), {
      ...(descriptionKey === undefined
        ? {}
        : { description: translate(descriptionKey, values) }),
      ...(action === undefined
        ? {}
        : {
            action: {
              label: translate(action.labelKey, values),
              onClick: action.onSelect,
            },
          }),
    });
  };
}
