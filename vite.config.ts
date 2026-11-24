import { defineConfig, loadEnv } from "vite-plus";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { execSync } from "child_process";
import { VitePWA } from "vite-plugin-pwa";

const productionTextReplacements: Array<[RegExp, string]> = [
  [new RegExp(String.fromCodePoint(0x2014), "gu"), "-"],
  [/%(?:25)*e2%(?:25)*80%(?:25)*94/gi, "-"],
  [/&#x0*2014;?/gi, "-"],
  [/&#0*8212;?/gi, "-"],
  [/\\u0*2014|\\u\{0*2014\}/gi, "-"],
  [/\\U0*00002014/gi, "-"],
  [/\\x[eE]2\\x80\\x94/gi, "-"],
  [/\\0*2014(?:\s|[^0-9a-f])/gi, "-"],
];

function scrubProductionText(value: string) {
  return productionTextReplacements.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value,
  );
}

function scrubEmDashesFromBuild() {
  return {
    name: "scrub-em-dashes-from-build",
    generateBundle(_options: unknown, bundle: Record<string, unknown>) {
      for (const output of Object.values(bundle)) {
        if (!output || typeof output !== "object") continue;

        if ("code" in output && typeof output.code === "string") {
          output.code = scrubProductionText(output.code);
        } else if ("source" in output && typeof output.source === "string") {
          output.source = scrubProductionText(output.source);
        }
      }
    },
  };
}


function resolveHtmlEnvironment(
  convexUrl: string,
  explicitEnv?: string,
  uatDeployment?: string,
): "production" | "uat" | "dev" {
  const override = explicitEnv?.trim().toLowerCase();
  if (override === "production" || override === "uat" || override === "dev") {
    return override;
  }
  const uatSlug = uatDeployment?.trim();
  if (uatSlug && convexUrl.includes(uatSlug)) return "uat";
  if (convexUrl.includes(".convex.cloud")) return "dev";
  if (!convexUrl) return "production";
  try {
    const parsed = new URL(convexUrl);
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (
      parsed.protocol === "http:" ||
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "0.0.0.0" ||
      host.endsWith(".local") ||
      host.endsWith(".lan") ||
      host.endsWith(".home.arpa") ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      return "dev";
    }
  } catch {
    // Fall through to production.
  }
  return "production";
}

function environmentAwareHtml(
  convexUrl: string,
  explicitEnv?: string,
  uatDeployment?: string,
  brigadeCode?: string,
) {
  const appEnv = resolveHtmlEnvironment(convexUrl, explicitEnv, uatDeployment);

  return {
    name: "environment-aware-html",
    transformIndexHtml(html: string) {
      // Warm up whichever backend this build talks to.
      const origin = convexUrl.replace(/\/+$/, "");
      html = html.replace(
        "<!-- __CONVEX_PRECONNECT__ -->",
        origin ? `<link rel="preconnect" href="${origin}" />` : "",
      );

      if (appEnv === "uat") {
        return html
          .replace(/<title>[^<]*<\/title>/, "<title>BRAVO - UAT</title>")
          .replace(
            /<meta name="apple-mobile-web-app-title" content="[^"]*" \/>/,
            '<meta name="apple-mobile-web-app-title" content="BRAVO UAT" />',
          )
          .replace('href="/manifest.json"', 'href="/manifest.uat.json"')
          .replace(
            /\/icons\/(favicon-96x96\.png|favicon\.svg|favicon\.ico|apple-touch-icon\.png)/g,
            "/icons/uat/$1",
          )
          // Red status bar / theme colour, so even the chrome around the app
          // reads as "not production".
          .replace(
            /<meta name="theme-color" content="#ffffff" media="\(prefers-color-scheme: light\)" \/>/,
            '<meta name="theme-color" content="#dc2626" media="(prefers-color-scheme: light)" />',
          )
          .replace(
            /<meta name="theme-color" content="#1f2937" media="\(prefers-color-scheme: dark\)" \/>/,
            '<meta name="theme-color" content="#dc2626" media="(prefers-color-scheme: dark)" />',
          );
      }

      if (appEnv === "dev") {
        return html
          .replace(/<title>[^<]*<\/title>/, "<title>BRAVO - DEV</title>")
          .replace(
            /<meta name="apple-mobile-web-app-title" content="[^"]*" \/>/,
            '<meta name="apple-mobile-web-app-title" content="BRAVO DEV" />',
          )
          .replace(
            /<meta name="theme-color" content="#ffffff" media="\(prefers-color-scheme: light\)" \/>/,
            '<meta name="theme-color" content="#f59e0b" media="(prefers-color-scheme: light)" />',
          )
          .replace(
            /<meta name="theme-color" content="#1f2937" media="\(prefers-color-scheme: dark\)" \/>/,
            '<meta name="theme-color" content="#f59e0b" media="(prefers-color-scheme: dark)" />',
          );
      }

      const code = brigadeCode?.trim();
      if (code) {
        const title = `BRAVO - ${code}`;
        html = html
          .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
          .replace(
            /<meta name="apple-mobile-web-app-title" content="[^"]*" \/>/,
            `<meta name="apple-mobile-web-app-title" content="${title}" />`,
          );
      }

      return html;
    },
  };
}

/**
 * Which build this is: branch, short commit and build time. Vercel names the
 * branch and commit in its build env; a local build asks git. Anything
 * missing comes back empty and the app shows the plain version, as on prod.
 */
function buildInfo(env: Record<string, string | undefined>) {
  const git = (cmd: string) => {
    try {
      return execSync(`git ${cmd}`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    } catch {
      return "";
    }
  };
  return {
    branch: env.VERCEL_GIT_COMMIT_REF || git("rev-parse --abbrev-ref HEAD"),
    commit: (env.VERCEL_GIT_COMMIT_SHA || git("rev-parse HEAD")).slice(0, 7),
    builtAt: new Date().toISOString(),
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  const convexUrl = env.VITE_CONVEX_URL ?? "";

  return {
  lint: {
    plugins: ["react", "typescript", "oxc"],
    categories: {
      correctness: "warn",
    },
    rules: {
      "no-unused-vars": [
        "warn",
        {
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "typescript/ban-ts-comment": "error",
      "typescript/no-explicit-any": "off",
    },
    ignorePatterns: [
      "dist",
      "dev-dist",
      "convex/_generated",
      "exports",
      "scripts",
    ],
  },
  test: {
    // convex-test must run un-externalized so its import.meta.glob of
    // convex/ modules works inside the test bundle
    server: { deps: { inline: ["convex-test"] } },
  },
  plugins: [
    tailwindcss(),
    react(),
    environmentAwareHtml(
      convexUrl,
      env.VITE_APP_ENV,
      env.VITE_UAT_DEPLOYMENT,
      env.VITE_BRIGADE_CODE,
    ),
    VitePWA({
      registerType: "autoUpdate", // automatically update when new SW available
      injectRegister: "auto", // automatically inject SW registration script
      strategies: "generateSW",
      // index.html links its own manifest (public/manifest.json, or
      // manifest.uat.json on UAT), which is the one browsers actually use -
      // they honour the FIRST rel="manifest". VitePWA was injecting a second,
      // iconless one that was silently ignored, so its config here was dead.
      // Disabled to leave exactly one manifest link.
      manifest: false,
      workbox: {
        importScripts: ["./sw-push.js"], // include push handler
        skipWaiting: true, // immediately activate new SW
        clientsClaim: true, // take control of all clients immediately
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB limit (default is 2 MB)
        // Labs' hidden refresh iframe is a navigation request too. It must get
        // its own tiny page, never the SPA shell as a fallback.
        navigateFallbackDenylist: [/^\/sso-refresh/],
      },
      devOptions: {
        enabled: true, // enable PWA in dev for easier testing
        // In dev, generateSW globs over dev-dist which only contains the SW
        // itself, so workbox warns that the glob matches nothing — harmless
        suppressWarnings: true,
      },
    }),
    scrubEmDashesFromBuild(),
  ],
  define: {
    __BUILD_INFO__: JSON.stringify(buildInfo(env)),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true, // listen on 0.0.0.0 so the dev server is reachable on the LAN
    warmup: {
      // pre-transform on dev server start to speed up first page load
      clientFiles: [
        "./src/main.tsx",
        "./src/App.tsx",
        "./src/pages/AuthPage.tsx",
        "./src/pages/DashboardPage.tsx",
        "./src/pages/AvailabilityPage.tsx",
      ],
    },
  },
  build: {
    rolldownOptions: {
      // Two HTML entries: the app, and the chrome-less page Labs frames to
      // renew its SSO cookie (src/sso-refresh/main.tsx).
      input: {
        main: path.resolve(__dirname, "index.html"),
        ssoRefresh: path.resolve(__dirname, "sso-refresh.html"),
      },
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          // PDF generation — large libs only used in specific features
          if (
            id.includes("jspdf") ||
            id.includes("html2canvas") ||
            id.includes("dompurify") ||
            id.includes("purify")
          ) {
            return "vendor-pdf";
          }

          // Charts — recharts and its d3 sub-dependencies
          if (id.includes("recharts") || id.includes("d3-")) {
            return "vendor-charts";
          }

          // Core React runtime + routing
          if (
            id.includes("/react-dom/") ||
            id.includes("/react-router") ||
            id.includes("/react/")
          ) {
            return "vendor-react";
          }

          // Convex client
          if (id.includes("/convex/") || id.includes("@convex-dev")) {
            return "vendor-convex";
          }

          // Radix UI primitives + related UI libs
          if (
            id.includes("@radix-ui") ||
            id.includes("@headlessui") ||
            id.includes("/cmdk/") ||
            id.includes("/vaul/") ||
            id.includes("/sonner/") ||
            id.includes("@dnd-kit")
          ) {
            return "vendor-ui";
          }
        },
      },
    },
  },
  };
});
