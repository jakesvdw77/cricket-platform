import { test, expect } from '@playwright/test';

/**
 * E2E golden path for docs/specs/024-sponsor-contacts.md, per its Test Plan and Acceptance
 * Criteria: log in as a CLUB_ADMIN-provisioned test user, from an existing sponsor open Manage
 * Contacts, add a contact and flag it primary, add a second contact and flag *it* primary
 * (confirming the first's flag clears with no error — the auto-unset behaviour round-tripping
 * through the real HTTP layer), deactivate one, reactivate it — same structure as
 * ui/e2e/manager-club-contacts.spec.ts and ui/e2e/manager-club-sponsors.spec.ts.
 *
 * Runs against a real running dev server AND real local Keycloak (not Testcontainers, no mocking)
 * — start all of these before running, same as ui/e2e/manager-club-profile.spec.ts:
 *   - backend: `cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev` (port 8082)
 *   - frontend: `cd ui && npm run dev` (port 5173)
 *   - Keycloak: `auth.localhost:8180`, realm `cricketlegend`, client `cricketlegend`
 *     (docs/specs/005-admin-login.md's Implementation-time addendum)
 *
 * PREREQUISITE: this reuses the exact same CLUB_ADMIN test account as
 * ui/e2e/manager-club-profile.spec.ts / manager-club-contacts.spec.ts / manager-club-sponsors.spec.ts
 * (see any of those files' own PREREQUISITE comment, and project memory
 * reference_smoketest_club_admin.md) — provisioned entirely out of band, no in-repo seeding.
 * Provide the same three env vars, no defaults:
 *   export E2E_CLUB_ADMIN_USERNAME=smoketest-club-admin
 *   export E2E_CLUB_ADMIN_PASSWORD='SmokeTest123!'
 *   export E2E_CLUB_ADMIN_CLUB_ID=<that club's id>
 *
 * NOT run in CI (matching every other Keycloak-dependent spec in this repo, e.g.
 * manager-club-sponsors.spec.ts) — `.github/workflows/ci.yml`'s `e2e-smoke` job has no Keycloak.
 * Skips itself whenever process.env.CI is set rather than failing that job.
 */

const ROOT_DOMAIN = process.env.E2E_ROOT_DOMAIN ?? 'localhost:5173';
const CLUB_ADMIN_USERNAME = process.env.E2E_CLUB_ADMIN_USERNAME;
const CLUB_ADMIN_PASSWORD = process.env.E2E_CLUB_ADMIN_PASSWORD;
const CLUB_ADMIN_CLUB_ID = process.env.E2E_CLUB_ADMIN_CLUB_ID;

async function completeKeycloakLogin(page: import('@playwright/test').Page) {
  // Keycloak's own login form — not part of this app, so no shared component/selector to reuse
  // (same helper shape as manager-club-sponsors.spec.ts's completeKeycloakLogin).
  await page.getByLabel('Username or email').fill(CLUB_ADMIN_USERNAME as string);
  await page.getByLabel('Password', { exact: true }).fill(CLUB_ADMIN_PASSWORD as string);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

async function loginAsClubAdmin(page: import('@playwright/test').Page) {
  await page.goto(`http://${ROOT_DOMAIN}/login`);
  await completeKeycloakLogin(page);
}

test.describe('Sponsor Contacts golden path (024-sponsor-contacts.md)', () => {
  test.beforeEach(() => {
    test.skip(!!process.env.CI, 'requires local Keycloak — not wired into CI yet, see docs/plans/005-admin-login.md Flag #2');
    test.skip(
      !CLUB_ADMIN_USERNAME || !CLUB_ADMIN_PASSWORD || !CLUB_ADMIN_CLUB_ID,
      'requires E2E_CLUB_ADMIN_USERNAME / E2E_CLUB_ADMIN_PASSWORD / E2E_CLUB_ADMIN_CLUB_ID — no default CLUB_ADMIN fixture exists in this repo, see this file\'s PREREQUISITE comment',
    );
  });

  test('club admin manages a sponsor\'s contacts: adds two, re-flagging primary clears the first with no error, deactivates one, reactivates it', async ({
    page,
  }) => {
    // Date.now() alone can collide across projects (desktop-chromium/mobile-chromium run in
    // parallel workers and can land in the same millisecond), which then makes two sponsors'
    // names substring-collide under this file's own `.filter({ hasText: ... })` card lookups.
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sponsorName = `E2E Sponsor Contacts ${uniqueSuffix}`;
    const firstContactName = `Alice Primary ${uniqueSuffix}`;
    const secondContactName = `Bob Primary ${uniqueSuffix}`;

    await loginAsClubAdmin(page);
    await expect(page).toHaveURL(new RegExp('/manage$'));
    await expect(page.getByText('Not authorized')).not.toBeVisible();

    // Dashboard -> Club Sponsors -> create a sponsor to attach contacts to.
    await page.getByRole('link', { name: 'Club Sponsors' }).click();
    await expect(page).toHaveURL(/\/manage\/sponsors$/);

    await page.getByRole('button', { name: 'Add Sponsor' }).click();
    await expect(page).toHaveURL(/\/manage\/sponsors\/new$/);
    // getByLabel('Name') is ambiguous here: the sponsors list's own ListToolbar sort <Select>
    // (still briefly in the DOM during the client-side route transition) computes an accessible
    // name of "Name" too (its currently-selected sort option's own display text). Scoping to
    // role=textbox sidesteps the race entirely — a MUI Select is role=combobox, never textbox.
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill(sponsorName);
    await page.getByRole('button', { name: 'Create sponsor' }).click();
    await expect(page).toHaveURL(/\/manage\/sponsors$/);

    const sponsorCard = page.locator('.MuiCard-root').filter({ hasText: sponsorName });
    await expect(sponsorCard).toBeVisible();

    // From the existing sponsor's edit screen, open Manage Contacts.
    await sponsorCard.getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/manage\/sponsors\/.+\/edit$/);
    await page.getByRole('link', { name: 'Manage Contacts' }).click();
    await expect(page).toHaveURL(/\/manage\/sponsors\/.+\/contacts$/);

    // Add a first contact, flagged primary.
    await page.getByRole('button', { name: 'Add Contact' }).click();
    await expect(page).toHaveURL(/\/manage\/sponsors\/.+\/contacts\/new$/);
    await page.getByLabel('First name').fill('Alice');
    await page.getByLabel('Last name').fill(`Primary ${uniqueSuffix}`);
    await page.getByLabel('Email').fill(`e2e-alice-${uniqueSuffix}@example.com`);
    await page.getByLabel('Phone').fill('+27 21 555 0100');
    await page.getByLabel('Role').fill('Marketing Contact');
    await page.getByLabel('Is primary contact').check();
    await page.getByRole('button', { name: 'Create contact' }).click();
    await expect(page).toHaveURL(/\/manage\/sponsors\/.+\/contacts$/);

    let firstCard = page.locator('.MuiCard-root').filter({ hasText: firstContactName });
    await expect(firstCard).toBeVisible();
    // exact: true — firstContactName ("Alice Primary <suffix>") itself contains the substring
    // "Primary", which would otherwise also match the card's own heading text.
    await expect(firstCard.getByText('Primary', { exact: true })).toBeVisible();

    // Add a second contact, also flagged primary — must silently unset the first's flag, no
    // error (the exact scenario docs/specs/021-club-contacts.md's saveAndFlush fix guards
    // against, applied here from day one per docs/specs/024-sponsor-contacts.md).
    await page.getByRole('button', { name: 'Add Contact' }).click();
    await expect(page).toHaveURL(/\/manage\/sponsors\/.+\/contacts\/new$/);
    await page.getByLabel('First name').fill('Bob');
    await page.getByLabel('Last name').fill(`Primary ${uniqueSuffix}`);
    await page.getByLabel('Email').fill(`e2e-bob-${uniqueSuffix}@example.com`);
    await page.getByLabel('Phone').fill('+27 21 555 0199');
    await page.getByLabel('Role').fill('Account Manager');
    await page.getByLabel('Is primary contact').check();
    await page.getByRole('button', { name: 'Create contact' }).click();
    await expect(page).toHaveURL(/\/manage\/sponsors\/.+\/contacts$/);

    const secondCard = page.locator('.MuiCard-root').filter({ hasText: secondContactName });
    await expect(secondCard).toBeVisible();
    await expect(secondCard.getByText('Primary', { exact: true })).toBeVisible();

    // The first contact's Primary flag cleared, with no error banner anywhere on the page.
    firstCard = page.locator('.MuiCard-root').filter({ hasText: firstContactName });
    await expect(firstCard.getByText('Primary', { exact: true })).not.toBeVisible();
    await expect(page.getByText(/went wrong/i)).not.toBeVisible();

    // Reload — the auto-unset persisted server-side, not just in the mutation response.
    await page.reload();
    firstCard = page.locator('.MuiCard-root').filter({ hasText: firstContactName });
    await expect(firstCard.getByText('Primary', { exact: true })).not.toBeVisible();
    const secondCardAfterReload = page.locator('.MuiCard-root').filter({ hasText: secondContactName });
    await expect(secondCardAfterReload.getByText('Primary', { exact: true })).toBeVisible();

    // Deactivate the first contact.
    await expect(firstCard.getByRole('button', { name: 'Deactivate' })).toBeVisible();
    await firstCard.getByRole('button', { name: 'Deactivate' }).click();
    await expect(firstCard.getByText('Inactive')).toBeVisible();
    await expect(firstCard.getByRole('button', { name: 'Reactivate' })).toBeVisible();

    // Reload — deactivated state persisted server-side.
    await page.reload();
    firstCard = page.locator('.MuiCard-root').filter({ hasText: firstContactName });
    await expect(firstCard.getByText('Inactive')).toBeVisible();
    await expect(firstCard.getByRole('button', { name: 'Reactivate' })).toBeVisible();

    // Reactivate it.
    await firstCard.getByRole('button', { name: 'Reactivate' }).click();
    await expect(firstCard.getByText('Inactive')).not.toBeVisible();
    await expect(firstCard.getByRole('button', { name: 'Deactivate' })).toBeVisible();

    // Reload — reactivated state persisted too.
    await page.reload();
    firstCard = page.locator('.MuiCard-root').filter({ hasText: firstContactName });
    await expect(firstCard.getByText('Inactive')).not.toBeVisible();
    await expect(firstCard.getByRole('button', { name: 'Deactivate' })).toBeVisible();
  });
});
