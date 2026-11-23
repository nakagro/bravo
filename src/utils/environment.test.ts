import { describe, expect, it } from "vitest";
import { resolveAppEnvironment } from "./environment";

describe("resolveAppEnvironment", () => {
  it("treats public HTTPS self-hosted backends as production", () => {
    expect(resolveAppEnvironment("https://convex.example.org")).toBe("production");
    expect(resolveAppEnvironment("")).toBe("production");
  });

  it("identifies the UAT Convex Cloud deployment", () => {
    expect(
      resolveAppEnvironment("https://precious-magpie-647.convex.cloud"),
    ).toBe("uat");
  });

  it("treats non-UAT Convex Cloud deployments as dev", () => {
    expect(resolveAppEnvironment("https://sandbox-123.convex.cloud")).toBe("dev");
  });

  it("treats plain HTTP or LAN/local self-hosted backends as dev", () => {
    expect(resolveAppEnvironment("http://docker.example.lan:3210")).toBe("dev");
    expect(resolveAppEnvironment("http://localhost:3210")).toBe("dev");
    expect(resolveAppEnvironment("http://127.0.0.1:3210")).toBe("dev");
    expect(resolveAppEnvironment("https://192.168.1.50:3210")).toBe("dev");
    expect(resolveAppEnvironment("https://10.0.0.5:3210")).toBe("dev");
    expect(resolveAppEnvironment("https://172.16.0.5:3210")).toBe("dev");
    expect(resolveAppEnvironment("https://convex.local")).toBe("dev");
  });

  it("honors explicit VITE_APP_ENV overrides", () => {
    expect(resolveAppEnvironment("https://convex.example.org", "dev")).toBe("dev");
    expect(resolveAppEnvironment("https://convex.example.org", "DEV")).toBe("dev");
    expect(resolveAppEnvironment("https://convex.example.org", "uat")).toBe("uat");
    expect(resolveAppEnvironment("http://localhost:3210", "production")).toBe(
      "production",
    );
    expect(resolveAppEnvironment("http://localhost:3210", "invalid")).toBe("dev");
  });
});
