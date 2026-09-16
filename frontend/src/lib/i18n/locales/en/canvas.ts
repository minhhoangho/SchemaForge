export const enCanvas = {
  node: {
    label_one: "Table {{name}}, {{count}} column",
    label_other: "Table {{name}}, {{count}} columns",
    issueCount_one: "{{count}} issue",
    issueCount_other: "{{count}} issues",
    comment: "Comment: {{comment}}",
  },
  column: {
    primaryKey: "Primary key",
    primaryKeyPosition: "Primary key, position {{position}}",
    foreignKey: "Foreign key",
    unique: "Unique",
    nullable: "Nullable",
    autoIncrement: "Auto increment",
    issue_one: "{{count}} issue",
    issue_other: "{{count}} issues",
  },
  edge: {
    label: "{{fromTable}}.{{fromColumn}} → {{toTable}}.{{toColumn}}, {{kind}}",
    kindOneToOne: "one-to-one",
    kindOneToMany: "one-to-many",
    oneToOne: "1-1",
    oneToMany: "1-n",
    columnCount_one: "{{count}} column",
    columnCount_other: "{{count}} columns",
    hasIssues: "has issues",
  },
  empty: {
    title: "This schema has no tables yet",
    addTable: "Add table",
  },
  minimap: {
    label: "Mini map",
  },
  handle: {
    label: "Connection point",
  },
  a11y: {
    nodeDescription:
      "Press Enter or Space to select a table. Then use the arrow keys to move it.",
    nodeKeyboardDisabled:
      "Press Enter or Space to select a table. Moving it with the keyboard is turned off.",
    nodeMoved: "Moved {{direction}} to x {{x}}, y {{y}}",
    edgeDescription: "Press Enter or Space to select a relation.",
    directions: {
      up: "up",
      down: "down",
      left: "left",
      right: "right",
    },
  },
} as const;
