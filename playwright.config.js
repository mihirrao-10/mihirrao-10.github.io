import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/black-geometry/browser",
  timeout: 30000,
  expect: { timeout: 8000 },
  fullyParallel: false,
  workers: 1,
  outputDir: ".artifacts/black-geometry/browser-results",
  reporter: [
    ["list"],
    ["json", { outputFile: ".artifacts/black-geometry/browser-results.json" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:8000",
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  webServer: [
    {
      command: "python3 -m http.server 8000 --bind 127.0.0.1",
      url: "http://127.0.0.1:8000",
      reuseExistingServer: true,
    },
    {
      command: "python3 -m http.server 8001 --bind 127.0.0.1 -d dist",
      url: "http://127.0.0.1:8001",
      reuseExistingServer: true,
    },
  ],
});
