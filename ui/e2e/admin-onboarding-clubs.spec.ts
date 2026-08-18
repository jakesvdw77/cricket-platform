import { test, expect } from '@playwright/test';

/**
 * E2E golden path for docs/specs/010-minimal-club-creation.md: log in as the seeded
 * platform_admin test user, navigate to Club Onboarding, create a Club, confirm it appears
 * Active in the list, edit its name, suspend it, confirm the Suspended badge, reactivate it.
 *
 * Runs against a real running dev server AND real local Keycloak (not Testcontainers, no
 * mocking) — start all of these before running:
 *   - backend: `cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev` (port 8082)
 *   - frontend: `cd ui && npm run dev` (port 5173)
 *   - Keycloak: `auth.localhost:8180`, realm `cricketlegend`, client `cricketlegend`
 *     (docs/specs/005-admin-login.md's Implementation-time addendum)
 *
 * PREREQUISITE 1: at least one Club row with status = 'ACTIVE' must exist in the dev
 * `cricketlegend_platform` database, per ui/e2e/admin-login.spec.ts's own prerequisite (shared
 * fixture club) — this spec logs in the same way, by selecting a club. The Club this test
 * creates is a brand-new, separate fixture-free row (unique slug per run), not the login club.
 *
 * PREREQUISITE 2: a Keycloak user carrying the platform_admin realm role must exist in the local
 * `cricketlegend` realm — same seeded user ui/e2e/admin-login.spec.ts and
 * ui/e2e/admin-configuration-subscriptions.spec.ts already rely on (username and password both
 * default to `platform-admin`, overridable via E2E_ADMIN_USERNAME / E2E_ADMIN_PASSWORD).
 *
 * NOT run in CI (docs/plans/010-minimal-club-creation.md's own Test Plan entry, matching
 * 005's/008's/009's own precedent) — `.github/workflows/ci.yml`'s `e2e-smoke` job has no
 * Keycloak. Local-only until that infra decision is made. Skips itself whenever `process.env.CI`
 * is set, same as the sibling e2e specs.
 */

const CLUB_NAME = process.env.E2E_CLUB_NAME ?? 'Riverside CC';
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
  await page.getByLabel('Username or email').fill(ADMIN_USERNAME);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText('You are logged in as an admin')).toBeVisible();
}

test.describe('Admin Club Onboarding golden path (010)', () => {
  test.beforeEach(() => {
    test.skip(!!process.env.CI, 'requires local Keycloak — not wired into CI yet, see docs/plans/010-minimal-club-creation.md');
  });

  test('platform admin creates, edits, suspends, and reactivates a Club', async ({ page }) => {
    const uniqueSuffix = Date.now();
    const newClubName = `E2E Onboarding Club ${uniqueSuffix}`;
    const newClubSlug = `e2e-onboarding-${uniqueSuffix}`;
    const renamedClubName = `E2E Onboarding Club (renamed) ${uniqueSuffix}`;

    await loginBySelectingClub(page, CLUB_NAME);

    // Sidebar -> Club Onboarding.
    await page.getByRole('link', { name: 'Club Onboarding' }).click();
    await expect(page).toHaveURL(/\/admin\/onboarding$/);

    // Create a Club.
    await page.getByRole('button', { name: 'Add Club' }).click();
    await expect(page).toHaveURL(/\/admin\/onboarding\/new$/);

    await page.getByLabel('Name').fill(newClubName);
    await page.getByLabel('Slug').fill(newClubSlug);
    await page.getByRole('button', { name: 'Create club' }).click();

    // Confirm it in the list as Active.
    await expect(page).toHaveURL(/\/admin\/onboarding$/);
    let card = page.locator('.MuiCard-root').filter({ hasText: newClubName });
    await expect(card).toBeVisible();
    await expect(card.getByText(newClubSlug)).toBeVisible();
    await expect(card.getByText('Active')).toBeVisible();

    // Edit its name.
    await card.getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/admin\/onboarding\/.+\/edit$/);
    await page.getByLabel('Name').fill(renamedClubName);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page).toHaveURL(/\/admin\/onboarding$/);

    card = page.locator('.MuiCard-root').filter({ hasText: renamedClubName });
    await expect(card).toBeVisible();

    // Suspend it.
    await card.getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/admin\/onboarding\/.+\/edit$/);
    await page.getByRole('button', { name: 'Suspend' }).click();
    await expect(page.getByText('Suspend this club?')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm suspend' }).click();

    // Confirm the Suspended badge.
    await expect(page).toHaveURL(/\/admin\/onboarding$/);
    const suspendedCard = page.locator('.MuiCard-root').filter({ hasText: renamedClubName });
    await expect(suspendedCard).toBeVisible();
    await expect(suspendedCard.getByText('Suspended')).toBeVisible();

    // Reactivate it.
    await suspendedCard.getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/admin\/onboarding\/.+\/edit$/);
    await page.getByRole('button', { name: 'Reactivate' }).click();
    await expect(page.getByText('Reactivate this club?')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm reactivate' }).click();

    await expect(page).toHaveURL(/\/admin\/onboarding$/);
    const reactivatedCard = page.locator('.MuiCard-root').filter({ hasText: renamedClubName });
    await expect(reactivatedCard).toBeVisible();
    await expect(reactivatedCard.getByText('Active')).toBeVisible();
  });
});
