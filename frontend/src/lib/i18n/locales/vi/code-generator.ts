import type { MarkdownLabels } from "@schemaforge/core";

import type { LocaleNamespace } from "@/lib/i18n/locale-namespace";
import type { enCodeGenerator } from "@/lib/i18n/locales/en/code-generator";

export const viCodeGenerator = {
  toggle: "Code",
  panelLabel: "Trình tạo code",
  targetLabel: "Đầu ra",
  targets: {
    sql: "SQL DDL",
    prisma: "Prisma",
    drizzle: "Drizzle",
    typescript: "TypeScript",
    zod: "Zod",
    "mock-api": "Mock API",
    openapi: "OpenAPI",
    seed: "Dữ liệu mẫu",
    dbml: "DBML",
    markdown: "Markdown",
  },
  options: {
    sqlDialect: "Dialect",
    prismaProvider: "Provider",
    drizzleDialect: "Dialect",
    seedFormat: "Định dạng",
    seedRowsPerTable: "Số dòng mỗi bảng",
    seedSeed: "Seed",
  },
  dialects: {
    postgresql: "PostgreSQL",
    mysql: "MySQL",
    sqlserver: "SQL Server",
    json: "JSON",
  },
  drizzleSqlServerNote: "Drizzle chưa hỗ trợ SQL Server.",
  copy: "Sao chép",
  copied: "Đã sao chép code",
  copyFailed: "Không sao chép được code",
  codeArea: "Code {{target}}",
  loading: "Đang tạo code…",
  failed: "Không tạo được code. Đổi đầu ra hoặc một tùy chọn để thử lại.",
  // Vietnamese has one plural form, so i18next only reads `_other`; `_one`
  // keeps the key set equal to the English one.
  issueWarning_one:
    "Schema có {{count}} vấn đề, nên code được tạo có thể thiếu hoặc không hợp lệ.",
  issueWarning_other:
    "Schema có {{count}} vấn đề, nên code được tạo có thể thiếu hoặc không hợp lệ.",
  openIssues: "Xem vấn đề",
  diagnostics: {
    heading_one: "{{count}} lưu ý về đầu ra này",
    heading_other: "{{count}} lưu ý về đầu ra này",
    goTo: "Tới",
  },
  markdownLabels: {
    enumsHeading: "Enum",
    tablesHeading: "Bảng",
    indexesHeading: "Index",
    relationsHeading: "Quan hệ",
    columnNameHeader: "Tên",
    columnTypeHeader: "Kiểu",
    columnNullableHeader: "Cho phép null",
    columnDefaultHeader: "Mặc định",
    columnConstraintsHeader: "Ràng buộc",
    columnCommentHeader: "Ghi chú",
    indexNameHeader: "Tên",
    indexColumnsHeader: "Cột",
    indexUniqueHeader: "Duy nhất",
    yes: "Có",
    no: "Không",
    primaryKey: "Khóa chính",
    unique: "Duy nhất",
    autoIncrement: "Tự tăng",
    foreignKey: "Khóa ngoại",
    oneToOne: "Một-một",
    oneToMany: "Một-nhiều",
    outgoingRelations: "Quan hệ đi",
    incomingRelations: "Quan hệ đến",
  },
} as const satisfies LocaleNamespace<typeof enCodeGenerator> & {
  readonly markdownLabels: MarkdownLabels;
};
