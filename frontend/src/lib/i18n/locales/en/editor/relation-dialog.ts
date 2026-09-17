export const enEditorRelationDialog = {
  title: "Create relation",
  description: "The foreign key table points at the referenced table.",
  enterHint: "Press Enter to create the relation.",
  fromTable: "Foreign key table",
  toTable: "Referenced table",
  swap: "Swap tables",
  kindLabel: "Relation type",
  kind: {
    oneToMany: "One to many",
    oneToOne: "One to one",
    manyToMany: "Many to many",
  },
  referencedColumns: "Referenced columns",
  referencedColumnLabel: "Referenced column {{number}}",
  foreignKeyMode: {
    label: "Foreign key",
    newColumns: "Create new columns",
    existingColumns: "Use existing columns",
  },
  columnPairs: {
    title: "Foreign key columns",
    fromLabel: "Foreign key column {{number}}",
    toLabel: "references {{column}}",
    placeholder: "Choose a column",
  },
  junctionTableName: "Junction table name",
  submit: "Create relation",
  errors: {
    primaryKeyMissing:
      "The referenced table has no primary key. Add one, or drop the connection on a column.",
    primaryKeyMissingManyToMany:
      "Both tables need a primary key for a many-to-many relation.",
    unmatchedColumn: "Choose a foreign key column for every referenced column.",
    duplicateColumn: "A column is chosen more than once.",
  },
} as const;
