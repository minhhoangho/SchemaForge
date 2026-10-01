import { describe, expect, it } from "vitest";

import { RawValue, rawValueProperties } from "./raw-value.decorator.js";

class BaseDto {
  @RawValue()
  readonly document!: unknown;
}

class ChildDto extends BaseDto {
  readonly revision!: number;
}

class PlainDto {
  readonly name!: string;
}

describe("rawValueProperties", () => {
  it("lists a marked property", () => {
    expect(rawValueProperties(BaseDto)).toEqual(["document"]);
  });

  it("lists a property marked on a base class", () => {
    expect(rawValueProperties(ChildDto)).toEqual(["document"]);
  });

  it("lists nothing for a class without a marked property", () => {
    expect(rawValueProperties(PlainDto)).toEqual([]);
  });

  it("lists nothing when there is no metatype", () => {
    expect(rawValueProperties(undefined)).toEqual([]);
  });

  it("ignores a symbol property, which no request body can carry", () => {
    RawValue()(PlainDto.prototype, Symbol("document"));

    expect(rawValueProperties(PlainDto)).toEqual([]);
  });
});
