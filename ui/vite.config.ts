import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [react()],
  server: {
    // Fail loudly if 5173 is already taken instead of silently picking 5174+ —
    // Keycloak's local dev client only trusts http://localhost:5173/* as a redirect
    // URI, so a second `npm run dev` landing on a different port produces a confusing
    // "Invalid parameter: redirect_uri" error at login time instead of an obvious
    // "port already in use" at startup time.
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:8082',
      // Uploaded media (logos/banners, docs/specs/012-club-profile.md) is served back by the
      // backend at /media/** — without this, an <img src="/media/..."> resolves against the
      // Vite dev server itself, which has nothing there, and fails to load with no console error.
      '/media': 'http://localhost:8082'
    }
  },
  test: {
    // Playwright's e2e specs (ui/e2e/**) are run via `playwright test`, not Vitest — exclude them
    // here so Vitest's unit project doesn't also try to collect and run them.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    projects: [{
      extends: true,
      test: {
        name: 'unit',
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        globals: true
      }
    }, {
      extends: true,
      plugins: [
      // The plugin will run tests for the stories defined in your Storybook config
      // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      storybookTest({
        configDir: path.join(dirname, '.storybook')
      })],
      test: {
        name: 'storybook',
        browser: {
          enabled: true,
          headless: true,
          provider: 'playwright',
          instances: [{
            browser: 'chromium'
          }]
        }
      }
    }]
  }
});
