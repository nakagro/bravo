import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "./button";

describe("Button loading", () => {
  it("disables the button, marks it busy and shows a spinner before the label", () => {
    const html = renderToStaticMarkup(<Button loading>Save</Button>);
    expect(html).toMatch(/ disabled=""/);
    expect(html).toContain('aria-busy="true"');
    expect(html).toMatch(/<svg[^>]*animate-spin[^>]*>.*<\/svg>Save/);
  });

  it("renders a plain button when not loading", () => {
    const html = renderToStaticMarkup(<Button>Save</Button>);
    expect(html).not.toMatch(/ disabled=""/);
    expect(html).not.toContain("aria-busy");
    expect(html).not.toContain("animate-spin");
  });
});
