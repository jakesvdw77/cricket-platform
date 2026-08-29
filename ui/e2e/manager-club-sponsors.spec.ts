import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/**
 * E2E golden path for docs/specs/023-sponsors.md, per its Test Plan and Acceptance Criteria:
 * log in as a CLUB_ADMIN-provisioned test user, open Club Sponsors, add a sponsor (name,
 * website, email, phone, a logo, and a social link — all three SponsorForm tabs), confirm it
 * appears in the list, edit it, deactivate it, reactivate it, confirming every state persists
 * across a reload — same structure as ui/e2e/manager-club-contacts.spec.ts.
 *
 * Runs against a real running dev server AND real local Keycloak (not Testcontainers, no mocking)
 * — start all of these before running, same as ui/e2e/manager-club-profile.spec.ts:
 *   - backend: `cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev` (port 8082)
 *   - frontend: `cd ui && npm run dev` (port 5173)
 *   - Keycloak: `auth.localhost:8180`, realm `cricketlegend`, client `cricketlegend`
 *     (docs/specs/005-admin-login.md's Implementation-time addendum)
 *
 * PREREQUISITE: this reuses the exact same CLUB_ADMIN test account as
 * ui/e2e/manager-club-profile.spec.ts / manager-club-contacts.spec.ts (see either file's own
 * PREREQUISITE comment, and project memory reference_smoketest_club_admin.md) — provisioned
 * entirely out of band, no in-repo seeding. Provide the same three env vars, no defaults:
 *   export E2E_CLUB_ADMIN_USERNAME=smoketest-club-admin
 *   export E2E_CLUB_ADMIN_PASSWORD='SmokeTest123!'
 *   export E2E_CLUB_ADMIN_CLUB_ID=<that club's id>
 *
 * NOT run in CI (matching every other Keycloak-dependent spec in this repo, e.g.
 * manager-club-contacts.spec.ts) — `.github/workflows/ci.yml`'s `e2e-smoke` job has no Keycloak.
 * Skips itself whenever process.env.CI is set rather than failing that job.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT_DOMAIN = process.env.E2E_ROOT_DOMAIN ?? 'localhost:5173';
const CLUB_ADMIN_USERNAME = process.env.E2E_CLUB_ADMIN_USERNAME;
const CLUB_ADMIN_PASSWORD = process.env.E2E_CLUB_ADMIN_PASSWORD;
const CLUB_ADMIN_CLUB_ID = process.env.E2E_CLUB_ADMIN_CLUB_ID;

// Reuses the same fixture image manager-club-contacts.spec.ts already uploads via MediaUpload's
// Branding tab — no new fixture needed, this is the same control (namespace="manage") against
// the same POST /api/v1/manage/media endpoint that spec already proved.
const LOGO_FIXTURE = path.join(__dirname, 'fixtures', 'test-logo.png');

async function completeKeycloakLogin(page: import('@playwright/test').Page) {
  // Keycloak's own login form — not part of this app, so no shared component/selector to reuse
  // (same helper shape as manager-club-contacts.spec.ts's completeKeycloakLogin).
  await page.getByLabel('Username or email').fill(CLUB_ADMIN_USERNAME as string);
  await page.getByLabel('Password', { exact: true }).fill(CLUB_ADMIN_PASSWORD as string);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

async function loginAsClubAdmin(page: import('@playwright/test').Page) {
  await page.goto(`http://${ROOT_DOMAIN}/login`);
  await completeKeycloakLogin(page);
}

test.describe('Club Sponsors golden path (023-sponsors.md)', () => {
  test.beforeEach(() => {
    test.skip(!!process.env.CI, 'requires local Keycloak — not wired into CI yet, see docs/plans/005-admin-login.md Flag #2');
    test.skip(
      !CLUB_ADMIN_USERNAME || !CLUB_ADMIN_PASSWORD || !CLUB_ADMIN_CLUB_ID,
      'requires E2E_CLUB_ADMIN_USERNAME / E2E_CLUB_ADMIN_PASSWORD / E2E_CLUB_ADMIN_CLUB_ID — no default CLUB_ADMIN fixture exists in this repo, see this file\'s PREREQUISITE comment',
    );
  });

  test('club admin adds a sponsor with a logo and a social link, edits, deactivates, reactivates, and every state persists across a reload', async ({
    page,
  }) => {
    const uniqueSuffix = Date.now();
    const sponsorName = `E2E Sponsor ${uniqueSuffix}`;
    const renamedSponsorName = `${sponsorName} (Renamed)`;

    await loginAsClubAdmin(page);
    await expect(page).toHaveURL(new RegExp('/manage$'));
    await expect(page.getByText('Not authorized')).not.toBeVisible();

    // Dashboard -> Club Sponsors.
    await page.getByRole('link', { name: 'Club Sponsors' }).click();
    await expect(page).toHaveURL(/\/manage\/sponsors$/);

    // Add a sponsor.
    await page.getByRole('button', { name: 'Add Sponsor' }).click();
    await expect(page).toHaveURL(/\/manage\/sponsors\/new$/);

    // Basic Info tab (default).
    await page.getByLabel('Name').fill(sponsorName);
    await page.getByLabel('Website').fill('https://e2e-sponsor.example.com');
    await page.getByLabel('Email').fill(`e2e-sponsor-${uniqueSuffix}@example.com`);
    await page.getByLabel('Phone').fill('+27 21 555 0188');

    // Branding tab — upload a logo.
    await page.getByRole('tab', { name: 'Branding' }).click();
    await page.getByLabel('Logo file').setInputFiles(LOGO_FIXTURE);
    await expect(page.getByRole('button', { name: 'Replace' })).toBeVisible();

    // Social Media tab — add a known-platform link.
    await page.getByRole('tab', { name: 'Social Media' }).click();
    await page.getByRole('button', { name: 'Add link' }).click();
    await page.getByLabel('Platform').click();
    await page.getByRole('option', { name: 'Facebook' }).click();
    await page.getByLabel('URL').fill('https://facebook.com/e2e-sponsor');

    await page.getByRole('button', { name: 'Create sponsor' }).click();
    await expect(page).toHaveURL(/\/manage\/sponsors$/);

    // Appears in the list.
    let card = page.locator('.MuiCard-root').filter({ hasText: sponsorName });
    await expect(card).toBeVisible();
    await expect(card.getByText('https://e2e-sponsor.example.com')).toBeVisible();

    // Edit — change the name.
    await card.getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/manage\/sponsors\/.+\/edit$/);
    await expect(page.getByLabel('Name')).toHaveValue(sponsorName);

    const nameField = page.getByLabel('Name');
    await nameField.fill('');
    await nameField.fill(renamedSponsorName);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page).toHaveURL(/\/manage\/sponsors$/);

    card = page.locator('.MuiCard-root').filter({ hasText: renamedSponsorName });
    await expect(card).toBeVisible();

    // Deactivate.
    await card.getByRole('button', { name: 'Deactivate' }).click();
    await expect(card.getByText('Inactive')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Reactivate' })).toBeVisible();

    // Reload — deactivated state persisted server-side (a real GET, not just the mutation
    // response), the same class of check that caught 022's LazyInitializationException bug.
    await page.reload();
    card = page.locator('.MuiCard-root').filter({ hasText: renamedSponsorName });
    await expect(card.getByText('Inactive')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Reactivate' })).toBeVisible();

    // Reactivate.
    await card.getByRole('button', { name: 'Reactivate' }).click();
    await expect(card.getByText('Inactive')).not.toBeVisible();
    await expect(card.getByRole('button', { name: 'Deactivate' })).toBeVisible();

    // Reload — reactivated state persisted too, and the branding/social-link/name edits from
    // earlier all survived a real GET-driven re-render.
    await page.reload();
    card = page.locator('.MuiCard-root').filter({ hasText: renamedSponsorName });
    await expect(card.getByText('Inactive')).not.toBeVisible();
    await expect(card.getByRole('button', { name: 'Deactivate' })).toBeVisible();

    await card.getByRole('link', { name: 'Edit' }).click();
    await expect(page.getByLabel('Name')).toHaveValue(renamedSponsorName);
    await page.getByRole('tab', { name: 'Branding' }).click();
    await expect(page.getByRole('button', { name: 'Replace' })).toBeVisible();
    await page.getByRole('tab', { name: 'Social Media' }).click();
    await expect(page.getByLabel('Platform')).toHaveValue('facebook');
    await expect(page.getByLabel('URL')).toHaveValue('https://facebook.com/e2e-sponsor');
  });
});
