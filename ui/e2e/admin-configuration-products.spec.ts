import { test, expect } from '@playwright/test';

/**
 * E2E golden path for docs/specs/008-product-catalog.md (and docs/specs/007-configuration-hub-
 * overview.md, which this single test also satisfies — see its Test Plan's note that one E2E
 * case covers both specs together): log in as the seeded platform_admin test user, navigate
 * Configuration -> Products, create a Product with a full set of fields, confirm it appears in
 * the list with the right price/limit chips, open it, retire it, confirm its status chip updates
 * to "Retired" without disappearing from the list, then re-open it and confirm the form is
 * read-only.
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
 * `cricketlegend` realm — same seeded user ui/e2e/admin-login.spec.ts already relies on (username
 * and password both default to `platform-admin`, overridable via E2E_ADMIN_USERNAME /
 * E2E_ADMIN_PASSWORD).
 *
 * NOT run in CI (docs/plans/008-product-catalog.md Flag #6, matching 005's own precedent) —
 * `.github/workflows/ci.yml`'s `e2e-smoke` job has no Keycloak. Local-only until that infra
 * decision is made. Skips itself whenever `process.env.CI` is set, same as
 * ui/e2e/admin-login.spec.ts.
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

test.describe('Admin Product Catalog golden path (007/008)', () => {
  test.beforeEach(() => {
    test.skip(!!process.env.CI, 'requires local Keycloak — not wired into CI yet, see docs/plans/008-product-catalog.md Flag #6');
  });

  test('platform admin creates, views, and retires a Product', async ({ page }) => {
    const uniqueSuffix = Date.now();
    const productCode = `E2E_STANDARD_${uniqueSuffix}`;
    const productName = `E2E Standard ${uniqueSuffix}`;

    await loginBySelectingClub(page, CLUB_NAME);

    // Configuration -> Products.
    await page.getByRole('link', { name: 'Configuration' }).click();
    await expect(page).toHaveURL(/\/admin\/configuration$/);
    await page.getByRole('link', { name: /^Products/ }).click();
    await expect(page).toHaveURL(/\/admin\/configuration\/products$/);

    // Create a Product with a full set of fields.
    await page.getByRole('button', { name: 'Add Product' }).click();
    await expect(page).toHaveURL(/\/admin\/configuration\/products\/new$/);

    await page.getByLabel('Code').fill(productCode);
    await page.getByLabel('Name').fill(productName);
    await page.getByLabel('Description (optional)').fill('Seeded by admin-configuration-products.spec.ts');
    await page.getByLabel('Price').fill('49.99');
    await page.getByLabel('Currency').fill('usd');
    await page.getByLabel('Max sections (optional)').fill('5');
    await page.getByLabel('Max teams (optional)').fill('10');
    await page.getByLabel('Max players (optional)').fill('200');
    await page.getByRole('button', { name: 'Create product' }).click();

    // Back on the list, with the right price/limit chips.
    await expect(page).toHaveURL(/\/admin\/configuration\/products$/);
    const productCard = page.locator('.MuiCard-root').filter({ hasText: productName });
    await expect(productCard).toBeVisible();
    await expect(productCard.getByText('USD 49.99/month')).toBeVisible();
    await expect(productCard.getByText('5 sections')).toBeVisible();
    await expect(productCard.getByText('10 teams')).toBeVisible();
    await expect(productCard.getByText('200 players')).toBeVisible();
    await expect(productCard.getByText('Draft')).toBeVisible();

    // Open it (via the card's Edit action) and retire it.
    await productCard.getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/admin\/configuration\/products\/.+\/edit$/);
    await expect(page.getByDisplayValue(productCode)).toBeVisible();

    await page.getByRole('button', { name: 'Retire' }).click();
    await expect(page.getByText('Retire this product?')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm retire' }).click();

    // Status chip updates to Retired, and the product stays visible in the list.
    await expect(page).toHaveURL(/\/admin\/configuration\/products$/);
    const retiredCard = page.locator('.MuiCard-root').filter({ hasText: productName });
    await expect(retiredCard).toBeVisible();
    await expect(retiredCard.getByText('Retired')).toBeVisible();

    // Re-opening it renders a read-only form.
    await retiredCard.getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/admin\/configuration\/products\/.+\/edit$/);
    await expect(page.getByLabel('Code')).toBeDisabled();
    await expect(page.getByLabel('Name')).toBeDisabled();
    await expect(
      page.getByText(
        'This product is retired and is read-only. Its data is kept for historical reference and can no longer be edited.',
      ),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
  });
});
