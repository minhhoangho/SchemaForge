export const enSchemaList = {
  pageTitle: "Your schemas – {{appName}}",
  title: "Your schemas",
  loading: "Loading your schemas…",
  create: {
    trigger: "Create schema",
    dialogTitle: "Create a schema",
    description: "Give the new schema a name. You can change it later.",
    nameLabel: "Name",
    submit: "Create",
  },
  rename: {
    dialogTitle: "Rename schema",
    description: "Enter a new name for “{{name}}”.",
    nameLabel: "Name",
    submit: "Rename",
  },
  delete: {
    title: "Delete “{{name}}”?",
    unreadableTitle: "Delete this unreadable schema?",
    description:
      "The schema is removed from this browser for good. You cannot undo this.",
    confirm: "Delete",
  },
  empty: {
    title: "No schemas yet",
    createFirst: "Create your first schema",
  },
  row: {
    actions: "Actions for {{name}}",
    open: "Open",
    rename: "Rename",
    delete: "Delete",
    unreadable: "Unreadable schema",
    updatedAt: "Updated {{time}}",
  },
  nameRequired: "Enter a name.",
  openInAnotherTab: "This schema is open in another tab.",
  unreadableCannotRename:
    "This schema cannot be read, so it cannot be renamed.",
} as const;
