import { test, expect } from '@playwright/test';

/**
 * E2E golden path for docs/specs/028-players.md. Per the spec's Test Plan (E2E row) and
 * Acceptance Criteria: log in as a CLUB_ADMIN-provisioned test user, open Players from the
 * dashboard, confirm it's a real screen (not 006's old "Coming soon" EmptyState placeholder), add
 * a player across all three PlayerForm tabs (Basic Info / Contact Info / Cricket Info), confirm it
 * appears in the list, reopen it and confirm every field round-trips on each of those three tabs,
 * tag it to two sections and untag one on the fourth (edit-mode-only) Sections tab, deactivate it
 * (confirm it stays visible, muted "Inactive"), reactivate it, reload and confirm every change
 * persisted server-side.
 *
 * Runs against a real running dev server AND real local Keycloak (not Testcontainers, no mocking)
 * — start all of these before running, same as ui/e2e/manager-teams.spec.ts:
 *   - backend: `cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev` (port 8082)
 *   - frontend: `cd ui && npm run dev` (port 5173)
 *   - Keycloak: `auth.localhost:8180`, realm `cricketlegend`, client `cricketlegend`
 *     (docs/specs/005-admin-login.md's Implementation-time addendum)
 *
 * PREREQUISITE: this reuses the exact same CLUB_ADMIN test account as
 * ui/e2e/manager-club-profile.spec.ts / manager-club-contacts.spec.ts / manager-sponsor-contacts.spec.ts
 * / manager-club-structure.spec.ts / manager-teams.spec.ts (see any of those files' own
 * PREREQUISITE comment, and project memory reference_smoketest_club_admin.md) — provisioned
 * entirely out of band, no in-repo seeding. Provide the same three env vars, no defaults:
 *   export E2E_CLUB_ADMIN_USERNAME=smoketest-club-admin
 *   export E2E_CLUB_ADMIN_PASSWORD='SmokeTest123!'
 *   export E2E_CLUB_ADMIN_CLUB_ID=<that club's id>
 *
 * NOT run in CI (matching every other Keycloak-dependent spec in this repo, e.g.
 * manager-teams.spec.ts) — `.github/workflows/ci.yml`'s `e2e-smoke` job has no Keycloak. Skips
 * itself whenever process.env.CI is set rather than failing that job.
 */

const ROOT_DOMAIN = process.env.E2E_ROOT_DOMAIN ?? 'localhost:5173';
const CLUB_ADMIN_USERNAME = process.env.E2E_CLUB_ADMIN_USERNAME;
const CLUB_ADMIN_PASSWORD = process.env.E2E_CLUB_ADMIN_PASSWORD;
const CLUB_ADMIN_CLUB_ID = process.env.E2E_CLUB_ADMIN_CLUB_ID;

async function completeKeycloakLogin(page: import('@playwright/test').Page) {
  // Keycloak's own login form — not part of this app, so no shared component/selector to reuse
  // (same helper shape as manager-teams.spec.ts's completeKeycloakLogin).
  await page.getByLabel('Username or email').fill(CLUB_ADMIN_USERNAME as string);
  await page.getByLabel('Password', { exact: true }).fill(CLUB_ADMIN_PASSWORD as string);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

async function loginAsClubAdmin(page: import('@playwright/test').Page) {
  await page.goto(`http://${ROOT_DOMAIN}/login`);
  await completeKeycloakLogin(page);
}

// Adds one top-level section via Club Structure's tree editor, renames it to `name`, and leaves it
// selected (auto-selected on create, per SectionTreeEditor) — byte-for-byte
// manager-teams.spec.ts's own addTopLevelSection helper, duplicated here rather than shared
// (no cross-file e2e helper module exists in this repo — every spec keeps its own copy, per
// manager-teams.spec.ts's own precedent copying it from manager-club-structure.spec.ts). Races the
// two possible end states of the tree (first-run empty vs. a tree already exists from prior
// manual/e2e runs), same reasoning as manager-club-structure.spec.ts's own comment on this exact
// race. Called twice in a row here (once per section this spec's own tagging flow needs), which
// works unmodified since it never navigates away from /manage/sections.
async function addTopLevelSection(page: import('@playwright/test').Page, name: string) {
  const startBlankButton = page.getByRole('button', { name: 'Start blank' });
  const addTopLevelButton = page.getByRole('button', { name: /add top-level section/i });
  await expect(startBlankButton.or(addTopLevelButton)).toBeVisible();
  if (await startBlankButton.isVisible()) {
    await startBlankButton.click();
  }

  await addTopLevelButton.click();
  const nameField = page.getByRole('textbox', { name: 'Name', exact: true });
  await expect(nameField).toHaveValue('New section');
  await nameField.fill(name);
  await nameField.blur();
  await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
}

test.describe('Players golden path (028-players.md)', () => {
  test.beforeEach(() => {
    test.skip(!!process.env.CI, 'requires local Keycloak — not wired into CI yet, see docs/plans/005-admin-login.md Flag #2');
    test.skip(
      !CLUB_ADMIN_USERNAME || !CLUB_ADMIN_PASSWORD || !CLUB_ADMIN_CLUB_ID,
      'requires E2E_CLUB_ADMIN_USERNAME / E2E_CLUB_ADMIN_PASSWORD / E2E_CLUB_ADMIN_CLUB_ID — no default CLUB_ADMIN fixture exists in this repo, see this file\'s PREREQUISITE comment',
    );
  });

  test('club admin adds a player across all three form tabs, tags/untags sections, deactivates and reactivates it, and every change persists', async ({
    page,
  }) => {
    // Date.now() alone can collide across projects (desktop-chromium/mobile-chromium run in
    // parallel workers and can land in the same millisecond) — appending a random component
    // avoids that, per manager-sponsor-contacts.spec.ts's own fix for the same issue.
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sectionAName = `E2E Player Section A ${uniqueSuffix}`;
    const sectionBName = `E2E Player Section B ${uniqueSuffix}`;
    const firstName = 'Amara';
    const lastName = `E2E Player ${uniqueSuffix}`;
    const fullName = `${firstName} ${lastName}`;
    const dateOfBirth = '2011-06-15';
    const membershipNumber = `MEM-${uniqueSuffix}`;
    const phone = '+27 21 555 0177';
    const email = `e2e-amara-${uniqueSuffix}@example.com`;
    const altContactName = `Nomvula ${lastName}`;
    const altContactPhone = '+27 21 555 0188';

    await loginAsClubAdmin(page);
    await expect(page).toHaveURL(new RegExp('/manage$'));
    await expect(page.getByText('Not authorized')).not.toBeVisible();

    // --- Build two sections up front (via Club Structure), for this spec's own tagging flow ---

    await page.getByRole('link', { name: 'Club Structure' }).click();
    await expect(page).toHaveURL(/\/manage\/sections$/);
    await addTopLevelSection(page, sectionAName);
    await addTopLevelSection(page, sectionBName);

    // --- Dashboard -> Players: a real list, not 006's old "Coming soon" placeholder ---

    await page.goto(`http://${ROOT_DOMAIN}/manage`);
    await page.getByRole('link', { name: 'Players' }).click();
    await expect(page).toHaveURL(/\/manage\/players$/);
    await expect(page.getByRole('heading', { name: 'Players' })).toBeVisible();
    await expect(page.getByText('Coming soon')).not.toBeVisible();

    // --- Add a player: fill all three PlayerForm tabs ---

    await page.getByRole('button', { name: 'Add Player' }).click();
    await expect(page).toHaveURL(/\/manage\/players\/new$/);
    await expect(page.getByRole('heading', { name: 'Add Player' })).toBeVisible();

    // Basic Info — active by default.
    await page.getByLabel('First name').fill(firstName);
    await page.getByLabel('Last name').fill(lastName);
    await page.getByLabel('Date of birth').fill(dateOfBirth);
    await page.getByLabel('Gender').click();
    await page.getByRole('option', { name: 'Male' }).click();
    await page.getByLabel('Club membership number').fill(membershipNumber);

    // Contact Info.
    await page.getByRole('tab', { name: 'Contact Info' }).click();
    await page.getByLabel('Phone').fill(phone);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Alternative contact name').fill(altContactName);
    await page.getByLabel('Alternative contact phone').fill(altContactPhone);

    // Cricket Info.
    await page.getByRole('tab', { name: 'Cricket Info' }).click();
    await page.getByLabel('Batting stance').click();
    await page.getByRole('option', { name: 'Right-handed' }).click();
    await page.getByLabel('Bowling arm').click();
    await page.getByRole('option', { name: 'Right-arm' }).click();
    await page.getByLabel('Bowling type').click();
    await page.getByRole('option', { name: 'Fast', exact: true }).click();
    await page.getByLabel('Wicketkeeper').check();

    await page.getByRole('button', { name: 'Create player' }).click();
    await expect(page).toHaveURL(/\/manage\/players$/);

    // --- Confirm the player appears in the list ---

    let playerCard = page.locator('.MuiCard-root').filter({ hasText: fullName });
    await expect(playerCard).toBeVisible();
    await expect(playerCard.getByText(dateOfBirth)).toBeVisible();
    await expect(playerCard.getByText(membershipNumber)).toBeVisible();

    // --- Open it: all four tabs present, and every field entered above round-trips ---

    await playerCard.getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/manage\/players\/.+\/edit$/);
    await expect(page.getByRole('heading', { name: 'Edit Player' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Basic Info' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Contact Info' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Cricket Info' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Sections' })).toBeVisible();

    // Basic Info — active by default.
    await expect(page.getByLabel('First name')).toHaveValue(firstName);
    await expect(page.getByLabel('Last name')).toHaveValue(lastName);
    await expect(page.getByLabel('Date of birth')).toHaveValue(dateOfBirth);
    await expect(page.getByLabel('Gender')).toHaveText('Male');
    await expect(page.getByLabel('Club membership number')).toHaveValue(membershipNumber);

    // Contact Info.
    await page.getByRole('tab', { name: 'Contact Info' }).click();
    await expect(page.getByLabel('Phone')).toHaveValue(phone);
    await expect(page.getByLabel('Email')).toHaveValue(email);
    await expect(page.getByLabel('Alternative contact name')).toHaveValue(altContactName);
    await expect(page.getByLabel('Alternative contact phone')).toHaveValue(altContactPhone);

    // Cricket Info.
    await page.getByRole('tab', { name: 'Cricket Info' }).click();
    await expect(page.getByLabel('Batting stance')).toHaveText('Right-handed');
    await expect(page.getByLabel('Bowling arm')).toHaveText('Right-arm');
    await expect(page.getByLabel('Bowling type')).toHaveText('Fast');
    await expect(page.getByLabel('Wicketkeeper')).toBeChecked();

    // --- Sections tab (edit-mode only): tag to both sections, then untag one ---

    await page.getByRole('tab', { name: 'Sections' }).click();
    await expect(page.getByText('Not tagged to any sections yet.')).toBeVisible();

    // A real SectionTree in a dialog, not a flat search Autocomplete — docs/specs/028-players.md's
    // own layout refinement (two sections reusing the same leaf name were genuinely ambiguous in
    // a flat dropdown, real user feedback). Both test sections are root-level (no parent), so
    // their tree-item name and their tagged-Chip label are both just the bare section name.
    await page.getByRole('button', { name: 'Link existing' }).click();
    const sectionDialog = page.getByRole('dialog');
    await sectionDialog.getByRole('treeitem', { name: sectionAName, exact: true }).click();
    await expect(page.getByText(sectionAName, { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Link existing' }).click();
    // Already-tagged sectionA still renders in the tree (disabled), it isn't removed from the
    // candidate pool — clicking it must not link it a second time.
    const alreadyTaggedNode = sectionDialog.getByRole('treeitem', { name: sectionAName, exact: true });
    await expect(alreadyTaggedNode).toHaveAttribute('aria-disabled', 'true');
    await sectionDialog.getByRole('treeitem', { name: sectionBName, exact: true }).click();
    await expect(page.getByText(sectionBName, { exact: true })).toBeVisible();

    // Both tags now show. Untag sectionA via its Chip's delete affordance — MUI's built-in delete
    // icon renders as a button with no accessible name of its own, so it's targeted via the
    // chip's own delete-icon class, same as PlayerFormPage.test.tsx's own component-level test for
    // this exact interaction (there, `.closest('.MuiChip-root')`; here, the same
    // `.MuiCard-root`-filter idiom this file already uses elsewhere, applied to `.MuiChip-root`).
    const sectionAChip = page.locator('.MuiChip-root').filter({ hasText: sectionAName });
    await sectionAChip.locator('.MuiChip-deleteIcon').click();
    await expect(page.getByText(sectionAName, { exact: true })).not.toBeVisible();
    await expect(page.getByText(sectionBName, { exact: true })).toBeVisible();

    // --- Back to the list: the one remaining tagged section shows as a chip on the card ---

    await page.getByRole('link', { name: 'Back to Players' }).click();
    await expect(page).toHaveURL(/\/manage\/players$/);

    playerCard = page.locator('.MuiCard-root').filter({ hasText: fullName });
    await expect(playerCard).toBeVisible();
    await expect(playerCard.getByText(sectionBName, { exact: true })).toBeVisible();
    await expect(playerCard.getByText(sectionAName, { exact: true })).not.toBeVisible();

    // --- Deactivate — inactive players stay visible, muted, rather than disappearing ---

    await playerCard.getByRole('button', { name: 'Deactivate' }).click();
    await expect(playerCard.getByText('Inactive')).toBeVisible();
    await expect(playerCard.getByRole('button', { name: 'Reactivate' })).toBeVisible();

    // --- Reactivate it ---

    await playerCard.getByRole('button', { name: 'Reactivate' }).click();
    await expect(playerCard.getByText('Inactive')).not.toBeVisible();
    await expect(playerCard.getByRole('button', { name: 'Deactivate' })).toBeVisible();

    // --- Reload — every change persisted server-side, not just in client state ---

    await page.reload();
    playerCard = page.locator('.MuiCard-root').filter({ hasText: fullName });
    await expect(playerCard).toBeVisible();
    await expect(playerCard.getByText('Inactive')).not.toBeVisible();
    await expect(playerCard.getByRole('button', { name: 'Deactivate' })).toBeVisible();
    await expect(playerCard.getByText(sectionBName, { exact: true })).toBeVisible();
  });
});
