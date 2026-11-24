/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Set by vite.config.ts at build time - see src/utils/version.ts */
declare const __BUILD_INFO__: { branch: string; commit: string; builtAt: string };

interface ImportMetaEnv {
  readonly VITE_CONVEX_URL?: string;
  readonly VITE_APP_ENV?: string;
  readonly VITE_UAT_DEPLOYMENT?: string;
  readonly VITE_BRIGADE_NAME?: string;
  readonly VITE_BRIGADE_FULL_NAME?: string;
  readonly VITE_BRIGADE_SHORT_NAME?: string;
  readonly VITE_BRIGADE_CODE?: string;
  readonly VITE_STATION_NAME?: string;
  readonly VITE_QUICK_APPLIANCES?: string;
  readonly VITE_FDR_API_URL?: string;
  readonly VITE_SSO_DOMAIN?: string;
  readonly VITE_DISABLE_CAPTCHA?: string;
  readonly VITE_HCAPTCHA_SITE_KEY?: string;
  readonly VITE_VAPID_PUBLIC_KEY?: string;
  readonly VITE_GATE_API_BASE?: string;
  readonly VITE_GATE_MOCK?: string;
  readonly VITE_PUBLIC_POSTHOG_KEY?: string;
  readonly VITE_PUBLIC_POSTHOG_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
