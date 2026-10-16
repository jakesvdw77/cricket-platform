import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

// Optional local settings (the CLUB_ADMIN test login) from the git-ignored ui/.env.e2e; copy ui/.env.e2e.example. Values
// already in the environment win, and CI sets its own, so a missing file is fine.
if (existsSync('.env.e2e')) {
  process.loadEnvFile('.env.e2e')
}

/**
 * E2E tier (docs/standards/testing.md) — Playwright, mobile + desktop viewport, golden paths
 * only. See docs/specs/004-landing-page.md's Test Plan for the two golden paths this config's
 * tests cover: lead-capture submission, and the "find your club" login redirect.
 *
 * Runs against a real dev server (frontend + backend), not Testcontainers — see
 * ui/e2e/landing-page.spec.ts's header comment for prerequisites.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 5'] },
    },
  ],
})
