import type { NextConfig } from "next";
import path from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const SECURITY_HEADERS = [
  // Block embedding in iframes from other origins.
  { key: "X-Frame-Options", value: "DENY" },
  // Stop the browser from MIME-sniffing responses.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Never tell a clicked-through site which local page (and its query) you came from.
  { key: "Referrer-Policy", value: "no-referrer" },
  // Lock down browser capabilities this app never needs.
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), hid=(), bluetooth=(), midi=(), display-capture=(), browsing-topics=(), interest-cohort=()",
  },
  // Isolate the window from cross-origin popups and refuse to serve our responses into other sites.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  // CSP for a local-only app: only same-origin scripts/styles. Fonts are self-hosted by next/font.
  // Inline styles allowed for shadcn/Tailwind. Inline scripts are needed for Next's hydration
  // payload (nonces would force every page dynamic); eval only in dev for HMR.
  // The browser never calls Anthropic or Ollama directly - the server does - so connect-src stays 'self'.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "img-src 'self' data: blob:",
      "connect-src 'self' ws://127.0.0.1:* ws://localhost:*",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "israeli-bank-scrapers", "@sergienko4/israeli-bank-scrapers"],
  devIndicators: false,
  // Include shared worktree dependencies on the host and use /app inside Docker.
  turbopack: { root: path.resolve(require.resolve("next/package.json"), "../../..") },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
      {
        // Browsers must always re-check the worker so updates ship immediately.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
