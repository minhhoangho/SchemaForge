export const enEditorLeftPanel = {
  label: "Schema outline",
  collapse: "Collapse the schema outline",
  expand: "Expand the schema outline",
  tabs: {
    tables: "Tables",
    enums: "Enums",
    issues_one: "Issues ({{count}})",
    issues_other: "Issues ({{count}})",
  },
  tables: {
    columnCount_one: "{{count}} column",
    columnCount_other: "{{count}} columns",
    issueCount_one: "{{count}} issue",
    issueCount_other: "{{count}} issues",
    empty: "No tables yet.",
  },
  enums: {
    nameLabel: "Enum name",
    valueLabel: "Value {{position}}",
    addValue: "Add value",
    moveValueUp: "Move value {{position}} ({{value}}) up",
    moveValueDown: "Move value {{position}} ({{value}}) down",
    removeValue: "Remove value {{position}} ({{value}})",
    emptyValue: "empty",
    remove: "Delete enum",
    inUse: "Used by these columns, so it cannot be deleted:",
    empty: "No enums yet.",
  },
  issues: {
    none: "No issues",
    goTo: "Go to:",
  },
} as const;
