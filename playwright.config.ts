import { defineConfig } from "@playwright/test";

/**
 * Against `vite preview`, never the dev server.
 *
 * The CSP is in `index.html`, so it is live in both. But the dev server also serves unbundled
 * modules and a hot-reload socket, and a suite that is green there can be red on the built site
 * for reasons the tests never see. The preview serves exactly what deploys.
 */
export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://127.0.0.1:4178" },
  webServer: {
    command: "npm run build && npm run preview -- --host 127.0.0.1 --port 4178 --strictPort",
    url: "http://127.0.0.1:4178",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
