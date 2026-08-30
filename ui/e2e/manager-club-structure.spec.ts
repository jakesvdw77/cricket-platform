import { test, expect } from '@playwright/test';

/**
 * E2E golden path for docs/specs/025-club-structure.md, per its Test Plan and Acceptance
 * Criteria: log in as a CLUB_ADMIN-provisioned test user, open Club Structure, add a top-level
 * section and a child under it, rename both (so each is reliably locatable by unique text for the
 * rest of the test — the plan's own golden path only requires renaming one, but a stable
 * `New section`-named node isn't uniquely selectable across repeated runs), set eligibility
 * (min/max age) on the leaf, link an existing `ClubContact` (created via Club Contacts first, so
 * one deterministically exists to link), create-and-link a brand-new one, confirm the parent's
 * remove control is disabled (with an explanation) while its child is still active, deactivate the
 * child, then deactivate the parent, reload and confirm every change persisted.
 *
 * Runs against a real running dev server AND real local Keycloak (not Testcontainers, no mocking)
 * — start all of these before running, same as ui/e2e/manager-club-profile.spec.ts:
 *   - backend: `cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev` (port 8082)
 *   - frontend: `cd ui && npm run dev` (port 5173)
 *   - Keycloak: `auth.localhost:8180`, realm `cricketlegend`, client `cricketlegend`
 *     (docs/specs/005-admin-login.md's Implementation-time addendum)
 *
 * PREREQUISITE: this reuses the exact same CLUB_ADMIN test account as
 * ui/e2e/manager-club-profile.spec.ts / manager-club-contacts.spec.ts / manager-sponsor-contacts.spec.ts
 * (see any of those files' own PREREQUISITE comment, and project memory
 * reference_smoketest_club_admin.md) — provisioned entirely out of band, no in-repo seeding.
 * Provide the same three env vars, no defaults:
 *   export E2E_CLUB_ADMIN_USERNAME=smoketest-club-admin
 *   export E2E_CLUB_ADMIN_PASSWORD='SmokeTest123!'
 *   export E2E_CLUB_ADMIN_CLUB_ID=<that club's id>
 *
 * NOT run in CI (matching every other Keycloak-dependent spec in this repo, e.g.
 * manager-sponsor-contacts.spec.ts) — `.github/workflows/ci.yml`'s `e2e-smoke` job has no
 * Keycloak. Skips itself whenever process.env.CI is set rather than failing that job.
 */

const ROOT_DOMAIN = process.env.E2E_ROOT_DOMAIN ?? 'localhost:5173';
const CLUB_ADMIN_USERNAME = process.env.E2E_CLUB_ADMIN_USERNAME;
const CLUB_ADMIN_PASSWORD = process.env.E2E_CLUB_ADMIN_PASSWORD;
const CLUB_ADMIN_CLUB_ID = process.env.E2E_CLUB_ADMIN_CLUB_ID;

async function completeKeycloakLogin(page: import('@playwright/test').Page) {
  // Keycloak's own login form — not part of this app, so no shared component/selector to reuse
  // (same helper shape as manager-sponsor-contacts.spec.ts's completeKeycloakLogin).
  await page.getByLabel('Username or email').fill(CLUB_ADMIN_USERNAME as string);
  await page.getByLabel('Password', { exact: true }).fill(CLUB_ADMIN_PASSWORD as string);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

async function loginAsClubAdmin(page: import('@playwright/test').Page) {
  await page.goto(`http://${ROOT_DOMAIN}/login`);
  await completeKeycloakLogin(page);
}

test.describe('Club Structure golden path (025-club-structure.md)', () => {
  test.beforeEach(() => {
    test.skip(!!process.env.CI, 'requires local Keycloak — not wired into CI yet, see docs/plans/005-admin-login.md Flag #2');
    test.skip(
      !CLUB_ADMIN_USERNAME || !CLUB_ADMIN_PASSWORD || !CLUB_ADMIN_CLUB_ID,
      'requires E2E_CLUB_ADMIN_USERNAME / E2E_CLUB_ADMIN_PASSWORD / E2E_CLUB_ADMIN_CLUB_ID — no default CLUB_ADMIN fixture exists in this repo, see this file\'s PREREQUISITE comment',
    );
  });

  test('club admin builds a section tree, links contacts, and the active-child deactivate block is enforced', async ({
    page,
  }) => {
    // Date.now() alone can collide across projects (desktop-chromium/mobile-chromium run in
    // parallel workers and can land in the same millisecond) — appending a random component
    // avoids that, per manager-sponsor-contacts.spec.ts's own fix for the same issue.
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const parentName = `E2E Open Sides ${uniqueSuffix}`;
    const childName = `E2E 1st XI ${uniqueSuffix}`;
    const existingContactLastName = `Existing ${uniqueSuffix}`;
    const existingContactFullName = `Alice ${existingContactLastName}`;
    const newContactLastName = `New ${uniqueSuffix}`;
    const newContactFullName = `Bob ${newContactLastName}`;

    await loginAsClubAdmin(page);
    await expect(page).toHaveURL(new RegExp('/manage$'));
    await expect(page.getByText('Not authorized')).not.toBeVisible();

    // Create a ClubContact up front via Club Contacts, so one deterministically exists to link
    // via Club Structure's "Link existing" flow below.
    await page.getByRole('link', { name: 'Club Contacts' }).click();
    await expect(page).toHaveURL(/\/manage\/club-contacts$/);
    await page.getByRole('button', { name: 'Add Contact' }).click();
    await expect(page).toHaveURL(/\/manage\/club-contacts\/new$/);
    await page.getByLabel('First name').fill('Alice');
    await page.getByLabel('Last name').fill(existingContactLastName);
    await page.getByLabel('Email').fill(`e2e-alice-${uniqueSuffix}@example.com`);
    await page.getByLabel('Phone').fill('+27 21 555 0100');
    await page.getByLabel('Role').fill('Treasurer');
    await page.getByRole('button', { name: 'Create contact' }).click();
    await expect(page).toHaveURL(/\/manage\/club-contacts$/);
    await expect(page.locator('.MuiCard-root').filter({ hasText: existingContactFullName })).toBeVisible();

    // Dashboard -> Club Structure.
    await page.goto(`http://${ROOT_DOMAIN}/manage`);
    await page.getByRole('link', { name: 'Club Structure' }).click();
    await expect(page).toHaveURL(/\/manage\/sections$/);

    // First-run empty state, or a tree already exists from prior manual/e2e testing — either
    // way, "Start blank" (when offered) just leaves whatever's already there and lets us build
    // our own uniquely-named nodes on top.
    const startBlankButton = page.getByRole('button', { name: 'Start blank' });
    if (await startBlankButton.isVisible().catch(() => false)) {
      await startBlankButton.click();
    }

    // Add a top-level section, then rename it via the detail panel (auto-selected on create).
    await page.getByRole('button', { name: /add top-level section/i }).click();
    const nameField = page.getByRole('textbox', { name: 'Name', exact: true });
    await expect(nameField).toHaveValue('New section');
    await nameField.fill(parentName);
    await nameField.blur();
    await expect(page.getByRole('button', { name: parentName, exact: true })).toBeVisible();

    // Add a child under it, then rename that too.
    await page.getByRole('button', { name: `Add a child section under ${parentName}` }).click();
    await expect(nameField).toHaveValue('New section');
    await nameField.fill(childName);
    await nameField.blur();
    await expect(page.getByRole('button', { name: childName, exact: true })).toBeVisible();

    // Set eligibility (min/max age) on the child leaf.
    const minAgeField = page.getByLabel('Minimum age');
    const maxAgeField = page.getByLabel('Maximum age');
    await minAgeField.fill('11');
    await minAgeField.blur();
    await maxAgeField.fill('13');
    await maxAgeField.blur();
    await expect(page.getByText(/minimum age must not be greater than maximum age/i)).not.toBeVisible();

    // Link the existing contact.
    await page.getByRole('button', { name: 'Link existing' }).click();
    await page.getByRole('combobox', { name: 'Search contacts' }).click();
    await page.getByRole('option', { name: new RegExp(existingContactFullName) }).click();
    await expect(page.getByText(existingContactFullName, { exact: true })).toBeVisible();

    // Create-and-link a brand-new contact, without leaving Club Structure.
    await page.getByRole('button', { name: '+ New contact' }).click();
    await page.getByLabel('First name').fill('Bob');
    await page.getByLabel('Last name').fill(newContactLastName);
    await page.getByLabel('Email').fill(`e2e-bob-${uniqueSuffix}@example.com`);
    await page.getByLabel('Phone').fill('+27 21 555 0199');
    await page.getByLabel('Role').fill('Coach');
    await page.getByRole('button', { name: 'Create & link' }).click();
    await expect(page.getByText(newContactFullName, { exact: true })).toBeVisible();

    // Select the parent — its remove control is disabled while the child is still active, with
    // an explanation (the client derives this from the same flat sections list, no failed
    // request needed to prove the block — see SectionTreeEditor's own canRemove logic).
    await page.getByRole('button', { name: parentName, exact: true }).click();
    const removeParentButton = page.getByRole('button', { name: `Remove ${parentName}` });
    await expect(removeParentButton).toBeDisabled();
    // A disabled <button> can't itself receive pointer events for MUI's Tooltip, so it wraps a
    // <span> to host the hover — same reasoning as SectionTreeEditor.test.tsx's own component test.
    await removeParentButton.locator('xpath=ancestor::span[1]').first().hover();
    await expect(page.getByText(/active sub-section/i)).toBeVisible();

    // Deactivate the child leaf.
    await page.getByRole('button', { name: childName, exact: true }).click();
    await page.getByRole('button', { name: `Remove ${childName}` }).click();
    await expect(page.getByText('This section is inactive.')).toBeVisible();

    // Now the parent's remove control is enabled — its only child is inactive.
    await page.getByRole('button', { name: parentName, exact: true }).click();
    await expect(removeParentButton).toBeEnabled();
    await removeParentButton.click();
    await expect(page.getByText('This section is inactive.')).toBeVisible();

    // Reload — every change persisted server-side, not just in client state.
    await page.reload();
    await expect(page.getByRole('button', { name: parentName, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: childName, exact: true })).toBeVisible();

    await page.getByRole('button', { name: childName, exact: true }).click();
    await expect(page.getByText('This section is inactive.')).toBeVisible();
    await expect(page.getByLabel('Minimum age')).toHaveValue('11');
    await expect(page.getByLabel('Maximum age')).toHaveValue('13');
    await expect(page.getByText(existingContactFullName, { exact: true })).toBeVisible();
    await expect(page.getByText(newContactFullName, { exact: true })).toBeVisible();

    await page.getByRole('button', { name: parentName, exact: true }).click();
    await expect(page.getByText('This section is inactive.')).toBeVisible();
  });
});
