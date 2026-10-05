// The only file that creates object URLs (lint enforces it); see
// document/specs/2026-09-15-import-export-design.md, section 9.

// Safari starts the download asynchronously, so the URL must outlive the click.
export const OBJECT_URL_REVOKE_DELAY_MS = 10_000;

export type DownloadEnvironment = {
  readonly document: Document;
  readonly url: Pick<typeof URL, "createObjectURL" | "revokeObjectURL">;
  readonly schedule: (callback: () => void, delayMs: number) => void;
};

function browserEnvironment(): DownloadEnvironment {
  return {
    document,
    url: URL,
    schedule: (callback, delayMs) => {
      setTimeout(callback, delayMs);
    },
  };
}

export function downloadBlob(
  blob: Blob,
  fileName: string,
  environment: DownloadEnvironment = browserEnvironment(),
): void {
  const objectUrl = environment.url.createObjectURL(blob);
  const link = environment.document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  link.rel = "noopener";
  link.hidden = true;
  environment.document.body.append(link);
  link.click();
  link.remove();
  environment.schedule(() => {
    environment.url.revokeObjectURL(objectUrl);
  }, OBJECT_URL_REVOKE_DELAY_MS);
}
