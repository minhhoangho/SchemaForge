export const enCommon = {
  actions: {
    cancel: "Cancel",
    close: "Close",
    confirm: "Confirm",
    create: "Create",
    delete: "Delete",
    open: "Open",
    rename: "Rename",
    retry: "Retry",
    undo: "Undo",
    reload: "Reload",
  },
  theme: {
    label: "Theme",
    system: "System",
    light: "Light",
    dark: "Dark",
  },
  language: {
    label: "Language",
    shortName: "EN",
    vi: "Tiếng Việt",
    en: "English",
  },
  saveStatus: {
    saving: "Saving…",
    saved: "Saved",
    failed: "Not saved",
  },
  notifications: {
    label: "Notifications",
  },
  meta: {
    title: "{{appName}} – Database schema designer",
    description:
      "Design database schemas on a canvas and keep them in your browser.",
  },
  notFound: {
    title: "Page not found",
    description: "The page you are looking for does not exist or was moved.",
    backToList: "Back to your schemas",
  },
} as const;
