import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";

// Locally this container ships its own Chromium; CI installs Playwright's.
const local = !process.env.CI && fs.existsSync("/opt/pw-browsers/chromium") ? { executablePath: "/opt/pw-browsers/chromium" } : {};
const desktop = { viewport: { width: 1440, height: 900 }, launchOptions: local };
const phone = { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, launchOptions: local };

export default defineConfig({
  testDir: "tests",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: process.env.BASE_URL || "http://localhost:3000", trace: "retain-on-failure" },
  projects: [
    { name: "desktop-light", use: { ...desktop, colorScheme: "light" } },
    { name: "desktop-dark", use: { ...desktop, colorScheme: "dark" } },
    { name: "phone-light", use: { ...phone, colorScheme: "light" } },
    { name: "phone-dark", use: { ...phone, colorScheme: "dark" } },
  ],
  webServer: process.env.BASE_URL ? undefined : { command: "npm run start", url: "http://localhost:3000", reuseExistingServer: true, timeout: 60_000 },
});
