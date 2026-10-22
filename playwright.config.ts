import { defineConfig } from '@playwright/test'
import { existsSync } from 'node:fs'

const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: 2,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    launchOptions: { executablePath },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'desktop',
      use: { viewport: { width: 1440, height: 1050 }, browserName: 'chromium' },
    },
    {
      name: 'tablet',
      use: {
        viewport: { width: 1024, height: 768 },
        browserName: 'chromium',
        hasTouch: true,
      },
    },
    {
      name: 'mobile',
      use: {
        viewport: { width: 360, height: 800 },
        browserName: 'chromium',
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
})
