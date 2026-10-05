import { describe, expect, it } from "vitest";

import { unwrapOk } from "../../testing/unwrap-result.js";
import {
  readSqlServerDescription,
  type SqlServerDescription,
} from "./sqlserver-extended-property.js";
import { scanSqlStatements } from "./statement-scanner.js";

function read(source: string): readonly (SqlServerDescription | null)[] {
  return unwrapOk(scanSqlStatements(source, "sqlserver")).map(
    readSqlServerDescription,
  );
}

describe("readSqlServerDescription", () => {
  it("reads a table description", () => {
    expect(
      read(`GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Customer orders' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'orders'
GO`),
    ).toStrictEqual([
      {
        tableName: "orders",
        columnName: null,
        description: "Customer orders",
        start: 3,
      },
    ]);
  });

  it("reads a column description", () => {
    expect(
      read(
        "EXECUTE [sys].[sp_addextendedproperty] @name = N'MS_Description', @value = N'It''s the total', @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'Table', @level1name = N'orders', @level2type = N'Column', @level2name = N'total'",
      ),
    ).toStrictEqual([
      {
        tableName: "orders",
        columnName: "total",
        description: "It's the total",
        start: 0,
      },
    ]);
  });

  it("reads positional arguments", () => {
    expect(
      read(
        "exec sp_addextendedproperty 'MS_Description', 'Total', 'SCHEMA', 'dbo', 'TABLE', 'orders', 'COLUMN', 'total'",
      ),
    ).toStrictEqual([
      {
        tableName: "orders",
        columnName: "total",
        description: "Total",
        start: 0,
      },
    ]);
  });

  it("reads positional arguments followed by named ones", () => {
    expect(
      read(
        "EXEC sp_addextendedproperty N'MS_Description', N'Orders', @level1type = N'TABLE', @level1name = N'orders', @level2type = NULL",
      ),
    ).toStrictEqual([
      {
        tableName: "orders",
        columnName: null,
        description: "Orders",
        start: 0,
      },
    ]);
  });

  it.each([
    "EXEC sp_addextendedproperty @name = N'Caption', @value = N'x', @level1type = N'TABLE', @level1name = N't'",
    "EXEC sp_addextendedproperty @name = N'ms_description', @value = N'x', @level1type = N'TABLE', @level1name = N't'",
  ])("ignores a property other than MS_Description: %s", (source) => {
    expect(read(source)).toStrictEqual([null]);
  });

  it.each([
    "EXEC sp_addextendedproperty @name = N'MS_Description', @value = 1, @level1type = N'TABLE', @level1name = N't'",
    "EXEC sp_addextendedproperty @name = N'MS_Description', @value = @text, @level1type = N'TABLE', @level1name = N't'",
    "EXEC sp_addextendedproperty @name = N'MS_Description', @level1type = N'TABLE', @level1name = N't'",
  ])("returns null when the value is not a string: %s", (source) => {
    expect(read(source)).toStrictEqual([null]);
  });

  it.each([
    "EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'x', @level1type = N'VIEW', @level1name = N'v'",
    "EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'x', @level1type = N'TABLE', @level1name = N't', @level2type = N'INDEX', @level2name = N'i'",
    "EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'x', @level1type = N'TABLE', @level1name = N't', @level2type = N'COLUMN'",
    "EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'x', @level1type = N'TABLE'",
    "EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'x', @level0type = N'SCHEMA', @level0name = N'dbo'",
    "EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'x', @level1type = N'TABLE', @level1name = N't', @unknown = N'y'",
    "EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'x' + N'y', @level1type = N'TABLE', @level1name = N't'",
    "EXEC sp_addextendedproperty N'MS_Description', N'x', N'SCHEMA', N'dbo', N'TABLE', N't', N'COLUMN', N'c', N'extra'",
    "EXEC dbo.other_procedure N'MS_Description', N'x'",
    "SELECT 1",
  ])("returns null for another statement or target: %s", (source) => {
    expect(read(source)).toStrictEqual([null]);
  });
});
