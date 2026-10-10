import { test, expect } from '@playwright/test';

/**
 * E2E golden path for docs/specs/064-unified-availability-polls.md's Test Plan (Playwright row)
 * and Acceptance Criteria: from the single New poll screen, create a squad poll for one match and
 * a group poll for a different match of the same team, see both in the one /manage/availability
 * list, delete the squad poll and re-poll its (now freed) match.
 *
 * Runs against a real running dev server AND real local Keycloak (not Testcontainers, no mocking)
 * — start all of these before running, same as ui/e2e/manager-league-management.spec.ts:
 *   - backend: `cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev` (port 8082)
 *   - frontend: `cd ui && npm run dev` (port 5173)
 *   - Keycloak: `auth.localhost:8180`, realm `cricketlegend`, client `cricketlegend`
 *
 * PREREQUISITE: the same CLUB_ADMIN test account every other manager e2e spec uses, provided via
 *   export E2E_CLUB_ADMIN_USERNAME=... E2E_CLUB_ADMIN_PASSWORD=... E2E_CLUB_ADMIN_CLUB_ID=...
 *
 * NOT run in CI (no Keycloak in `e2e-smoke`) — skips itself whenever process.env.CI is set.
 */

const ROOT_DOMAIN = process.env.E2E_ROOT_DOMAIN ?? 'localhost:5173';
const CLUB_ADMIN_USERNAME = process.env.E2E_CLUB_ADMIN_USERNAME;
const CLUB_ADMIN_PASSWORD = process.env.E2E_CLUB_ADMIN_PASSWORD;
const CLUB_ADMIN_CLUB_ID = process.env.E2E_CLUB_ADMIN_CLUB_ID;

type Page = import('@playwright/test').Page;

async function loginAsClubAdmin(page: Page) {
  await page.goto(`http://${ROOT_DOMAIN}/login`);
  await page.getByLabel('Username or email').fill(CLUB_ADMIN_USERNAME as string);
  await page.getByLabel('Password', { exact: true }).fill(CLUB_ADMIN_PASSWORD as string);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

// Same section-tree helper as manager-teams.spec.ts / manager-league-management.spec.ts.
async function addTopLevelSection(page: Page, name: string) {
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

// Same Home-team / External-opponent sequence as manager-league-management.spec.ts's helper.
// Assumes the caller is already on /manage/fixtures/matches.
async function createMatchAgainstExternalOpponent(
  page: Page,
  params: { teamName: string; opponentName: string; seasonLabel: string; matchDateTimeLocal: string; venue: string },
) {
  await page.getByRole('button', { name: 'Add Match' }).click();
  await expect(page).toHaveURL(/\/manage\/fixtures\/matches\/new$/);
  await page.getByLabel('Season').click();
  await page.getByRole('option', { name: params.seasonLabel, exact: true }).click();
  await page.getByLabel('Match date & time').fill(params.matchDateTimeLocal);
  await page.getByLabel('Venue').fill(params.venue);
  await page.getByLabel('Home team').click();
  await page.getByRole('option', { name: params.teamName, exact: true }).click();
  await page.getByRole('button', { name: 'External opponent' }).nth(1).click();
  await page.getByLabel('Away opponent name').fill(params.opponentName);
  await page.getByRole('button', { name: 'Create match' }).click();
  await expect(page).toHaveURL(/\/manage\/fixtures\/matches$/);
}

test.describe('Unified availability polls golden path (064-unified-availability-polls.md)', () => {
  test.beforeEach(() => {
    test.skip(!!process.env.CI, 'requires local Keycloak — not wired into CI yet, see docs/plans/005-admin-login.md Flag #2');
    test.skip(
      !CLUB_ADMIN_USERNAME || !CLUB_ADMIN_PASSWORD || !CLUB_ADMIN_CLUB_ID,
      'requires E2E_CLUB_ADMIN_USERNAME / E2E_CLUB_ADMIN_PASSWORD / E2E_CLUB_ADMIN_CLUB_ID — see this file\'s PREREQUISITE comment',
    );
  });

  test('club admin opens a squad poll and a group poll for two matches of one team from the New poll screen, sees both in one list, deletes one and re-polls its match', async ({
    page,
  }) => {
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sectionName = `E2E Poll Section ${uniqueSuffix}`;
    const teamName = `E2E Poll Team ${uniqueSuffix}`;
    const seasonLabel = `E2E Poll Season ${uniqueSuffix}`;
    const opponent1Name = `E2E Poll Opponents One ${uniqueSuffix}`;
    const opponent2Name = `E2E Poll Opponents Two ${uniqueSuffix}`;
    const venue = `E2E Poll Ground ${uniqueSuffix}`;
    const groupDescription = `E2E Group Poll ${uniqueSuffix}`;

    const today = new Date();
    const currentYear = today.getFullYear();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const matchDate = tomorrow.toISOString().slice(0, 10);
    // Different day-parts so the two polls never compete for one (section, date, day-part) window.
    const match1DateTimeLocal = `${matchDate}T09:00`;
    const match2DateTimeLocal = `${matchDate}T15:00`;

    await loginAsClubAdmin(page);
    await expect(page).toHaveURL(new RegExp('/manage$'));
    await expect(page.getByText('Not authorized')).not.toBeVisible();

    // --- Section + team: no squad mode to configure, the team is pollable straight away. ---
    await page.getByRole('link', { name: 'Club Structure' }).click();
    await expect(page).toHaveURL(/\/manage\/sections$/);
    await addTopLevelSection(page, sectionName);
    await page.getByRole('link', { name: 'Manage Teams' }).click();
    await page.getByRole('button', { name: 'Add Team' }).click();
    await page.getByLabel('Name').fill(teamName);
    await expect(page.getByLabel('Squad mode')).toHaveCount(0);
    await page.getByRole('button', { name: 'Create team' }).click();
    await expect(page.locator('.MuiCard-root').filter({ hasText: teamName })).toBeVisible();

    // --- Season + two matches for the team. ---
    await page.goto(`http://${ROOT_DOMAIN}/manage`);
    await page.getByRole('link', { name: 'Seasons' }).click();
    await page.getByRole('button', { name: 'Add Season' }).click();
    await page.getByLabel('Label').fill(seasonLabel);
    await page.getByLabel('Start date').fill(`${currentYear}-01-01`);
    await page.getByLabel('End date').fill(`${currentYear}-12-31`);
    await page.getByRole('button', { name: 'Create season' }).click();
    await expect(page).toHaveURL(/\/manage\/fixtures\/seasons$/);

    await page.goto(`http://${ROOT_DOMAIN}/manage`);
    await page.getByRole('link', { name: 'Fixtures & Results' }).click();
    await page.getByRole('link', { name: 'Matches' }).click();
    await expect(page).toHaveURL(/\/manage\/fixtures\/matches$/);
    await createMatchAgainstExternalOpponent(page, {
      teamName,
      opponentName: opponent1Name,
      seasonLabel,
      matchDateTimeLocal: match1DateTimeLocal,
      venue,
    });
    await createMatchAgainstExternalOpponent(page, {
      teamName,
      opponentName: opponent2Name,
      seasonLabel,
      matchDateTimeLocal: match2DateTimeLocal,
      venue,
    });

    // --- New poll -> Squad: poll only match 1 (match 2 unticked). ---
    await page.goto(`http://${ROOT_DOMAIN}/manage/availability`);
    await page.getByRole('button', { name: 'New poll' }).first().click();
    await expect(page).toHaveURL(/\/manage\/availability\/new$/);
    await page.getByRole('radio', { name: /Squad poll/ }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('Team').click();
    await page.getByRole('option', { name: teamName, exact: true }).click();
    await expect(page.getByLabel(`Include ${teamName} vs ${opponent1Name}`)).toBeChecked();
    await page.getByLabel(`Include ${teamName} vs ${opponent2Name}`).click();
    await page.getByRole('button', { name: 'Open 1 poll' }).click();
    await expect(page).toHaveURL(/\/manage\/availability$/);
    const squadCard = page.locator('.MuiCard-root').filter({ hasText: `${teamName} vs ${opponent1Name}` });
    await expect(squadCard).toBeVisible();
    await expect(squadCard.getByText('Squad poll')).toBeVisible();

    // --- New poll -> Group: the section's other match; match 1 is now disabled as covered. ---
    await page.getByRole('button', { name: 'New poll' }).first().click();
    await page.getByRole('radio', { name: /Group poll/ }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('Section').click();
    await page.getByRole('treeitem', { name: sectionName, exact: true }).click();
    await expect(page.getByLabel(`Include ${teamName} vs ${opponent1Name}`)).toBeDisabled();
    await expect(page.getByLabel(`Include ${teamName} vs ${opponent2Name}`)).toBeChecked();
    await page.getByLabel('Description').fill(groupDescription);
    await page.getByRole('button', { name: 'Open poll for 1 selected fixture' }).click();
    await expect(page).toHaveURL(/\/manage\/availability$/);

    // --- One list, both kinds. ---
    const groupCard = page.locator('.MuiCard-root').filter({ hasText: groupDescription });
    await expect(groupCard).toBeVisible();
    await expect(groupCard.getByText('Group poll')).toBeVisible();
    await expect(squadCard).toBeVisible();

    // --- Delete the squad poll: its match is freed. ---
    await squadCard.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete poll' }).click();
    await expect(squadCard).toHaveCount(0);
    await expect(groupCard).toBeVisible();

    // --- Re-poll the freed match from the squad branch. ---
    await page.getByRole('button', { name: 'New poll' }).first().click();
    await page.getByRole('radio', { name: /Squad poll/ }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('Team').click();
    await page.getByRole('option', { name: teamName, exact: true }).click();
    await expect(page.getByLabel(`Include ${teamName} vs ${opponent1Name}`)).toBeEnabled();
    await expect(page.getByLabel(`Include ${teamName} vs ${opponent2Name}`)).toBeDisabled();
    await page.getByRole('button', { name: 'Open 1 poll' }).click();
    await expect(page).toHaveURL(/\/manage\/availability$/);
    await expect(page.locator('.MuiCard-root').filter({ hasText: `${teamName} vs ${opponent1Name}` })).toBeVisible();
    await expect(groupCard).toBeVisible();
  });

  // docs/specs/083-availability-filters-and-toolbars.md: the League/Section/Team filters are shared across
  // the Polls, Players and Coverage views and mirrored in the address. Runs in the mobile and desktop
  // projects: on a phone the Section field is inside the Filters sheet.
  test('a section chosen on Polls is still applied on Players, and the address carries it', async ({ page }) => {
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sectionName = `E2E Filter Section ${uniqueSuffix}`;

    await loginAsClubAdmin(page);
    await expect(page).toHaveURL(new RegExp('/manage$'));
    await page.getByRole('link', { name: 'Club Structure' }).click();
    await expect(page).toHaveURL(/\/manage\/sections$/);
    await addTopLevelSection(page, sectionName);

    await page.goto(`http://${ROOT_DOMAIN}/manage/availability`);
    const filtersButton = page.getByRole('button', { name: /^Filters/ });
    const openFiltersIfPhone = async () => {
      if (await filtersButton.isVisible()) {
        await filtersButton.click();
      }
    };

    await openFiltersIfPhone();
    await page.getByLabel('Section').click();
    await page.getByRole('treeitem', { name: sectionName, exact: true }).click();
    if (await page.getByRole('button', { name: 'Done' }).isVisible()) {
      await page.getByRole('button', { name: 'Done' }).click();
    }
    await expect(page).toHaveURL(/\/manage\/availability\?.*section=/);

    await page.getByRole('link', { name: 'Players' }).click();
    await expect(page).toHaveURL(/\/manage\/availability\/players\?.*section=/);
    if (await filtersButton.isVisible()) {
      await expect(page.getByRole('button', { name: 'Filters, 1 active' })).toBeVisible();
    } else {
      await expect(page.getByLabel('Section')).toHaveValue(sectionName);
    }
  });

  // docs/specs/084-clickable-counters.md: "Players still to answer" opens the players panel; a player's poll
  // links to its Responses page. Needs a club with an open poll that still awaits at least one player (so the
  // counter is a button); otherwise the test skips. Runs in the mobile and desktop projects.
  test('Players still to answer opens the panel, shows a player and follows a poll link', async ({ page }) => {
    await loginAsClubAdmin(page);
    await expect(page).toHaveURL(new RegExp('/manage$'));
    await page.goto(`http://${ROOT_DOMAIN}/manage/availability`);

    // Wait for the counters row (any counter card) so a slow load or failed login fails here rather than skipping.
    await expect(page.getByTestId('page-counter-open-polls')).toBeVisible({ timeout: 15000 });
    const counter = page.getByRole('button', { name: /Players still to answer/ });
    test.skip((await counter.count()) === 0, 'No player is awaiting an answer in this club');
    await counter.click();

    await expect(page.getByRole('tab', { name: /Still to answer/ })).toHaveAttribute('aria-selected', 'true');
    const firstRow = page.getByTestId('players-panel-row').first();
    await expect(firstRow).toBeVisible();

    // On desktop the poll links are behind the row; on a phone they are already shown.
    const rowButton = firstRow.getByRole('button');
    if (await rowButton.count()) {
      await rowButton.first().click();
    }
    await firstRow.getByRole('link').first().click();
    await expect(page).toHaveURL(/\/manage\/availability\/(group|squad)\//);
  });
});
