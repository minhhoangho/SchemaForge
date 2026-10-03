import type { AiToolName } from "@schemaforge/core/ai";

// Prompt content: sent to Gemini next to each tool's input schema. Kept apart
// from `ai-tools.ts` so wording can be tuned (plan Task 29) without touching
// tool logic.
export const AI_TOOL_DESCRIPTIONS = {
  renameSchema: "Rename the schema.",
  createTable:
    "Create a table with its columns and primary key. The table is placed on the canvas for you.",
  updateTable: "Rename a table or change its comment.",
  removeTable:
    "Remove a table together with its columns, indexes and relations.",
  addColumn:
    "Add a column to a table, after the column named in after, or at the end.",
  updateColumn: "Change only the given fields of a column.",
  removeColumn: "Remove a column from a table.",
  setPrimaryKey: "Set the primary key columns of a table, in order.",
  addRelation:
    "Link two tables. Without fromColumns the foreign key columns are created for you. For manyToMany a junction table is created, and fromColumns, toColumns, onDelete and onUpdate are ignored.",
  updateRelation:
    "Change the kind or the referential actions of the relation between two tables. Pass fromColumns when several relations join them.",
  removeRelation:
    "Remove the relation between two tables. Pass fromColumns when several relations join them.",
  addIndex:
    "Add an index or a unique index on columns of a table. Without a name one is suggested.",
  removeIndex: "Remove an index from a table.",
  createEnum: "Create an enum type with its values.",
  updateEnum: "Rename an enum or replace its values.",
  removeEnum: "Remove an enum that no column uses.",
  reportFindings:
    "Report suggestions or design issues of the current schema, with the tables and columns involved. Never changes the schema.",
  proposeSampleData:
    "Propose sample rows for tables of the current schema, every value as a string or null. Never changes the schema.",
} as const satisfies Record<AiToolName, string>;
