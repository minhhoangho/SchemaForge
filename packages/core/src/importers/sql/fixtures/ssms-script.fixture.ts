import type { SchemaDocument } from "../../../model/schema-document.js";
import {
  buildSchema,
  makeColumn,
  makeIndex,
  makeRelation,
  makeTable,
} from "../../../testing/factories.js";
import type { ImportDiagnostic } from "../../shared/import-types.js";

// Written in the shape SQL Server Management Studio "Generate Scripts" gives
// for a database with its schema: USE and GO batches, ALTER DATABASE settings,
// bracketed [dbo] names, SET options before each table, constraints with
// WITH (…) ON [PRIMARY] storage options, defaults added through ALTER TABLE …
// DEFAULT … FOR, foreign keys added WITH CHECK and then checked, and
// descriptions through sp_addextendedproperty.

export const SSMS_SCRIPT_SOURCE = `USE [master]
GO
/****** Object:  Database [Shop]    Script Date: 10/5/2026 9:00:00 AM ******/
ALTER DATABASE [Shop] SET COMPATIBILITY_LEVEL = 160
GO
ALTER DATABASE [Shop] SET ANSI_NULL_DEFAULT OFF
GO
ALTER DATABASE [Shop] SET RECOVERY FULL
GO
USE [Shop]
GO
/****** Object:  Table [dbo].[Customers]    Script Date: 10/5/2026 9:00:00 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Customers](
\t[Id] [int] IDENTITY(1,1) NOT NULL,
\t[Email] [nvarchar](255) NOT NULL,
\t[DisplayName] [nvarchar](100) NULL,
\t[CreatedAt] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_Customers] PRIMARY KEY CLUSTERED
(
\t[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_Customers_Email] UNIQUE NONCLUSTERED
(
\t[Email] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Orders]    Script Date: 10/5/2026 9:00:00 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Orders](
\t[Id] [bigint] IDENTITY(1000,1) NOT NULL,
\t[CustomerId] [int] NOT NULL,
\t[Total] [decimal](12, 2) NOT NULL,
\t[Notes] [nvarchar](max) NULL,
 CONSTRAINT [PK_Orders] PRIMARY KEY CLUSTERED
(
\t[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Orders_CustomerId]    Script Date: 10/5/2026 9:00:00 AM ******/
CREATE NONCLUSTERED INDEX [IX_Orders_CustomerId] ON [dbo].[Orders]
(
\t[CustomerId] ASC
)
INCLUDE([Total]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
ALTER TABLE [dbo].[Customers] ADD  CONSTRAINT [DF_Customers_CreatedAt]  DEFAULT (sysdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Orders] ADD  DEFAULT ((0)) FOR [Total]
GO
ALTER TABLE [dbo].[Orders]  WITH CHECK ADD  CONSTRAINT [FK_Orders_Customers] FOREIGN KEY([CustomerId])
REFERENCES [dbo].[Customers] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[Orders] CHECK CONSTRAINT [FK_Orders_Customers]
GO
ALTER TABLE [dbo].[Orders]  WITH CHECK ADD  CONSTRAINT [CK_Orders_Total] CHECK  (([Total]>=(0)))
GO
ALTER TABLE [dbo].[Orders] CHECK CONSTRAINT [CK_Orders_Total]
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Store customers' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'Customers'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Login e-mail, it''s unique' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'Customers', @level2type=N'COLUMN',@level2name=N'Email'
GO
USE [master]
GO
ALTER DATABASE [Shop] SET  READ_WRITE
GO
`;

export const SSMS_SCRIPT_EXPECTED: SchemaDocument = buildSchema({
  name: "Imported",
  tables: [
    makeTable({
      id: "tbl_customers",
      name: "Customers",
      comment: "Store customers",
      primaryKeyColumnIds: ["col_customers_id"],
    }),
    makeTable({
      id: "tbl_orders",
      name: "Orders",
      primaryKeyColumnIds: ["col_orders_id"],
    }),
  ],
  columns: [
    makeColumn({
      id: "col_customers_id",
      tableId: "tbl_customers",
      name: "Id",
      isAutoIncrement: true,
    }),
    makeColumn({
      id: "col_customers_email",
      tableId: "tbl_customers",
      name: "Email",
      type: { kind: "varchar", length: 255 },
      isUnique: true,
      comment: "Login e-mail, it's unique",
    }),
    makeColumn({
      id: "col_customers_name",
      tableId: "tbl_customers",
      name: "DisplayName",
      type: { kind: "varchar", length: 100 },
      isNullable: true,
    }),
    makeColumn({
      id: "col_customers_created",
      tableId: "tbl_customers",
      name: "CreatedAt",
      type: { kind: "timestamp" },
      defaultValue: { kind: "currentTimestamp" },
    }),
    makeColumn({
      id: "col_orders_id",
      tableId: "tbl_orders",
      name: "Id",
      type: { kind: "bigint" },
      isAutoIncrement: true,
    }),
    makeColumn({
      id: "col_orders_customer",
      tableId: "tbl_orders",
      name: "CustomerId",
    }),
    makeColumn({
      id: "col_orders_total",
      tableId: "tbl_orders",
      name: "Total",
      type: { kind: "decimal", precision: 12, scale: 2 },
      defaultValue: { kind: "literal", value: "0" },
    }),
    makeColumn({
      id: "col_orders_notes",
      tableId: "tbl_orders",
      name: "Notes",
      type: { kind: "text" },
      isNullable: true,
    }),
  ],
  indexes: [
    makeIndex({
      id: "idx_orders_customer",
      tableId: "tbl_orders",
      name: "IX_Orders_CustomerId",
      columnIds: ["col_orders_customer"],
    }),
  ],
  relations: [
    makeRelation({
      id: "rel_orders_customers",
      fromTableId: "tbl_orders",
      toTableId: "tbl_customers",
      columnPairs: [
        { fromColumnId: "col_orders_customer", toColumnId: "col_customers_id" },
      ],
      onDelete: "cascade",
    }),
  ],
});

// With createImportTestOptions(): tables first, then columns, then indexes.
// The CHECK is located at the ALTER TABLE that adds it.
export const SSMS_SCRIPT_EXPECTED_DIAGNOSTICS: readonly ImportDiagnostic[] = [
  {
    code: "identity-options-dropped",
    location: { line: 38, column: 2 },
    path: ["columns", "col_7", "isAutoIncrement"],
  },
  {
    code: "index-option-dropped",
    location: { line: 51, column: 1 },
    path: ["indexes", "idx_11"],
  },
  {
    code: "check-constraint-not-supported",
    location: { line: 67, column: 1 },
    path: null,
  },
];
