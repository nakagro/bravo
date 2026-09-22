import { describe, expect, it } from "vitest";
import { parseSsoParentOrigin, parseSsoRedirect } from "./ssoRefresh";

describe("parseSsoRedirect", () => {
  it("accepts https URLs on grayhux.io and its subdomains", () => {
    expect(parseSsoRedirect("https://labs.grayhux.io/trucks?x=1")).toBe(
      "https://labs.grayhux.io/trucks?x=1",
    );
    expect(parseSsoRedirect("https://grayhux.io/")).toBe("https://grayhux.io/");
  });

  it("rejects other hosts, look-alikes and plain http", () => {
    expect(parseSsoRedirect("https://evil.com/")).toBeNull();
    expect(parseSsoRedirect("https://grayhux.io.evil.com/")).toBeNull();
    expect(parseSsoRedirect("https://evilgrayhux.io/")).toBeNull();
    expect(parseSsoRedirect("http://labs.grayhux.io/")).toBeNull();
    expect(parseSsoRedirect("not a url")).toBeNull();
    expect(parseSsoRedirect(null)).toBeNull();
  });
});

describe("parseSsoParentOrigin", () => {
  it("accepts a bare trusted origin", () => {
    expect(parseSsoParentOrigin("https://labs.grayhux.io")).toBe(
      "https://labs.grayhux.io",
    );
  });

  it("rejects anything that is not exactly an origin", () => {
    expect(parseSsoParentOrigin("https://labs.grayhux.io/")).toBeNull();
    expect(parseSsoParentOrigin("https://labs.grayhux.io/trucks")).toBeNull();
    expect(parseSsoParentOrigin("https://user@labs.grayhux.io")).toBeNull();
  });

  it("rejects untrusted origins", () => {
    expect(parseSsoParentOrigin("https://evil.com")).toBeNull();
    expect(parseSsoParentOrigin("http://labs.grayhux.io")).toBeNull();
    expect(parseSsoParentOrigin("*")).toBeNull();
    expect(parseSsoParentOrigin(null)).toBeNull();
  });
});
