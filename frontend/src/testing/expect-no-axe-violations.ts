import axe from "axe-core";
import { expect } from "vitest";

// axe tags are not cumulative: a rule carries only the tag of the WCAG version
// that introduced it, so reaching WCAG 2.2 level AA means listing level A and
// AA of 2.0, 2.1 and 2.2. axe-core 4.13.0 has no rule tagged wcag22a, so that
// tag is left out.
const WCAG_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
] as const;

const DISABLED_RULES = {
  // jsdom computes no layout and paints nothing, so neither rule can reach a
  // real answer here. color-contrast reports "incomplete", and target-size
  // passes even a 10x10 px button. Both are checked by hand on Chrome
  // instead (spec section 12).
  "color-contrast": { enabled: false },
  "target-size": { enabled: false },
};

type ReportedViolation = {
  readonly id: string;
  readonly targets: readonly string[];
};

function toReportedViolation(violation: axe.Result): ReportedViolation {
  return {
    id: violation.id,
    targets: violation.nodes.map((node) => node.target.join(" ")),
  };
}

/**
 * Fails the test when `container` has an accessibility violation axe can see
 * on jsdom. Call it on screens, panels and dialogs in both themes.
 *
 * axe-core keeps global state while it runs and refuses to run twice at once,
 * so every call must be awaited before the next one starts.
 */
export async function expectNoAxeViolations(container: Element): Promise<void> {
  const results = await axe.run(container, {
    runOnly: { type: "tag", values: [...WCAG_TAGS] },
    rules: DISABLED_RULES,
  });

  // Comparing the mapped list rather than the count puts the failing rule and
  // the offending selector straight into the failure message.
  expect(results.violations.map(toReportedViolation)).toEqual([]);
}
