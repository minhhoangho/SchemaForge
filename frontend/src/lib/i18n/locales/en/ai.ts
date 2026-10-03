import { enAiPanel } from "./ai/panel";
import { enAiComposer } from "./ai/composer";
import { enAiQuickActions } from "./ai/quick-actions";
import { enAiStatus } from "./ai/status";
import { enAiProposal } from "./ai/proposal";
import { enAiDiff } from "./ai/diff";
import { enAiFindings } from "./ai/findings";
import { enAiSampleData } from "./ai/sample-data";
import { enAiErrors } from "./ai/errors";

export const enAi = {
  panel: enAiPanel,
  composer: enAiComposer,
  quickActions: enAiQuickActions,
  status: enAiStatus,
  proposal: enAiProposal,
  diff: enAiDiff,
  findings: enAiFindings,
  sampleData: enAiSampleData,
  errors: enAiErrors,
} as const;
