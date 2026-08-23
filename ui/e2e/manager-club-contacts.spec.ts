import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/**
 * E2E golden path for docs/specs/021-club-contacts.md, per its Test Plan and Acceptance Criteria:
 * log in as a CLUB_ADMIN-provisioned test user, open Club Contacts, add a contact (including a
 * photo upload via the new POST /api/v1/manage/media path), flag it primary, edit it, deactivate
 * it, reactivate it, confirming each state persists across a reload.
 *
 * Runs against a real running dev server AND real local Keycloak (not Testcontainers, no mocking)
 * — start all of these before running, same as ui/e2e/manager-club-profile.spec.ts:
 *   - backend: `cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev` (port 8082)
 *   - frontend: `cd ui && npm run dev` (port 5173)
 *   - Keycloak: `auth.localhost:8180`, realm `cricketlegend`, client `cricketlegend`
 *     (docs/specs/005-admin-login.md's Implementation-time addendum)
 *
 * PREREQUISITE: this reuses the exact same CLUB_ADMIN test account as
 * ui/e2e/manager-club-profile.spec.ts (see that file's own PREREQUISITE comment, and project
 * memory reference_smoketest_club_admin.md) — provisioned entirely out of band, no in-repo
 * seeding. Provide the same three env vars, no defaults:
 *   export E2E_CLUB_ADMIN_USERNAME=smoketest-club-admin
 *   export E2E_CLUB_ADMIN_PASSWORD='SmokeTest123!'
 *   export E2E_CLUB_ADMIN_CLUB_ID=<that club's id>
 *
 * NOT run in CI (matching every other Keycloak-dependent spec in this repo, e.g.
 * manager-club-profile.spec.ts) — `.github/workflows/ci.yml`'s `e2e-smoke` job has no Keycloak.
 * Skips itself whenever process.env.CI is set rather than failing that job.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT_DOMAIN = process.env.E2E_ROOT_DOMAIN ?? 'localhost:5173';
const CLUB_ADMIN_USERNAME = process.env.E2E_CLUB_ADMIN_USERNAME;
const CLUB_ADMIN_PASSWORD = process.env.E2E_CLUB_ADMIN_PASSWORD;
const CLUB_ADMIN_CLUB_ID = process.env.E2E_CLUB_ADMIN_CLUB_ID;

// Reuses the same fixture image ui/e2e/admin-onboarding-clubs.spec.ts already uploads via
// MediaUpload's Branding tab — no new fixture needed, this is the same control (namespace=
// "manage" instead of the default "platform") against a different POST /api/v1/manage/media
// endpoint.
const PHOTO_FIXTURE = path.join(__dirname, 'fixtures', 'test-logo.png');

async function completeKeycloakLogin(page: import('@playwright/test').Page) {
  // Keycloak's own login form — not part of this app, so no shared component/selector to reuse
  // (same helper shape as manager-club-profile.spec.ts's completeKeycloakLogin).
  await page.getByLabel('Username or email').fill(CLUB_ADMIN_USERNAME as string);
  await page.getByLabel('Password', { exact: true }).fill(CLUB_ADMIN_PASSWORD as string);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

async function loginAsClubAdmin(page: import('@playwright/test').Page) {
  await page.goto(`http://${ROOT_DOMAIN}/login`);
  await completeKeycloakLogin(page);
}

test.describe('Club Contacts golden path (021-club-contacts.md)', () => {
  test.beforeEach(() => {
    test.skip(!!process.env.CI, 'requires local Keycloak — not wired into CI yet, see docs/plans/005-admin-login.md Flag #2');
    test.skip(
      !CLUB_ADMIN_USERNAME || !CLUB_ADMIN_PASSWORD || !CLUB_ADMIN_CLUB_ID,
      'requires E2E_CLUB_ADMIN_USERNAME / E2E_CLUB_ADMIN_PASSWORD / E2E_CLUB_ADMIN_CLUB_ID — no default CLUB_ADMIN fixture exists in this repo, see this file\'s PREREQUISITE comment',
    );
  });

  test('club admin adds a contact with a photo, flags it primary, edits, deactivates, reactivates, and every state persists across a reload', async ({
    page,
  }) => {
    const uniqueSuffix = Date.now();
    const firstName = 'E2E';
    const lastName = `Contact ${uniqueSuffix}`;
    const fullName = `${firstName} ${lastName}`;

    await loginAsClubAdmin(page);
    await expect(page).toHaveURL(new RegExp('/manage$'));
    await expect(page.getByText('Not authorized')).not.toBeVisible();

    // Dashboard -> Club Contacts.
    await page.getByRole('link', { name: 'Club Contacts' }).click();
    await expect(page).toHaveURL(/\/manage\/club-contacts$/);

    // Add a contact.
    await page.getByRole('button', { name: 'Add Contact' }).click();
    await expect(page).toHaveURL(/\/manage\/club-contacts\/new$/);

    await page.getByLabel('First name').fill(firstName);
    await page.getByLabel('Last name').fill(lastName);
    await page.getByLabel('Email').fill(`e2e-contact-${uniqueSuffix}@example.com`);
    await page.getByLabel('Phone').fill('+27 21 555 0100');
    await page.getByLabel('Role').fill('Chairman');

    await page.getByLabel('Photo file').setInputFiles(PHOTO_FIXTURE);
    await expect(page.getByRole('button', { name: 'Replace' })).toBeVisible();

    await page.getByLabel('Is primary contact').check();

    await page.getByRole('button', { name: 'Create contact' }).click();
    await expect(page).toHaveURL(/\/manage\/club-contacts$/);

    // Appears in the list with a Primary badge.
    let card = page.locator('.MuiCard-root').filter({ hasText: fullName });
    await expect(card).toBeVisible();
    await expect(card.getByText('Primary')).toBeVisible();
    await expect(card.getByText('Chairman')).toBeVisible();

    // Edit — change the role.
    await card.getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/manage\/club-contacts\/.+\/edit$/);
    await expect(page.getByLabel('First name')).toHaveValue(firstName);

    const roleField = page.getByLabel('Role');
    await roleField.fill('');
    await roleField.fill('Vice Chairman');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page).toHaveURL(/\/manage\/club-contacts$/);

    card = page.locator('.MuiCard-root').filter({ hasText: fullName });
    await expect(card.getByText('Vice Chairman')).toBeVisible();

    // Deactivate.
    await card.getByRole('button', { name: 'Deactivate' }).click();
    await expect(card.getByText('Inactive')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Reactivate' })).toBeVisible();

    // Reload — deactivated state persisted server-side, not just client state.
    await page.reload();
    card = page.locator('.MuiCard-root').filter({ hasText: fullName });
    await expect(card.getByText('Inactive')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Reactivate' })).toBeVisible();

    // Reactivate.
    await card.getByRole('button', { name: 'Reactivate' }).click();
    await expect(card.getByText('Inactive')).not.toBeVisible();
    await expect(card.getByRole('button', { name: 'Deactivate' })).toBeVisible();

    // Reload — reactivated state persisted too, and the role edit from earlier survived.
    await page.reload();
    card = page.locator('.MuiCard-root').filter({ hasText: fullName });
    await expect(card.getByText('Inactive')).not.toBeVisible();
    await expect(card.getByText('Vice Chairman')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Deactivate' })).toBeVisible();
  });
});
