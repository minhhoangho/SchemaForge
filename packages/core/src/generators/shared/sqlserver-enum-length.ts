// Longest bounded nvarchar(n); anything longer is nvarchar(max).
export const SQLSERVER_MAX_NVARCHAR_LENGTH = 4000;

const MIN_ENUM_LENGTH = 1;

/**
 * nvarchar length for an enum column on SQL Server (Prisma `sqlserver` and
 * SQL Server SQL share it, spec issue 6): the longest value in UTF-16 code
 * units, the unit of nvarchar, at least 1. null means nvarchar(max).
 */
export function sqlServerEnumLength(values: readonly string[]): number | null {
  const length = Math.max(
    MIN_ENUM_LENGTH,
    ...values.map((value) => value.length),
  );
  return length > SQLSERVER_MAX_NVARCHAR_LENGTH ? null : length;
}
