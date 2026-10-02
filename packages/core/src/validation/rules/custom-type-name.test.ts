import { describe, expect, it } from "vitest";

import { isSafeCustomTypeName } from "./custom-type-name.js";

const CLAUSE_KEYWORDS = [
  "CHECK",
  "REFERENCES",
  "DEFAULT",
  "CONSTRAINT",
  "PRIMARY",
  "FOREIGN",
  "UNIQUE",
  "KEY",
  "NOT",
  "NULL",
  "COLLATE",
  "GENERATED",
  "AS",
  "ON",
  "AUTO_INCREMENT",
  "IDENTITY",
  "COMMENT",
];

describe("isSafeCustomTypeName", () => {
  it.each([
    "inet",
    "YEAR",
    "_type",
    "int4",
    "double precision",
    "character varying",
    "timestamp with time zone",
    "varchar(50)",
    "numeric(10,2)",
    "numeric(10, 2)",
    "numeric(10 ,2)",
    "numeric(10 , 2)",
    "numeric (10, 2)",
    "geometry(Point, 4326)",
    "geometry(Point)",
    "character varying(255)",
    "text[]",
    "int[][]",
    "varchar(50)[]",
    "numeric (10, 2)[][]",
  ])(
    "accepts a type name with an optional argument list and array suffixes: %s",
    (name) => {
      expect(isSafeCustomTypeName(name)).toBe(true);
    },
  );

  it.each([
    "text, extra_col int",
    "int CHECK (x)",
    "int REFERENCES other(id)",
    "int DEFAULT (fn())",
    "int NOT NULL",
    "int PRIMARY KEY",
    "int GENERATED ALWAYS AS (1)",
    "int COLLATE C",
    "int IDENTITY(1, 1)",
    "geometry(NULL)",
  ])("rejects a type name that injects a column clause: %s", (name) => {
    expect(isSafeCustomTypeName(name)).toBe(false);
  });

  it.each(CLAUSE_KEYWORDS)(
    "rejects a type name containing the clause keyword %s",
    (keyword) => {
      expect(isSafeCustomTypeName(`int ${keyword}`)).toBe(false);
    },
  );

  it.each(CLAUSE_KEYWORDS.map((keyword) => keyword.toLowerCase()))(
    "rejects a type name containing the lowercase clause keyword %s",
    (keyword) => {
      expect(isSafeCustomTypeName(`int ${keyword}`)).toBe(false);
    },
  );

  it("rejects a type name containing mixed-case clause keywords", () => {
    expect(isSafeCustomTypeName("int NoT nUlL")).toBe(false);
  });

  it.each([
    ["a trailing newline", "int\n"],
    ["an embedded newline", "int\nCHECK"],
    ["a NUL character", "int\u0000"],
    ["a Cyrillic look-alike letter", "vаrchar"],
    ["a fullwidth parenthesis", "varchar（50)"],
    ["a Kelvin sign in KEY", "int KEY"],
  ])("rejects a type name containing %s", (_label, name) => {
    expect(isSafeCustomTypeName(name)).toBe(false);
  });

  it.each(["inetx", "not_null", "keys", "asset", "online", "defaults"])(
    "accepts a word that only contains a clause keyword: %s",
    (name) => {
      expect(isSafeCustomTypeName(name)).toBe(true);
    },
  );

  it.each([
    "geometry((Point))",
    "a(1)(2)",
    "numeric(10, 2) x",
    "a()",
    "a(1,)",
    "a(,1)",
    "a(-1)",
    "a(1.5)",
    "a(1",
    "a 1)",
    "numeric( 10)",
    "numeric(10 )",
    "numeric(10,  2)",
    "numeric  (10)",
    "text[](1)",
    "text []",
    "text[3]",
    "text[",
    "double  precision",
    " inet",
    "inet ",
    "",
  ])("rejects a malformed type name: %s", (name) => {
    expect(isSafeCustomTypeName(name)).toBe(false);
  });

  it.each(["my'type", "int; drop", "my-type", "my/type", "int -- x", "a/*b*/"])(
    "rejects a name with a quote, semicolon, hyphen or slash: %s",
    (name) => {
      expect(isSafeCustomTypeName(name)).toBe(false);
    },
  );

  it("rejects a name starting with a digit", () => {
    expect(isSafeCustomTypeName("2type")).toBe(false);
  });

  it("rejects a 64-byte name", () => {
    expect(isSafeCustomTypeName("a".repeat(64))).toBe(false);
  });

  it("accepts a 63-byte name", () => {
    expect(isSafeCustomTypeName("a".repeat(63))).toBe(true);
  });
});
