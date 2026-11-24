import { describe, expect, it } from "vitest";
import { parseSsoParentOrigin, parseSsoRedirect } from "./ssoRefresh";

const DOMAIN = "example.org";

describe("parseSsoRedirect", () => {
  it("accepts https URLs on the configured domain and its subdomains", () => {
    expect(parseSsoRedirect("https://apps.example.org/trucks?x=1", DOMAIN)).toBe(
      "https://apps.example.org/trucks?x=1",
    );
    expect(parseSsoRedirect("https://example.org/", DOMAIN)).toBe("https://example.org/");
  });

  it("rejects other hosts, look-alikes, plain http, and unconfigured domain", () => {
    expect(parseSsoRedirect("https://evil.com/", DOMAIN)).toBeNull();
    expect(parseSsoRedirect("https://example.org.evil.com/", DOMAIN)).toBeNull();
    expect(parseSsoRedirect("https://evilexample.org/", DOMAIN)).toBeNull();
    expect(parseSsoRedirect("http://apps.example.org/", DOMAIN)).toBeNull();
    expect(parseSsoRedirect("https://apps.example.org/", "")).toBeNull();
    expect(parseSsoRedirect("not a url", DOMAIN)).toBeNull();
    expect(parseSsoRedirect(null, DOMAIN)).toBeNull();
  });
});

describe("parseSsoParentOrigin", () => {
  it("accepts a bare trusted origin", () => {
    expect(parseSsoParentOrigin("https://apps.example.org", DOMAIN)).toBe(
      "https://apps.example.org",
    );
  });

  it("rejects anything that is not exactly an origin", () => {
    expect(parseSsoParentOrigin("https://apps.example.org/", DOMAIN)).toBeNull();
    expect(parseSsoParentOrigin("https://apps.example.org/trucks", DOMAIN)).toBeNull();
    expect(parseSsoParentOrigin("https://user@apps.example.org", DOMAIN)).toBeNull();
  });

  it("rejects untrusted origins or unconfigured domain", () => {
    expect(parseSsoParentOrigin("https://evil.com", DOMAIN)).toBeNull();
    expect(parseSsoParentOrigin("http://apps.example.org", DOMAIN)).toBeNull();
    expect(parseSsoParentOrigin("https://apps.example.org", "")).toBeNull();
    expect(parseSsoParentOrigin("*", DOMAIN)).toBeNull();
    expect(parseSsoParentOrigin(null, DOMAIN)).toBeNull();
  });
});
