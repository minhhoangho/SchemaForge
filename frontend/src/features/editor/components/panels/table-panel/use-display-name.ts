import { useTranslation } from "react-i18next";

/**
 * Returns the name to show for a column or index in labels and legends. A name
 * can be empty while the user edits it, and an empty one would leave labels
 * such as "Move column  up" and groups without a name.
 */
export function useDisplayName(): (name: string) => string {
  const { t } = useTranslation("editor");
  return (name) => (name === "" ? t("tablePanel.unnamed") : name);
}
