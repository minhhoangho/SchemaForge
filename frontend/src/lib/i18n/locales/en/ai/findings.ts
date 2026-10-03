export const enAiFindings = {
  title: "Review results",
  kinds: {
    suggestion: "Suggestion",
    issue: "Issue",
  },
  categories: {
    index: "Index",
    normalization: "Normalization",
    naming: "Naming",
    relation: "Relation",
    type: "Type",
    other: "Other",
  },
  apply: "Apply",
  fixForMe: "Fix it for me",
  applyMessage: "Please apply this suggestion: {{title}}. {{detail}}",
  fixMessage: "Please fix this issue: {{title}}. {{detail}}",
  targetUnavailable: "This part of the schema no longer exists.",
} as const;
