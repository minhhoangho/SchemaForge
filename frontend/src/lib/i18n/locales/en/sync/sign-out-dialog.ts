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
  syncStoppedExpired: "Your session expired. Sign in again to sync.",
  syncStoppedConflict_one:
    "{{count}} schema conflicts with the cloud. Open it to resolve.",
  syncStoppedConflict_other:
    "{{count}} schemas conflict with the cloud. Open them to resolve.",
  signingOut: "Signing out…",
  signOutFailed: "Could not sign out, check your connection",
  cacheCleanupFailed:
    "Signed out, but some data could not be removed from this browser",
} as const;
