export const enEditorScreen = {
  pageTitle: "Schema editor – {{appName}}",
  notFound: {
    title: "Schema not found",
    description:
      "This schema does not exist in this browser. It may have been deleted.",
  },
  locked: {
    title: "This schema is open in another tab",
    description:
      "It opens here automatically once the other tab closes it or leaves it.",
  },
  unsupportedVersion: {
    title: "This schema needs a newer version of SchemaForge",
    description:
      "The schema was saved by a newer version of SchemaForge. Reload the page.",
  },
  unreadable: {
    title: "The schema data is damaged",
    description:
      "The saved schema could not be read. It was left untouched in storage.",
  },
  storageUnavailable: {
    title: "Storage is unavailable",
    readFailed:
      "The schema could not be read from browser storage. Reload the page.",
  },
  crashTitle: "Something went wrong",
  crashDescription:
    "The editor stopped unexpectedly. Your last saved changes are kept. Reload to continue.",
  backToList: "Back to your schemas",
  loading: "Opening the schema…",
} as const;
