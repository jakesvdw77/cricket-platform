import { test, expect } from '@playwright/test';

/**
 * E2E golden path for docs/specs/076-team-selection.md's Test Plan (End-to-end / smoke row) and
 * Acceptance Criteria: from a match's Home XI tab, open Select players, tick players in the dialog
 * (the "Team is full" limit stops the 13th), press Done and see "N of 12" with the numbered batting
 * order, make a captain and a wicketkeeper through the tap-a-name menu and the clickable badges,
 * reorder with the menu's Move up, announce the team (confirmation first) and un-announce it,
 * remove a player from the team, then confirm a second team's match at the same time shows the
 * still-selected player as "Not possible" (taken for the slot, unticked and disabled) while the
 * freed player is selectable.
 *
 * Setup is built through the UI like the other manager specs: a section with two teams, a season,
 * 13 players (date of birth is required since docs/specs/077-*, slice 1) added to team A's season
 * squad, and two matches at the same date and time (one per team, external opponents).
 *
 * Not covered (and why): native HTML5 drag and drop (Playwright's drag support does not fire the
 * dataTransfer events the list listens for, and the spec itself names the spinner and Move up /
 * Move down as the keyboard and touch path), and the "Release from <team>" flow (needs a second
 * manager login or a club admin with a published team; covered by the component tests).
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

// Assumes the caller is on the section's Manage Teams page.
async function addTeam(page: Page, teamName: string) {
  await page.getByRole('button', { name: 'Add Team' }).click();
  await page.getByLabel('Name').fill(teamName);
  await page.getByRole('button', { name: 'Create team' }).click();
  await expect(page.locator('.MuiCard-root').filter({ hasText: teamName })).toBeVisible();
}

// Same Home-team / External-opponent sequence as manager-availability-polls.spec.ts's helper.
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

// From /manage/fixtures/matches: View -> Edit -> Home XI tab of the match with this title.
async function openHomeXiTab(page: Page, matchTitle: string) {
  await page.locator('.MuiCard-root').filter({ hasText: matchTitle }).getByRole('link', { name: 'View' }).click();
  await expect(page).toHaveURL(/\/manage\/fixtures\/matches\/[^/]+$/);
  await page.getByRole('link', { name: 'Edit' }).click();
  await expect(page).toHaveURL(/\/manage\/fixtures\/matches\/.+\/edit$/);
  await page.getByRole('tab', { name: 'Home XI' }).click();
}

// Section -> Manage Teams -> the team's View -> Edit -> Squad tab for `seasonLabel`, then adds the
// given players to that season's squad (same sequence as manager-league-management.spec.ts).
async function addPlayersToSquad(
  page: Page,
  params: { sectionName: string; teamName: string; seasonLabel: string; playerNames: string[] },
) {
  await page.goto(`http://${ROOT_DOMAIN}/manage`);
  await page.getByRole('link', { name: 'Club Structure' }).click();
  await page.getByRole('button', { name: params.sectionName, exact: true }).click();
  await page.getByRole('link', { name: 'Manage Teams' }).click();
  await page.locator('.MuiCard-root').filter({ hasText: params.teamName }).getByRole('link', { name: 'View' }).click();
  await expect(page).toHaveURL(/\/manage\/sections\/[^/]+\/teams\/[^/]+$/);
  await page.getByRole('link', { name: 'Edit' }).click();
  await expect(page).toHaveURL(/\/manage\/sections\/[^/]+\/teams\/.+\/edit$/);
  await page.getByRole('tab', { name: 'Squad' }).click();
  // Pick the season explicitly rather than trusting the "season containing today" default, since
  // earlier e2e runs leave their own current-year seasons behind.
  await page.getByLabel('Season').click();
  await page.getByRole('option', { name: params.seasonLabel, exact: true }).click();
  for (const fullName of params.playerNames) {
    await page.getByRole('button', { name: 'Add player' }).click();
    await page.getByRole('combobox', { name: 'Search players' }).click();
    await page.getByRole('option', { name: fullName, exact: true }).click();
    await expect(page.getByText(fullName, { exact: true })).toBeVisible();
  }
}

// The numbered batting places only (not the 12th man or waiting rows), in displayed order.
function battingRows(page: Page) {
  return page.getByTestId('batting-places').locator('[data-testid^="selection-row-"]');
}

test.describe('Team selection golden path (076-team-selection.md)', () => {
  test.beforeEach(() => {
    test.skip(!!process.env.CI, 'requires local Keycloak — not wired into CI yet, see docs/plans/005-admin-login.md Flag #2');
    test.skip(
      !CLUB_ADMIN_USERNAME || !CLUB_ADMIN_PASSWORD || !CLUB_ADMIN_CLUB_ID,
      'requires E2E_CLUB_ADMIN_USERNAME / E2E_CLUB_ADMIN_PASSWORD / E2E_CLUB_ADMIN_CLUB_ID — see this file\'s PREREQUISITE comment',
    );
  });

  test('club admin selects a team from a match, sets captain and keeper, reorders, announces and un-announces, removes a player, and a second team at the same time sees the taken player as not possible', async ({
    page,
  }) => {
    // 13 player creations plus two squads and two matches: well past the default 30 s.
    test.setTimeout(240_000);

    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sectionName = `E2E Sel Section ${uniqueSuffix}`;
    const teamAName = `E2E Sel Team A ${uniqueSuffix}`;
    const teamBName = `E2E Sel Team B ${uniqueSuffix}`;
    const seasonLabel = `E2E Sel Season ${uniqueSuffix}`;
    const opponentAName = `E2E Sel Opponents A ${uniqueSuffix}`;
    const opponentBName = `E2E Sel Opponents B ${uniqueSuffix}`;
    const venue = `E2E Sel Ground ${uniqueSuffix}`;

    const lastName = `E2ESel${uniqueSuffix}`;
    // Sel01..Sel13: zero-padded so a name is never a substring of another.
    const players = Array.from({ length: 13 }, (_, index) => {
      const firstName = `Sel${String(index + 1).padStart(2, '0')}`;
      return { firstName, fullName: `${firstName} ${lastName}` };
    });
    const [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13] = players.map((player) => player.fullName);

    const today = new Date();
    const currentYear = today.getFullYear();
    const dob = `${currentYear - 25}-01-01`;
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    // Both matches share this exact date and time, so they occupy the same slot.
    const matchDateTimeLocal = `${tomorrow.toISOString().slice(0, 10)}T10:00`;

    await loginAsClubAdmin(page);
    await expect(page).toHaveURL(new RegExp('/manage$'));
    await expect(page.getByText('Not authorized')).not.toBeVisible();

    // --- Section with two teams. ---
    await page.getByRole('link', { name: 'Club Structure' }).click();
    await expect(page).toHaveURL(/\/manage\/sections$/);
    await addTopLevelSection(page, sectionName);
    await page.getByRole('link', { name: 'Manage Teams' }).click();
    await expect(page).toHaveURL(/\/manage\/sections\/[^/]+\/teams$/);
    await addTeam(page, teamAName);
    await addTeam(page, teamBName);

    // --- Season. ---
    await page.goto(`http://${ROOT_DOMAIN}/manage`);
    await page.getByRole('link', { name: 'Fixtures & Results' }).click();
    await page.getByRole('link', { name: 'Seasons' }).click();
    await page.getByRole('button', { name: 'Add Season' }).click();
    await page.getByLabel('Label').fill(seasonLabel);
    await page.getByLabel('Start date').fill(`${currentYear}-01-01`);
    await page.getByLabel('End date').fill(`${currentYear}-12-31`);
    await page.getByRole('button', { name: 'Create season' }).click();
    await expect(page).toHaveURL(/\/manage\/fixtures\/seasons$/);

    // --- 13 players, every required field including the date of birth (077 slice 1). ---
    await page.goto(`http://${ROOT_DOMAIN}/manage`);
    await page.getByRole('link', { name: 'Players' }).click();
    await expect(page).toHaveURL(/\/manage\/players$/);
    for (const { firstName, fullName } of players) {
      await page.getByRole('button', { name: 'Add Player' }).click();
      await expect(page).toHaveURL(/\/manage\/players\/new$/);
      await page.getByLabel('First name').fill(firstName);
      await page.getByLabel('Last name').fill(lastName);
      await page.getByLabel('Date of birth').fill(dob);
      await page.getByRole('button', { name: 'Create player' }).click();
      await expect(page).toHaveURL(/\/manage\/players$/);
      await expect(page.locator('.MuiCard-root').filter({ hasText: fullName })).toBeVisible();
    }

    // --- Team A's season squad: all 13 (no poll exists, so all are NOT_POLLED and selectable). ---
    await addPlayersToSquad(page, { sectionName, teamName: teamAName, seasonLabel, playerNames: players.map((p) => p.fullName) });

    // --- Team B's squad: p1 (will be taken by team A) and p4 (will be freed by team A). ---
    await addPlayersToSquad(page, { sectionName, teamName: teamBName, seasonLabel, playerNames: [p1, p4] });

    // --- Two matches at the same date and time, one per team. ---
    await page.goto(`http://${ROOT_DOMAIN}/manage`);
    await page.getByRole('link', { name: 'Fixtures & Results' }).click();
    await page.getByRole('link', { name: 'Matches' }).click();
    await expect(page).toHaveURL(/\/manage\/fixtures\/matches$/);
    await createMatchAgainstExternalOpponent(page, {
      teamName: teamAName,
      opponentName: opponentAName,
      seasonLabel,
      matchDateTimeLocal,
      venue,
    });
    await createMatchAgainstExternalOpponent(page, {
      teamName: teamBName,
      opponentName: opponentBName,
      seasonLabel,
      matchDateTimeLocal,
      venue,
    });

    // --- Team A: Home XI tab, Select players. ---
    await openHomeXiTab(page, `${teamAName} vs ${opponentAName}`);
    await expect(page.getByText('0 of 12', { exact: true })).toBeVisible();
    await expect(page.getByText('No players selected yet.')).toBeVisible();
    // Exactly the two buttons the spec names, before any selection.
    await expect(page.getByRole('button', { name: 'Select players' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Announce team' })).toBeDisabled();

    await page.getByRole('button', { name: 'Select players' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: new RegExp(`Select players · ${teamAName}`) })).toBeVisible();

    // Players with no poll are Not polled: selectable, but "Select all available" only ticks
    // players who answered Available, so with no poll at all it has nothing to tick and is disabled
    // (SelectPlayersDialog's selectAllCount) — the ticking below is by hand.
    await expect(dialog.getByRole('group', { name: 'Not polled' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /select all available players not yet selected \(0\)/i })).toBeDisabled();

    // Tick the first twelve in order — that is also the batting order they will get.
    for (const fullName of [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12]) {
      await dialog.getByRole('checkbox', { name: fullName, exact: true }).check();
    }
    await expect(dialog.getByText('12 of 12', { exact: true })).toBeVisible();
    await expect(dialog.getByText(/Team is full/).first()).toBeVisible();
    // The thirteenth cannot be ticked once the team is full.
    await expect(dialog.getByRole('checkbox', { name: p13, exact: true })).toBeDisabled();

    // Untick two, leaving ten: p11 and p12.
    await dialog.getByRole('checkbox', { name: p11, exact: true }).uncheck();
    await dialog.getByRole('checkbox', { name: p12, exact: true }).uncheck();
    await expect(dialog.getByText('10 of 12', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('checkbox', { name: p13, exact: true })).toBeEnabled();

    await dialog.getByRole('button', { name: 'Done' }).click();
    await expect(dialog).not.toBeVisible();

    // --- Summary and the numbered list, in tick order. ---
    await expect(page.getByText('10 of 12', { exact: true })).toBeVisible();
    await expect(battingRows(page)).toHaveCount(10);
    const tickedInOrder = [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10];
    for (const [index, fullName] of tickedInOrder.entries()) {
      const row = battingRows(page).nth(index);
      await expect(row).toContainText(fullName);
      await expect(row).toContainText(String(index + 1));
    }
    await expect(page.getByText(/Not in the batting order yet/)).toHaveCount(0);

    // --- Captain (p2) and wicketkeeper (p3) through the tap-a-name menu. ---
    await page.getByRole('button', { name: `${p2}, open menu` }).click();
    await page.getByRole('menuitem', { name: 'Make captain' }).click();
    await expect(page.getByRole('button', { name: `${p2}, captain, open options` })).toBeVisible();

    await page.getByRole('button', { name: `${p3}, open menu` }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Wicketkeeper' }).click();
    const keeperBadge = page.getByRole('button', { name: `${p3}, wicketkeeper, open options` });
    await expect(keeperBadge).toBeVisible();

    // The clickable badge opens a Remove menu; remove the keeper, then make p4 the keeper instead.
    await keeperBadge.click();
    await page.getByRole('menuitem', { name: 'Remove as wicketkeeper' }).click();
    await expect(keeperBadge).toHaveCount(0);
    await page.getByRole('button', { name: `${p4}, open menu` }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Wicketkeeper' }).click();
    await expect(page.getByRole('button', { name: `${p4}, wicketkeeper, open options` })).toBeVisible();

    // --- Reorder with the menu's Move up (no native drag and drop): p3 moves above p2. ---
    await page.getByRole('button', { name: `${p3}, open menu` }).click();
    await page.getByRole('menuitem', { name: 'Move up' }).click();
    await expect(battingRows(page).nth(1)).toContainText(p3);
    await expect(battingRows(page).nth(2)).toContainText(p2);
    await expect(battingRows(page).nth(0)).toContainText(p1);

    // --- Announce team: confirmation first, then the team shows as announced. ---
    await expect(page.getByText('Not announced', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Announce team' }).click();
    const announceDialog = page.getByRole('dialog');
    await expect(announceDialog.getByText('Announce this team?')).toBeVisible();
    await expect(announceDialog.getByText(/Announcing marks this team as final/)).toBeVisible();
    await announceDialog.getByRole('button', { name: 'Announce team' }).click();
    await expect(page.getByText('Announced', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Un-announce' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Announce team' })).toHaveCount(0);

    // --- Un-announce. ---
    await page.getByRole('button', { name: 'Un-announce' }).click();
    await expect(page.getByText('Not announced', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Announce team' })).toBeVisible();

    // --- Remove p4 (the keeper) from the team: positions close up and the badge goes with him. ---
    await page.getByRole('button', { name: `${p4}, open menu` }).click();
    await page.getByRole('menuitem', { name: 'Remove from team' }).click();
    await expect(page.getByText('9 of 12', { exact: true })).toBeVisible();
    await expect(battingRows(page)).toHaveCount(9);
    await expect(page.getByRole('button', { name: `${p4}, open menu` })).toHaveCount(0);
    await expect(page.getByRole('button', { name: `${p4}, wicketkeeper, open options` })).toHaveCount(0);

    // --- Second team, same slot (collision check). p1 is still in team A; p4 was just freed. ---
    await page.goto(`http://${ROOT_DOMAIN}/manage/fixtures/matches`);
    await openHomeXiTab(page, `${teamBName} vs ${opponentBName}`);
    await page.getByRole('button', { name: 'Select players' }).click();
    const dialogB = page.getByRole('dialog');
    await expect(dialogB.getByRole('heading', { name: new RegExp(`Select players · ${teamBName}`) })).toBeVisible();

    // p1: under Not possible, "In <team A> · <time>" and cannot be ticked.
    const notPossible = dialogB.getByRole('group', { name: 'Not possible' });
    await expect(notPossible).toBeVisible();
    await expect(notPossible.getByText(p1, { exact: true })).toBeVisible();
    await expect(notPossible.getByText(new RegExp(`^In ${teamAName}`))).toBeVisible();
    await expect(notPossible.getByRole('checkbox', { name: `${p1} cannot be selected` })).toBeDisabled();

    // p4: freed by Remove from team, so he is a normal selectable row.
    await expect(dialogB.getByRole('checkbox', { name: p4, exact: true })).toBeEnabled();
    await dialogB.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialogB).not.toBeVisible();
  });
});
