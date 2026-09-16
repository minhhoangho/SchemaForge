import { enEditorLayout } from "./editor/editor-layout";
import { enEditorLeftPanel } from "./editor/left-panel";
import { enEditorRelationDialog } from "./editor/relation-dialog";
import { enEditorRelationPanel } from "./editor/relation-panel";
import { enEditorScreen } from "./editor/screen";
import { enEditorTablePanel } from "./editor/table-panel";
import { enEditorToolbar } from "./editor/toolbar";

export const enEditor = {
  screen: enEditorScreen,
  toolbar: enEditorToolbar,
  leftPanel: enEditorLeftPanel,
  tablePanel: enEditorTablePanel,
  relationPanel: enEditorRelationPanel,
  relationDialog: enEditorRelationDialog,
  layout: enEditorLayout,
} as const;
