import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:3400",
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] }
    }
  ],
  webServer: {
    command: "npm run dev -w @metalearn/metalearn-os -- -H 127.0.0.1 -p 3400",
    url: "http://127.0.0.1:3400",
    reuseExistingServer: true,
    timeout: 120_000
  }
});
