const MAX_BASE_NAME_LENGTH = 60;

// ASCII only, so the name is valid on every OS and inside a ZIP (spec section 9).
export function toDownloadBaseName(schemaName: string): string {
  const base = schemaName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_BASE_NAME_LENGTH)
    .replace(/-+$/, "");
  return base === "" ? "schema" : base;
}
