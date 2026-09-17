import { describe, expect, it } from "vitest";

import { DEFAULT_API_URL, readEnvironment } from "./env";

const HTTPS_API_URL = "https://api.schemaforge.invalid";

describe("readEnvironment", () => {
  it.each<[string, boolean, boolean]>([
    ["development", true, false],
    ["production", false, true],
    ["test", false, false],
  ])(
    "reads %s as the node environment",
    (nodeEnvironment, isDevelopment, isProduction) => {
      expect(
        readEnvironment({
          NODE_ENV: nodeEnvironment,
          NEXT_PUBLIC_API_URL: HTTPS_API_URL,
        }),
      ).toStrictEqual({
        nodeEnvironment,
        isDevelopment,
        isProduction,
        apiOrigin: new URL(HTTPS_API_URL).origin,
      });
    },
  );

  it.each(["staging", undefined])(
    "throws for an unsupported NODE_ENV",
    (nodeEnvironment) => {
      expect(() =>
        readEnvironment({
          NODE_ENV: nodeEnvironment,
          NEXT_PUBLIC_API_URL: HTTPS_API_URL,
        }),
      ).toThrow(Error);
    },
  );

  it.each<[string, string | undefined]>([
    ["development", undefined],
    ["development", ""],
    ["test", undefined],
    ["test", ""],
    ["production", undefined],
    ["production", ""],
  ])(
    "defaults the api origin to localhost in %s when the variable is %s",
    (nodeEnvironment, apiUrl) => {
      expect(
        readEnvironment({
          NODE_ENV: nodeEnvironment,
          NEXT_PUBLIC_API_URL: apiUrl,
        }).apiOrigin,
      ).toBe(new URL(DEFAULT_API_URL).origin);
    },
  );

  it("reads the origin of an https api url", () => {
    expect(
      readEnvironment({
        NODE_ENV: "production",
        NEXT_PUBLIC_API_URL: "https://api.example.com",
      }).apiOrigin,
    ).toBe("https://api.example.com");
  });

  it("accepts an http api url in development", () => {
    expect(
      readEnvironment({
        NODE_ENV: "development",
        NEXT_PUBLIC_API_URL: "http://api.example.com",
      }).apiOrigin,
    ).toBe("http://api.example.com");
  });

  it.each(["localhost", "127.0.0.1", "[::1]"])(
    "accepts an http loopback api url in production for host %s",
    (hostname) => {
      expect(
        readEnvironment({
          NODE_ENV: "production",
          NEXT_PUBLIC_API_URL: `http://${hostname}:3001`,
        }).apiOrigin,
      ).toBe(new URL(`http://${hostname}:3001`).origin);
    },
  );

  it("rejects an http api url on another host in production", () => {
    expect(() =>
      readEnvironment({
        NODE_ENV: "production",
        NEXT_PUBLIC_API_URL: "http://api.example.com",
      }),
    ).toThrow(/NEXT_PUBLIC_API_URL/);
  });

  it("rejects an api url with a path", () => {
    expect(() =>
      readEnvironment({
        NODE_ENV: "development",
        NEXT_PUBLIC_API_URL: "https://api.example.com/v1",
      }),
    ).toThrow(/NEXT_PUBLIC_API_URL/);
  });

  it.each(["https://api.example.com/?x=1", "https://api.example.com/#frag"])(
    "rejects an api url with a query or a hash",
    (apiUrl) => {
      expect(() =>
        readEnvironment({
          NODE_ENV: "development",
          NEXT_PUBLIC_API_URL: apiUrl,
        }),
      ).toThrow(/NEXT_PUBLIC_API_URL/);
    },
  );

  it("rejects an api url with credentials", () => {
    expect(() =>
      readEnvironment({
        NODE_ENV: "development",
        NEXT_PUBLIC_API_URL: "https://user:pass@api.example.com",
      }),
    ).toThrow(/NEXT_PUBLIC_API_URL/);
  });

  it("rejects a protocol other than http or https", () => {
    expect(() =>
      readEnvironment({
        NODE_ENV: "development",
        NEXT_PUBLIC_API_URL: "ftp://api.example.com",
      }),
    ).toThrow(/NEXT_PUBLIC_API_URL/);
  });

  it("rejects a value that is not a url", () => {
    expect(() =>
      readEnvironment({
        NODE_ENV: "development",
        NEXT_PUBLIC_API_URL: "not a url",
      }),
    ).toThrow(/NEXT_PUBLIC_API_URL/);
  });
});
