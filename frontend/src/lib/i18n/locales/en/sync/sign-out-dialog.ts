export const enSyncSignOutDialog = {
  title: "Sign out?",
  description_one:
    "{{count}} schema has changes that are not saved to the cloud. Signing out will remove it from this browser.",
  description_other:
    "{{count}} schemas have changes that are not saved to the cloud. Signing out will remove them from this browser.",
  allSynced: "Every change is saved to the cloud.",
  trySync: "Try to sync",
  signOutAnyway: "Sign out anyway",
  signOut: "Sign out",
  cancel: "Cancel",
  syncing: "Syncing…",
  signingOut: "Signing out…",
  signOutFailed: "Could not sign out, check your connection",
  cacheCleanupFailed:
    "Signed out, but some data could not be removed from this browser",
} as const;
