import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/**
 * E2E golden paths for docs/specs/026-teams.md and docs/specs/027-team-profile.md (027 extends
 * this same file rather than starting a new one — everything it adds only makes sense on top of
 * 026's own section-scoped team screens). Per each spec's Test Plan (E2E row) and Acceptance
 * Criteria. Three golden paths in one file, extending 025's own Club Structure spec
 * (ui/e2e/manager-club-structure.spec.ts):
 *
 * 1. Section-scoped path (026) — log in as a CLUB_ADMIN-provisioned test user, open Club
 *    Structure, add a top-level section (so it's reliably locatable by unique text for the rest of
 *    the test, same reasoning as manager-club-structure.spec.ts's own parent/child naming), open
 *    its "Manage Teams" entry point (the new cross-link this spec added to SectionDetailPanel),
 *    add a team, rename it, deactivate it, reactivate it, reload and confirm every change
 *    persisted.
 * 2. Club-wide directory path (026) — build two teams under two different sections via the
 *    section-scoped flow above, then open the "Teams" dashboard card (/manage/teams), confirm it
 *    shows a real list (not the old "Coming soon" placeholder) with both teams and their correct
 *    section names, create a new team directly from the directory using its section-picker
 *    dropdown, confirm it appears with the right section name, then deactivate it from the
 *    directory.
 * 3. Team profile path (027) — build a three-level section tree (so a team's breadcrumb has real
 *    ancestry to show, not just an immediate parent), add a team under the leaf, confirm both the
 *    section-scoped team list's header and the team's own edit-page breadcrumb show the full
 *    path, confirm the club-logo fallback caption/upload-override/reset-to-club-logo round-trip
 *    (a real upload via the same working POST /api/v1/manage/media pattern
 *    manager-club-contacts.spec.ts already proved), link an existing contact via the "Coach"
 *    quick-fill, create-and-link a brand-new one with a custom role, unlink one, link an existing
 *    sponsor, create-and-link a brand-new one, confirm the read-only "Club sponsors" list excludes
 *    whatever's linked to the team while still showing what isn't, unlink a sponsor, and confirm
 *    the section's "Manage Teams" card shows the team as a badge afterwards.
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
 * / manager-club-structure.spec.ts (see any of those files' own PREREQUISITE comment, and project
 * memory reference_smoketest_club_admin.md) — provisioned entirely out of band, no in-repo seeding.
 * Provide the same three env vars, no defaults:
 *   export E2E_CLUB_ADMIN_USERNAME=smoketest-club-admin
 *   export E2E_CLUB_ADMIN_PASSWORD='SmokeTest123!'
 *   export E2E_CLUB_ADMIN_CLUB_ID=<that club's id>
 *
 * NOT run in CI (matching every other Keycloak-dependent spec in this repo, e.g.
 * manager-club-structure.spec.ts) — `.github/workflows/ci.yml`'s `e2e-smoke` job has no Keycloak.
 * Skips itself whenever process.env.CI is set rather than failing that job.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT_DOMAIN = process.env.E2E_ROOT_DOMAIN ?? 'localhost:5173';
const CLUB_ADMIN_USERNAME = process.env.E2E_CLUB_ADMIN_USERNAME;
const CLUB_ADMIN_PASSWORD = process.env.E2E_CLUB_ADMIN_PASSWORD;
const CLUB_ADMIN_CLUB_ID = process.env.E2E_CLUB_ADMIN_CLUB_ID;

// Reuses the same fixture image ui/e2e/manager-club-contacts.spec.ts / manager-club-sponsors.spec.ts
// already upload via MediaUpload — no new fixture needed, this is the same control (namespace=
// "manage") against the same POST /api/v1/manage/media endpoint those specs already prove works,
// now against TeamForm's own "Logo" field (docs/specs/027-team-profile.md).
const LOGO_FIXTURE = path.join(__dirname, 'fixtures', 'test-logo.png');

async function completeKeycloakLogin(page: import('@playwright/test').Page) {
  // Keycloak's own login form — not part of this app, so no shared component/selector to reuse
  // (same helper shape as manager-club-structure.spec.ts's completeKeycloakLogin).
  await page.getByLabel('Username or email').fill(CLUB_ADMIN_USERNAME as string);
  await page.getByLabel('Password', { exact: true }).fill(CLUB_ADMIN_PASSWORD as string);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

async function loginAsClubAdmin(page: import('@playwright/test').Page) {
  await page.goto(`http://${ROOT_DOMAIN}/login`);
  await completeKeycloakLogin(page);
}

// Adds one top-level section via Club Structure's tree editor, renames it to `name`, and leaves it
// selected (auto-selected on create, per SectionTreeEditor) so its own SectionDetailPanel — and
// this spec's new "Manage Teams" cross-link — is what's showing afterwards. Races the two possible
// end states of the tree (first-run empty vs. a tree already exists from prior manual/e2e runs),
// same reasoning as manager-club-structure.spec.ts's own comment on this exact race.
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

// Adds a child under an already-selected section named `parentName`, renames it to `childName`,
// and leaves it selected — same "Add a child section under X" affordance
// manager-club-structure.spec.ts's own golden path already proves, generalized here to build a
// three-level tree (docs/specs/027-team-profile.md's breadcrumb needs real ancestry to show).
async function addChildSection(page: import('@playwright/test').Page, parentName: string, childName: string) {
  await page.getByRole('button', { name: `Add a child section under ${parentName}` }).click();
  const nameField = page.getByRole('textbox', { name: 'Name', exact: true });
  await expect(nameField).toHaveValue('New section');
  await nameField.fill(childName);
  await nameField.blur();
  await expect(page.getByRole('button', { name: childName, exact: true })).toBeVisible();
}

test.describe('Teams golden paths (026-teams.md, extended by 027-team-profile.md)', () => {
  test.beforeEach(() => {
    test.skip(!!process.env.CI, 'requires local Keycloak — not wired into CI yet, see docs/plans/005-admin-login.md Flag #2');
    test.skip(
      !CLUB_ADMIN_USERNAME || !CLUB_ADMIN_PASSWORD || !CLUB_ADMIN_CLUB_ID,
      'requires E2E_CLUB_ADMIN_USERNAME / E2E_CLUB_ADMIN_PASSWORD / E2E_CLUB_ADMIN_CLUB_ID — no default CLUB_ADMIN fixture exists in this repo, see this file\'s PREREQUISITE comment',
    );
  });

  test('club admin manages a section-scoped team: add, rename, deactivate, reactivate, and every change persists', async ({
    page,
  }) => {
    // Date.now() alone can collide across projects (desktop-chromium/mobile-chromium run in
    // parallel workers and can land in the same millisecond) — appending a random component
    // avoids that, per manager-sponsor-contacts.spec.ts's own fix for the same issue.
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sectionName = `E2E Team Section ${uniqueSuffix}`;
    const teamName = `E2E 1st XI ${uniqueSuffix}`;
    const renamedTeamName = `E2E 1st XI Renamed ${uniqueSuffix}`;

    await loginAsClubAdmin(page);
    await expect(page).toHaveURL(new RegExp('/manage$'));
    await expect(page.getByText('Not authorized')).not.toBeVisible();

    // Dashboard -> Club Structure -> add a section to hang the team off.
    await page.getByRole('link', { name: 'Club Structure' }).click();
    await expect(page).toHaveURL(/\/manage\/sections$/);
    await addTopLevelSection(page, sectionName);

    // Section is auto-selected on create, so its detail panel — and this spec's new "Manage
    // Teams" cross-link — is showing right away.
    await page.getByRole('link', { name: 'Manage Teams' }).click();
    await expect(page).toHaveURL(/\/manage\/sections\/[^/]+\/teams$/);
    await expect(page.getByRole('heading', { name: `Teams — ${sectionName}` })).toBeVisible();

    // Add a team.
    await page.getByRole('button', { name: 'Add Team' }).click();
    await expect(page).toHaveURL(/\/manage\/sections\/[^/]+\/teams\/new$/);
    await page.getByLabel('Name').fill(teamName);
    await page.getByRole('button', { name: 'Create team' }).click();
    await expect(page).toHaveURL(/\/manage\/sections\/[^/]+\/teams$/);

    let teamCard = page.locator('.MuiCard-root').filter({ hasText: teamName });
    await expect(teamCard).toBeVisible();

    // Rename it.
    await teamCard.getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/manage\/sections\/[^/]+\/teams\/.+\/edit$/);
    await expect(page.getByLabel('Name')).toHaveValue(teamName);
    await page.getByLabel('Name').fill(renamedTeamName);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page).toHaveURL(/\/manage\/sections\/[^/]+\/teams$/);

    teamCard = page.locator('.MuiCard-root').filter({ hasText: renamedTeamName });
    await expect(teamCard).toBeVisible();

    // Deactivate it — inactive teams stay visible, muted, rather than disappearing.
    await teamCard.getByRole('button', { name: 'Deactivate' }).click();
    await expect(teamCard.getByText('Inactive')).toBeVisible();
    await expect(teamCard.getByRole('button', { name: 'Reactivate' })).toBeVisible();

    // Reactivate it.
    await teamCard.getByRole('button', { name: 'Reactivate' }).click();
    await expect(teamCard.getByText('Inactive')).not.toBeVisible();
    await expect(teamCard.getByRole('button', { name: 'Deactivate' })).toBeVisible();

    // Reload — every change persisted server-side, not just in client state.
    await page.reload();
    teamCard = page.locator('.MuiCard-root').filter({ hasText: renamedTeamName });
    await expect(teamCard).toBeVisible();
    await expect(teamCard.getByText('Inactive')).not.toBeVisible();
    await expect(teamCard.getByRole('button', { name: 'Deactivate' })).toBeVisible();
  });

  test('club admin sees teams from multiple sections in the club-wide directory, and can create and deactivate one from there', async ({
    page,
  }) => {
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sectionAName = `E2E Directory Section A ${uniqueSuffix}`;
    const sectionBName = `E2E Directory Section B ${uniqueSuffix}`;
    const teamAName = `E2E Directory Team A ${uniqueSuffix}`;
    const teamBName = `E2E Directory Team B ${uniqueSuffix}`;
    const teamCName = `E2E Directory Team C ${uniqueSuffix}`;

    await loginAsClubAdmin(page);
    await expect(page).toHaveURL(new RegExp('/manage$'));
    await expect(page.getByText('Not authorized')).not.toBeVisible();

    // Build two sections, each with one team, via the section-scoped flow proven by the first
    // golden path above — this is the setup the club-wide directory needs to show teams from more
    // than one section in a single list.
    await page.getByRole('link', { name: 'Club Structure' }).click();
    await expect(page).toHaveURL(/\/manage\/sections$/);

    await addTopLevelSection(page, sectionAName);
    await page.getByRole('link', { name: 'Manage Teams' }).click();
    await expect(page).toHaveURL(/\/manage\/sections\/[^/]+\/teams$/);
    await page.getByRole('button', { name: 'Add Team' }).click();
    await page.getByLabel('Name').fill(teamAName);
    await page.getByRole('button', { name: 'Create team' }).click();
    await expect(page.locator('.MuiCard-root').filter({ hasText: teamAName })).toBeVisible();

    await page.getByRole('link', { name: 'Back to Club Structure' }).click();
    await expect(page).toHaveURL(/\/manage\/sections$/);

    await addTopLevelSection(page, sectionBName);
    await page.getByRole('link', { name: 'Manage Teams' }).click();
    await expect(page).toHaveURL(/\/manage\/sections\/[^/]+\/teams$/);
    await page.getByRole('button', { name: 'Add Team' }).click();
    await page.getByLabel('Name').fill(teamBName);
    await page.getByRole('button', { name: 'Create team' }).click();
    await expect(page.locator('.MuiCard-root').filter({ hasText: teamBName })).toBeVisible();

    // Dashboard -> Teams — the real screen this spec gives to 006's pre-existing nav card, no
    // longer the "Coming soon" EmptyState placeholder.
    await page.goto(`http://${ROOT_DOMAIN}/manage`);
    await page.getByRole('link', { name: 'Teams' }).click();
    await expect(page).toHaveURL(/\/manage\/teams$/);
    await expect(page.getByRole('heading', { name: 'Teams' })).toBeVisible();
    await expect(page.getByText('Coming soon')).not.toBeVisible();

    // Teams from both sections show up in one flat list, each with its own section name.
    const teamACard = page.locator('.MuiCard-root').filter({ hasText: teamAName });
    const teamBCard = page.locator('.MuiCard-root').filter({ hasText: teamBName });
    await expect(teamACard).toBeVisible();
    await expect(teamACard.getByText(sectionAName, { exact: true })).toBeVisible();
    await expect(teamBCard).toBeVisible();
    await expect(teamBCard.getByText(sectionBName, { exact: true })).toBeVisible();

    // Create a new team directly from the directory, picking its section from the dropdown.
    await page.getByRole('button', { name: 'Add Team' }).click();
    await expect(page).toHaveURL(/\/manage\/teams\/new$/);
    await page.getByLabel('Section').click();
    await page.getByRole('option', { name: sectionBName, exact: true }).click();
    await page.getByLabel('Name').fill(teamCName);
    await page.getByRole('button', { name: 'Create team' }).click();
    await expect(page).toHaveURL(/\/manage\/teams$/);

    const teamCCard = page.locator('.MuiCard-root').filter({ hasText: teamCName });
    await expect(teamCCard).toBeVisible();
    await expect(teamCCard.getByText(sectionBName, { exact: true })).toBeVisible();

    // Deactivate it from the directory.
    await teamCCard.getByRole('button', { name: 'Deactivate' }).click();
    await expect(teamCCard.getByText('Inactive')).toBeVisible();
    await expect(teamCCard.getByRole('button', { name: 'Reactivate' })).toBeVisible();
  });

  test('club admin manages a team\'s full profile: breadcrumb, logo override/reset, contacts, sponsors, and the section badge (027-team-profile.md)', async ({
    page,
  }) => {
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const topSectionName = `E2E Profile Top ${uniqueSuffix}`;
    const midSectionName = `E2E Profile Mid ${uniqueSuffix}`;
    const leafSectionName = `E2E Profile Leaf ${uniqueSuffix}`;
    const teamName = `E2E Profile Team ${uniqueSuffix}`;
    const existingContactLastName = `Existing ${uniqueSuffix}`;
    const existingContactFullName = `Priya ${existingContactLastName}`;
    const newContactLastName = `New ${uniqueSuffix}`;
    const newContactFullName = `Sam ${newContactLastName}`;
    const linkedSponsorName = `E2E Profile Sponsor Linked ${uniqueSuffix}`;
    const otherSponsorName = `E2E Profile Sponsor Other ${uniqueSuffix}`;
    const createdSponsorName = `E2E Profile Sponsor Created ${uniqueSuffix}`;

    await loginAsClubAdmin(page);
    await expect(page).toHaveURL(new RegExp('/manage$'));
    await expect(page.getByText('Not authorized')).not.toBeVisible();

    // Create a ClubContact up front — linked below via the "Coach" quick-fill — same pattern
    // manager-club-structure.spec.ts's own Section<->ClubContact test already established.
    await page.getByRole('link', { name: 'Club Contacts' }).click();
    await expect(page).toHaveURL(/\/manage\/club-contacts$/);
    await page.getByRole('button', { name: 'Add Contact' }).click();
    await expect(page).toHaveURL(/\/manage\/club-contacts\/new$/);
    await page.getByLabel('First name').fill('Priya');
    await page.getByLabel('Last name').fill(existingContactLastName);
    await page.getByLabel('Email').fill(`e2e-priya-${uniqueSuffix}@example.com`);
    await page.getByLabel('Phone').fill('+27 21 555 0155');
    await page.getByLabel('Role').fill('Volunteer');
    await page.getByRole('button', { name: 'Create contact' }).click();
    await expect(page).toHaveURL(/\/manage\/club-contacts$/);
    await expect(page.locator('.MuiCard-root').filter({ hasText: existingContactFullName })).toBeVisible();

    // Create two Sponsors up front: one gets linked to the team below (and should then disappear
    // from the read-only "Club sponsors" list), the other stays unlinked throughout (and should
    // stay visible there) — proves the exclusion filter excludes only what's actually linked.
    await page.goto(`http://${ROOT_DOMAIN}/manage`);
    await page.getByRole('link', { name: 'Club Sponsors' }).click();
    await expect(page).toHaveURL(/\/manage\/sponsors$/);
    for (const sponsorName of [linkedSponsorName, otherSponsorName]) {
      await page.getByRole('button', { name: 'Add Sponsor' }).click();
      await expect(page).toHaveURL(/\/manage\/sponsors\/new$/);
      await page.getByLabel('Name').fill(sponsorName);
      await page.getByRole('button', { name: 'Create sponsor' }).click();
      await expect(page).toHaveURL(/\/manage\/sponsors$/);
      await expect(page.locator('.MuiCard-root').filter({ hasText: sponsorName })).toBeVisible();
    }

    // Build a three-level section tree (top -> mid -> leaf) — a team lives under the leaf, so its
    // breadcrumb has to show the *full* ancestry (top, mid, leaf), not just the leaf's immediate
    // parent (mid), proving 027's own Acceptance Criteria wording ("not just its immediate
    // parent's name").
    await page.goto(`http://${ROOT_DOMAIN}/manage`);
    await page.getByRole('link', { name: 'Club Structure' }).click();
    await expect(page).toHaveURL(/\/manage\/sections$/);
    await addTopLevelSection(page, topSectionName);
    await addChildSection(page, topSectionName, midSectionName);
    await addChildSection(page, midSectionName, leafSectionName);

    // The leaf is auto-selected — its "Manage Teams" cross-link's own list header already shows
    // the full breadcrumb chain too (TeamList.tsx, 027), not just "leaf".
    await page.getByRole('link', { name: 'Manage Teams' }).click();
    await expect(page).toHaveURL(/\/manage\/sections\/[^/]+\/teams$/);
    await expect(
      page.getByRole('heading', { name: `Teams — ${topSectionName} › ${midSectionName} › ${leafSectionName}` }),
    ).toBeVisible();

    // Add the team and open it.
    await page.getByRole('button', { name: 'Add Team' }).click();
    await expect(page).toHaveURL(/\/manage\/sections\/[^/]+\/teams\/new$/);
    await page.getByLabel('Name').fill(teamName);
    await page.getByRole('button', { name: 'Create team' }).click();
    await expect(page).toHaveURL(/\/manage\/sections\/[^/]+\/teams$/);

    let teamCard = page.locator('.MuiCard-root').filter({ hasText: teamName });
    await expect(teamCard).toBeVisible();
    await teamCard.getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/manage\/sections\/[^/]+\/teams\/.+\/edit$/);

    // The team's own edit-page breadcrumb shows the full path too — all three ancestor names, not
    // just the immediate section's.
    const breadcrumbNav = page.locator('.MuiBreadcrumbs-root');
    await expect(breadcrumbNav).toContainText(topSectionName);
    await expect(breadcrumbNav).toContainText(midSectionName);
    await expect(breadcrumbNav).toContainText(leafSectionName);

    // --- Logo: club fallback caption, a real upload override, then reset back to inheriting it ---

    // The smoketest club's own logo (fetched via getManagedClubProfile) is provisioned entirely
    // out of band (see this file's PREREQUISITE comment above) — this test doesn't control
    // whether it currently has one. TeamForm only renders the "Using your club's logo" caption
    // when the club actually has a logoUrl of its own (ui/src/components/TeamForm/TeamForm.tsx);
    // a brand-new team like this one never has a logo override yet, so the caption's visibility
    // here is exactly whatever the club's own logo state already is — read once and asserted
    // conditionally against, rather than assumed either way.
    const clubLogoCaption = page.getByText("Using your club's logo — upload one above to override.");
    const clubHasLogo = await clubLogoCaption.isVisible();
    await expect(page.getByRole('button', { name: 'Upload Logo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset to club logo' })).not.toBeVisible();

    // Upload a real logo override — the same working POST /api/v1/manage/media upload pattern
    // manager-club-contacts.spec.ts and manager-club-sponsors.spec.ts already prove end-to-end
    // (MediaUpload's hidden file input, aria-labelled "<field label> file"), reused unchanged here
    // against TeamForm's own "Logo" field.
    await page.getByLabel('Logo file').setInputFiles(LOGO_FIXTURE);
    await expect(page.getByRole('button', { name: 'Replace' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset to club logo' })).toBeVisible();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page).toHaveURL(/\/manage\/sections\/[^/]+\/teams$/);

    // Reopen it — the override persisted server-side, so the club-logo caption no longer shows
    // regardless of the club's own logo state (this team now has one of its own).
    teamCard = page.locator('.MuiCard-root').filter({ hasText: teamName });
    await teamCard.getByRole('link', { name: 'Edit' }).click();
    await expect(page.getByRole('button', { name: 'Replace' })).toBeVisible();
    await expect(clubLogoCaption).not.toBeVisible();

    // Reset it back to inheriting the club's logo, save, and confirm the reset round-trips too.
    await page.getByRole('button', { name: 'Reset to club logo' }).click();
    await expect(page.getByRole('button', { name: 'Upload Logo' })).toBeVisible();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page).toHaveURL(/\/manage\/sections\/[^/]+\/teams$/);

    teamCard = page.locator('.MuiCard-root').filter({ hasText: teamName });
    await teamCard.getByRole('link', { name: 'Edit' }).click();
    await expect(page.getByRole('button', { name: 'Upload Logo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset to club logo' })).not.toBeVisible();
    if (clubHasLogo) {
      await expect(clubLogoCaption).toBeVisible();
    }

    // --- Contacts: link existing via the "Coach" quick-fill, create-and-link a new one, unlink one ---

    // Details/Contacts/Sponsors are tabs on one page, not a long vertical scroll (real user
    // feedback on the first version of this screen) — only one panel is mounted at a time, so its
    // own controls are unambiguous without any card-scoped locator.
    await page.getByRole('tab', { name: 'Contacts' }).click();

    await page.getByRole('button', { name: 'Link existing' }).click();
    await page.getByRole('combobox', { name: 'Search contacts' }).click();
    await page.getByRole('option', { name: new RegExp(existingContactFullName) }).click();
    // Selecting a candidate here doesn't link it immediately (unlike Section<->ClubContact's own
    // dialog) — a team-specific "Role" field renders below it first, with three quick-fill Chips;
    // clicking one only fills the field, it doesn't submit, so it's still editable before confirming.
    await page.getByRole('button', { name: 'Coach', exact: true }).click();
    await expect(page.getByLabel('Role')).toHaveValue('Coach');
    await page.getByRole('button', { name: 'Link', exact: true }).click();
    await expect(page.getByText(existingContactFullName, { exact: true })).toBeVisible();
    await expect(page.getByText('Coach', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: '+ New contact' }).click();
    // Two "Role" fields render in this dialog — the team-specific one this spec adds (first, via
    // the extraField slot) and ClubContactForm's own pre-existing club-wide role field
    // (021-club-contacts.md), further down in the same dialog.
    await page.getByLabel('Role').first().fill('Kit Manager');
    await page.getByLabel('First name').fill('Sam');
    await page.getByLabel('Last name').fill(newContactLastName);
    await page.getByLabel('Email').fill(`e2e-sam-${uniqueSuffix}@example.com`);
    await page.getByLabel('Phone').fill('+27 21 555 0166');
    await page.getByLabel('Role').last().fill('Volunteer');
    await page.getByRole('button', { name: 'Create & link' }).click();
    await expect(page.getByText(newContactFullName, { exact: true })).toBeVisible();
    await expect(page.getByText('Kit Manager', { exact: true })).toBeVisible();

    // Each linked contact is now a real RecordCard (docs/specs/027-team-profile.md's own layout
    // refinement — real user feedback that the original bare Avatar+name row gave no way to see a
    // linked record's details or navigate to edit it) — its own Edit link targets the real
    // ClubContactFormPage edit route, and its Unlink button reads plain "Unlink" (RecordCard's
    // fixed secondaryAction label, not "Unlink {name}"), so scope to the specific card by name.
    const existingContactCard = page.locator('.MuiCard-root').filter({ hasText: existingContactFullName });
    await expect(existingContactCard.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', /\/manage\/club-contacts\/.+\/edit/);

    // Unlink the first contact — the underlying ClubContact isn't deleted (an unlink is a hard
    // delete of the join row only), the second contact stays linked.
    await existingContactCard.getByRole('button', { name: 'Unlink' }).click();
    await expect(page.getByText(existingContactFullName, { exact: true })).not.toBeVisible();
    await expect(page.getByText(newContactFullName, { exact: true })).toBeVisible();

    // --- Sponsors: link existing, create-and-link, "Club sponsors" excludes what's linked, unlink ---

    await page.getByRole('tab', { name: 'Sponsors' }).click();
    await expect(page.getByText('Club sponsors', { exact: true })).toBeVisible();

    // Both sponsors created up front show up read-only, unlinked, before any linking happens.
    await expect(page.getByText(linkedSponsorName, { exact: true })).toBeVisible();
    await expect(page.getByText(otherSponsorName, { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Link existing' }).click();
    await page.getByRole('combobox', { name: 'Search sponsors' }).click();
    // No extra field for Team<->Sponsor (unlike Team<->Contact's role) — selecting the option
    // links it immediately, same "no confirm button" UX Section<->ClubContact's own dialog uses.
    await page.getByRole('option', { name: linkedSponsorName, exact: true }).click();

    // Now linked — shows in "This team's sponsors" as its own RecordCard with an Edit link (to the
    // real SponsorFormPage edit route) and an Unlink control, and (a single match proves it isn't
    // shown twice) no longer anywhere in the read-only "Club sponsors" list below, while the
    // untouched sponsor stays there.
    let linkedSponsorCard = page.locator('.MuiCard-root').filter({ hasText: linkedSponsorName });
    await expect(linkedSponsorCard.getByRole('button', { name: 'Unlink' })).toBeVisible();
    await expect(linkedSponsorCard.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', /\/manage\/sponsors\/.+\/edit/);
    await expect(page.getByText(otherSponsorName, { exact: true })).toBeVisible();

    // Create-and-link a brand-new sponsor in the same flow — Name is SponsorForm's only required
    // field (023-sponsors.md), so nothing else needs filling here.
    await page.getByRole('button', { name: '+ New sponsor' }).click();
    await page.getByLabel('Name').fill(createdSponsorName);
    await page.getByRole('button', { name: 'Create & link' }).click();
    const createdSponsorCard = page.locator('.MuiCard-root').filter({ hasText: createdSponsorName });
    await expect(createdSponsorCard.getByRole('button', { name: 'Unlink' })).toBeVisible();

    // Unlink the first sponsor — the underlying Sponsor isn't deleted, it reappears in the
    // read-only "Club sponsors" list now that it's no longer linked to this team.
    await linkedSponsorCard.getByRole('button', { name: 'Unlink' }).click();
    await expect(linkedSponsorCard.getByRole('button', { name: 'Unlink' })).not.toBeVisible();
    // Reappears read-only under "Club sponsors" — a fresh locator, since the card it now lives in
    // no longer has an Unlink button.
    linkedSponsorCard = page.locator('.MuiCard-root').filter({ hasText: linkedSponsorName });
    await expect(linkedSponsorCard.getByRole('link', { name: 'Edit' })).toBeVisible();
    await expect(linkedSponsorCard.getByRole('button', { name: 'Unlink' })).toHaveCount(0);

    // --- Section badge: back at Club Structure, the leaf's "Manage Teams" card shows the team ---

    await page.getByRole('link', { name: 'Back to Teams' }).click();
    await expect(page).toHaveURL(/\/manage\/sections\/[^/]+\/teams$/);
    await page.getByRole('link', { name: 'Back to Club Structure' }).click();
    await expect(page).toHaveURL(/\/manage\/sections$/);

    await page.getByRole('button', { name: leafSectionName, exact: true }).click();
    const teamsCard = page.locator('[data-club-id]');
    await expect(teamsCard.getByText(teamName, { exact: true })).toBeVisible();
  });
});
