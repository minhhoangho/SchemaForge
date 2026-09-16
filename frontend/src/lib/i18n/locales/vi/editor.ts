import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enEditor } from "@/lib/i18n/locales/en/editor";

import { viEditorLayout } from "./editor/editor-layout";
import { viEditorLeftPanel } from "./editor/left-panel";
import { viEditorRelationDialog } from "./editor/relation-dialog";
import { viEditorRelationPanel } from "./editor/relation-panel";
import { viEditorScreen } from "./editor/screen";
import { viEditorTablePanel } from "./editor/table-panel";
import { viEditorToolbar } from "./editor/toolbar";

export const viEditor = {
  screen: viEditorScreen,
  toolbar: viEditorToolbar,
  leftPanel: viEditorLeftPanel,
  tablePanel: viEditorTablePanel,
  relationPanel: viEditorRelationPanel,
  relationDialog: viEditorRelationDialog,
  layout: viEditorLayout,
} as const satisfies LocaleNamespace<typeof enEditor>;
