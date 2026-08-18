import { test, expect } from '@playwright/test';

/**
 * E2E golden path for docs/specs/009-subscriptions.md: log in as the seeded platform_admin test
 * user, navigate Configuration -> Subscriptions, create a Subscription linking a seeded Club to a
 * seeded ACTIVE Product, confirm it appears in the list, open it and change it to a different
 * Product, cancel it, confirm it stays visible with a Cancelled status badge, then re-open it and
 * confirm it renders the disabled-Club-picker edit state.
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
 * fixture club) — this spec logs in the same way, by selecting a club.
 *
 * PREREQUISITE 2: a Keycloak user carrying the platform_admin realm role must exist in the local
 * `cricketlegend` realm — same seeded user ui/e2e/admin-login.spec.ts and
 * ui/e2e/admin-configuration-products.spec.ts already rely on (username and password both default
 * to `platform-admin`, overridable via E2E_ADMIN_USERNAME / E2E_ADMIN_PASSWORD).
 *
 * PREREQUISITE 3: at least one ACTIVE Product must exist (this spec creates its own via the
 * Configuration -> Products screen at the start of the test, rather than depending on manually
 * seeded data, since 008's Product screen is already covered end-to-end by its own spec).
 *
 * NOT run in CI (docs/plans/009-subscriptions.md's own Test Plan entry, matching 005's/008's own
 * precedent) — `.github/workflows/ci.yml`'s `e2e-smoke` job has no Keycloak. Local-only until that
 * infra decision is made. Skips itself whenever `process.env.CI` is set, same as
 * ui/e2e/admin-login.spec.ts and ui/e2e/admin-configuration-products.spec.ts.
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

test.describe('Admin Subscriptions golden path (009)', () => {
  test.beforeEach(() => {
    test.skip(!!process.env.CI, 'requires local Keycloak — not wired into CI yet, see docs/plans/009-subscriptions.md');
  });

  test('platform admin creates, views, changes, and cancels a Subscription', async ({ page }) => {
    const uniqueSuffix = Date.now();
    const productACode = `E2E_SUB_STANDARD_${uniqueSuffix}`;
    const productAName = `E2E Sub Standard ${uniqueSuffix}`;
    const productBCode = `E2E_SUB_PRO_${uniqueSuffix}`;
    const productBName = `E2E Sub Pro ${uniqueSuffix}`;

    await loginBySelectingClub(page, CLUB_NAME);

    // Seed two ACTIVE Products via Configuration -> Products first (008's own screen, already
    // covered end-to-end by its own spec — used here only as fixture data for this spec).
    await page.getByRole('link', { name: 'Configuration' }).click();
    await page.getByRole('link', { name: /^Products/ }).click();
    await expect(page).toHaveURL(/\/admin\/configuration\/products$/);

    for (const [code, name] of [
      [productACode, productAName],
      [productBCode, productBName],
    ]) {
      await page.getByRole('button', { name: 'Add Product' }).click();
      await page.getByLabel('Code').fill(code);
      await page.getByLabel('Name').fill(name);
      await page.getByRole('button', { name: 'Create product' }).click();
      await expect(page).toHaveURL(/\/admin\/configuration\/products$/);

      const card = page.locator('.MuiCard-root').filter({ hasText: name });
      await card.getByRole('link', { name: 'Edit' }).click();
      await page.getByLabel('Publish (set Active)').click();
      await page.getByRole('button', { name: 'Save changes' }).click();
      await expect(page).toHaveURL(/\/admin\/configuration\/products$/);
    }

    // Configuration -> Subscriptions.
    await page.getByRole('link', { name: 'Configuration' }).click();
    await expect(page).toHaveURL(/\/admin\/configuration$/);
    await page.getByRole('link', { name: /^Subscriptions/ }).click();
    await expect(page).toHaveURL(/\/admin\/configuration\/subscriptions$/);

    // Create a Subscription linking the seeded Club to the first seeded ACTIVE Product.
    await page.getByRole('button', { name: 'Add Subscription' }).click();
    await expect(page).toHaveURL(/\/admin\/configuration\/subscriptions\/new$/);

    await page.getByLabel('Club').fill(CLUB_NAME);
    await page.getByText(CLUB_NAME, { exact: true }).click();
    await page.getByLabel('Product').click();
    await page.getByRole('option', { name: new RegExp(productAName) }).click();
    await page.getByRole('button', { name: 'Create subscription' }).click();

    // Confirm it in the list.
    await expect(page).toHaveURL(/\/admin\/configuration\/subscriptions$/);
    const subscriptionCard = page.locator('.MuiCard-root').filter({ hasText: CLUB_NAME });
    await expect(subscriptionCard).toBeVisible();
    await expect(subscriptionCard.getByText(productAName)).toBeVisible();
    await expect(subscriptionCard.getByText('Active')).toBeVisible();

    // Open it: the Club picker is disabled once editing.
    await subscriptionCard.getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/admin\/configuration\/subscriptions\/.+\/edit$/);
    await expect(page.getByLabel('Club')).toBeDisabled();
    await expect(page.getByLabel('Club')).toHaveValue(CLUB_NAME);

    // Change its Product (upgrade).
    await page.getByLabel('Product').click();
    await page.getByRole('option', { name: new RegExp(productBName) }).click();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page).toHaveURL(/\/admin\/configuration\/subscriptions$/);
    const upgradedCard = page.locator('.MuiCard-root').filter({ hasText: CLUB_NAME });
    await expect(upgradedCard.getByText(productBName)).toBeVisible();

    // Cancel it.
    await upgradedCard.getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/admin\/configuration\/subscriptions\/.+\/edit$/);
    await page.getByRole('button', { name: 'Cancel Subscription' }).click();
    await expect(page.getByText('Cancel this subscription?')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm cancel' }).click();

    // It stays visible with a Cancelled status badge.
    await expect(page).toHaveURL(/\/admin\/configuration\/subscriptions$/);
    const cancelledCard = page.locator('.MuiCard-root').filter({ hasText: CLUB_NAME });
    await expect(cancelledCard).toBeVisible();
    await expect(cancelledCard.getByText('Cancelled')).toBeVisible();

    // Re-opening it shows the disabled-Club-picker edit state, and no "Cancel Subscription"
    // action for an already-cancelled Subscription.
    await cancelledCard.getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/admin\/configuration\/subscriptions\/.+\/edit$/);
    await expect(page.getByLabel('Club')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Cancel Subscription' })).toHaveCount(0);
  });
});
