import { test, expect } from '@playwright/test';

/**
 * E2E golden paths for docs/specs/005-admin-login.md, per its Test Plan and revised Acceptance
 * Criteria:
 *   1. Open the login dialog, select a known ACTIVE club, complete real Keycloak login as a
 *      platform_admin user, and land on /admin showing that user's identity.
 *   2. Select a *different* ACTIVE club and confirm the same admin outcome — proving club
 *      selection has no bearing on it, per the spec's "verified against at least two different
 *      clubs" acceptance criterion.
 *   3. Use the "No club? Log in as admin" button instead — no club selection at all — and reach
 *      the same /admin outcome.
 *
 * Runs against a real running dev server AND real local Keycloak (not Testcontainers, no mocking)
 * — start all of these before running:
 *   - backend: `cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev` (port 8082)
 *   - frontend: `cd ui && npm run dev` (port 5173)
 *   - Keycloak: `auth.localhost:8180`, realm `cricketlegend`, client `cricketlegend`
 *     (docs/specs/005-admin-login.md's Implementation-time addendum)
 *
 * PREREQUISITE 1: at least *two* Club rows with status = 'ACTIVE' must exist in the dev
 * `cricketlegend_platform` database (one is shared with ui/e2e/landing-page.spec.ts; the second
 * is new for this spec's "club selection doesn't matter" case). Seed both manually, e.g.:
 *
 *   docker exec <postgres-container> psql -U cricket -d cricketlegend_platform -c \
 *     "INSERT INTO club (name, slug, status) VALUES ('Riverside CC', 'riverside', 'ACTIVE') \
 *      ON CONFLICT (slug) DO NOTHING;"
 *   docker exec <postgres-container> psql -U cricket -d cricketlegend_platform -c \
 *     "INSERT INTO club (name, slug, status) VALUES ('Oakfield CC', 'oakfield', 'ACTIVE') \
 *      ON CONFLICT (slug) DO NOTHING;"
 *
 * PREREQUISITE 2 (new for this spec): a Keycloak user carrying the platform_admin realm role must
 * exist in the local `cricketlegend` realm — provisioned entirely out of band via the Keycloak
 * console, per this spec's explicit non-goal against any in-app admin-provisioning path. Provide
 * that user's credentials via E2E_ADMIN_USERNAME / E2E_ADMIN_PASSWORD env vars.
 *
 * NOT run in CI (docs/plans/005-admin-login.md's Flag #2) — `.github/workflows/ci.yml`'s
 * `e2e-smoke` job deliberately has no Keycloak. Local-only until that infra decision is made.
 *
 * IMPORTANT: `ci.yml`'s `e2e-smoke` job invokes `npm run test:e2e` (a bare `playwright test`,
 * `testDir: './e2e'`) with no per-file filtering, so it would pick up this spec automatically and
 * fail (no Keycloak in that job) even without `ci.yml` itself referencing this file by name. Since
 * the plan explicitly says not to touch `ci.yml` for this, these tests skip themselves whenever
 * `process.env.CI` is set (the same variable `playwright.config.ts` and `ci.yml` already rely on)
 * rather than silently breaking that job.
 */

const CLUB_NAME = process.env.E2E_CLUB_NAME ?? 'Riverside CC';
const CLUB_NAME_2 = process.env.E2E_CLUB_NAME_2 ?? 'Oakfield CC';
const ROOT_DOMAIN = process.env.E2E_ROOT_DOMAIN ?? 'localhost:5173';
const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME ?? 'platform-admin';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'platform-admin';

async function loginBySelectingClub(page: import('@playwright/test').Page, clubName: string) {
  await page.goto(`http://${ROOT_DOMAIN}/`);

  await page.getByRole('button', { name: 'Log in' }).click();
  await page.getByLabel('Search for your club').fill(clubName);
  await page.getByText(clubName, { exact: true }).click();

  // Real cross-subdomain top-level navigation to the selected club's /login, which immediately
  // redirects to real Keycloak.
  await completeKeycloakLogin(page);
}

async function completeKeycloakLogin(page: import('@playwright/test').Page) {
  // Keycloak's own login form — not part of this app, so no shared component/selector to reuse.
  await page.getByLabel('Username or email').fill(ADMIN_USERNAME);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

async function expectAdminIdentityVisible(page: import('@playwright/test').Page) {
  await expect(page).toHaveURL(new RegExp(`/admin$`));
  await expect(page.getByText('You are logged in as an admin')).toBeVisible();
  await expect(page.getByText(ADMIN_USERNAME)).toBeVisible();
}

test.describe('Admin login golden paths', () => {
  test.beforeEach(() => {
    test.skip(!!process.env.CI, 'requires local Keycloak — not wired into CI yet, see docs/plans/005-admin-login.md Flag #2');
  });

  test('platform admin logs in after selecting a club', async ({ page }) => {
    await loginBySelectingClub(page, CLUB_NAME);

    await expectAdminIdentityVisible(page);
  });

  test('platform admin logs in after selecting a different club, and the outcome is identical', async ({
    page,
  }) => {
    await loginBySelectingClub(page, CLUB_NAME_2);

    await expectAdminIdentityVisible(page);
  });

  test('platform admin logs in via "No club? Log in as admin", without ever selecting a club', async ({
    page,
  }) => {
    await page.goto(`http://${ROOT_DOMAIN}/`);

    await page.getByRole('button', { name: 'Log in' }).click();
    await page.getByRole('button', { name: 'No club? Log in as admin' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await completeKeycloakLogin(page);

    await expectAdminIdentityVisible(page);
  });
});
