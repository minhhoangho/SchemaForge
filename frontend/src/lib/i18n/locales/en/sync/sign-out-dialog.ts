export const enSyncSignOutDialog = {
  title: "Sign out?",
  description_one:
    "{{count}} schema has changes that are not saved to the cloud. Signing out will remove it from this browser.",
  description_other:
    "{{count}} schemas have changes that are not saved to the cloud. Signing out will remove them from this browser.",
  trySync: "Try to sync",
  signOutAnyway: "Sign out anyway",
  cancel: "Cancel",
  signOutFailed: "Could not sign out, check your connection",
} as const;
