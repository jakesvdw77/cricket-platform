import { test, expect } from '@playwright/test'

/**
 * E2E golden paths for docs/specs/004-landing-page.md, per its Test Plan:
 *   1. Visit the root domain, submit the lead-capture form, see the confirmation state.
 *   2. Search for a known ACTIVE club and be redirected to its subdomain's /login route.
 *
 * Runs against a real running dev server (not Testcontainers) — start both before running:
 *   - backend: `cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev` (port 8082)
 *   - frontend: `cd ui && npm run dev` (port 5173)
 *
 * PREREQUISITE for path 2 ("find your club" redirect): at least one Club row with
 * status = 'ACTIVE' must exist in the dev `cricketlegend_platform` database — there is no
 * practical way to seed this from Playwright itself against a real running dev server (no
 * Testcontainers here, and the public API never creates Clubs). Seed one manually before running
 * this spec, e.g. via CLAUDE.md's "Local development" section:
 *
 *   docker exec <postgres-container> psql -U cricket -d cricketlegend_platform -c \
 *     "INSERT INTO club (name, slug, status) VALUES ('Riverside CC', 'riverside', 'ACTIVE') \
 *      ON CONFLICT (slug) DO NOTHING;"
 *
 * The expected name/slug can be overridden via E2E_CLUB_NAME / E2E_CLUB_SLUG env vars if a
 * different fixture club is seeded.
 */

const CLUB_NAME = process.env.E2E_CLUB_NAME ?? 'Riverside CC';
const CLUB_SLUG = process.env.E2E_CLUB_SLUG ?? 'riverside';
const ROOT_DOMAIN = process.env.E2E_ROOT_DOMAIN ?? 'localhost:5173';

test.describe('Landing page golden paths', () => {
  test('visitor submits the lead-capture form and sees the confirmation state', async ({ page }) => {
    await page.goto('/');

    await page.getByLabel('Name', { exact: true }).fill('Ada Lovelace');
    await page.getByLabel('Email').fill(`ada.${Date.now()}@example.com`);
    await page.getByLabel('Club name').fill('Analytical Engines CC');

    await page.getByRole('button', { name: 'Get started' }).click();

    await expect(page.getByText("Thanks — we'll be in touch")).toBeVisible();
    await expect(page.getByRole('button', { name: 'Get started' })).toHaveCount(0);
  });

  test('visitor searches for a known active club and is redirected to its subdomain login', async ({ page }) => {
    await page.goto('/');

    // "Log in" opens a dialog (docs/specs/005-admin-login.md) rather than scrolling to a page
    // section — it's a <button>, not an anchor link.
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.getByLabel('Search for your club').fill(CLUB_NAME);

    const resultItem = page.getByText(CLUB_NAME, { exact: true });
    await expect(resultItem).toBeVisible();

    // Same scheme as the current page, matching FindYourClubLogin.tsx's use of
    // window.location.protocol — HTTP in this dev/CI environment, HTTPS in prod.
    const protocol = new URL(page.url()).protocol;
    const expectedUrl = `${protocol}//${CLUB_SLUG}.${ROOT_DOMAIN}/login`;

    // The redirect is a real top-level navigation (window.location.href) to another club's
    // subdomain, which this SPA never actually serves in this test environment — intercept and
    // abort the outgoing navigation request so we can assert on its URL without needing a real
    // server listening there.
    let capturedUrl: string | null = null;
    await page.route(
      (url) => url.pathname === '/login',
      async (route) => {
        capturedUrl = route.request().url();
        await route.abort();
      },
    );

    await resultItem.click();

    await expect.poll(() => capturedUrl).toBe(expectedUrl);
  });
});
