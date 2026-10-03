import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enAi } from "@/lib/i18n/locales/en/ai";

import { viAiPanel } from "./ai/panel";
import { viAiComposer } from "./ai/composer";
import { viAiQuickActions } from "./ai/quick-actions";
import { viAiStatus } from "./ai/status";
import { viAiProposal } from "./ai/proposal";
import { viAiDiff } from "./ai/diff";
import { viAiFindings } from "./ai/findings";
import { viAiSampleData } from "./ai/sample-data";
import { viAiErrors } from "./ai/errors";

export const viAi = {
  panel: viAiPanel,
  composer: viAiComposer,
  quickActions: viAiQuickActions,
  status: viAiStatus,
  proposal: viAiProposal,
  diff: viAiDiff,
  findings: viAiFindings,
  sampleData: viAiSampleData,
  errors: viAiErrors,
} as const satisfies LocaleNamespace<typeof enAi>;
