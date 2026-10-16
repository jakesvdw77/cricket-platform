import { test, expect } from '@playwright/test';
import { addFieldInline } from './helpers/addFieldInline';

/**
 * E2E golden path for docs/specs/104-match-results-import-adaptors.md's Test Plan (End-to-end row) and Acceptance
 * Criteria: a club manager opens Results, taps Import result, picks the JSON source, pastes a document, chooses the match,
 * confirms the teams with a swap, creates the draft, sees the Guess chips in the Teams step, confirms one and changes
 * another, sees Review block on the one left unconfirmed, confirms it and publishes. A second, short test imports the same
 * document again: it updates the same draft after the replace tick, and the name the manager corrected is remembered, so
 * it is not flagged the second time. Both run at the desktop and the mobile viewport (the two projects in
 * playwright.config.ts).
 *
 * Setup is built through the UI like the other manager specs: a section with one team, a season, four players (every
 * name carries a per-run suffix, so a name never clashes with an earlier run) in the team's season squad, and a past match
 * against an external opponent. Every name is invented.
 *
 * NOT RUN YET: written against the finished build but needs the environment below. The document's figures are plain
 * (totals add up, three wickets each way); if the server's checks warn about anything else, the spec ticks the warning box
 * before Publish, so only an error would stop it.
 *
 * Runs against a real running dev server AND real local Keycloak (not Testcontainers, no mocking)
 * Start all of these before running, same as ui/e2e/manager-match-results.spec.ts:
 *   - backend: `cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev` (port 8082)
 *   - frontend: `cd ui && npm run dev` (port 5173)
 *   - Keycloak: `auth.localhost:8180`, realm `cricketlegend`, client `cricketlegend`
 *
 * PREREQUISITES, all from the environment (no credentials live in this repo): the CLUB_ADMIN test account every
 * manager e2e spec uses:
 *   E2E_CLUB_ADMIN_USERNAME / E2E_CLUB_ADMIN_PASSWORD / E2E_CLUB_ADMIN_CLUB_ID
 *
 * NOT run in CI (no Keycloak in `e2e-smoke`): skips itself whenever process.env.CI is set.
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
  await expect(page).toHaveURL(new RegExp('/manage$'));
}

// Same section-tree helper as manager-team-selection.spec.ts.
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

interface Fixture {
  teamName: string;
  opponent: string;
  matchDate: string; // yyyy-MM-dd
  hari: string; // "Hari Konduru<suffix>": the file writes "Hari K", a guess the manager confirms
  sam: string; // "Sam Patel<suffix>": the file writes "Sam P", a guess the manager changes to Gus
  neil: string; // "Neil Naidoo<suffix>": the file writes "Neil N", a guess left unconfirmed so Review blocks
  gus: string; // "Gus Gopal<suffix>": in the squad, not in the file, the player Sam P is changed to
  surnameSuffix: string;
}

// A section with one team, a season, four players in the team's season squad, and a past match against an external
// opponent (home side is ours). Returns the names the document refers to.
async function setUpClub(page: Page): Promise<Fixture> {
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sectionName = `E2E Imp Section ${uniqueSuffix}`;
  const teamName = `E2E Imp Team ${uniqueSuffix}`;
  const seasonLabel = `E2E Imp Season ${uniqueSuffix}`;
  const opponent = `E2E Imp Opponents ${uniqueSuffix}`;
  const surnameSuffix = uniqueSuffix.replace(/[^a-z0-9]/gi, '');
  const year = new Date().getFullYear();
  const matchDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const people = [
    { first: 'Hari', last: `Konduru${surnameSuffix}` },
    { first: 'Sam', last: `Patel${surnameSuffix}` },
    { first: 'Neil', last: `Naidoo${surnameSuffix}` },
    { first: 'Gus', last: `Gopal${surnameSuffix}` },
  ];

  await page.getByRole('link', { name: 'Club Structure' }).click();
  await addTopLevelSection(page, sectionName);
  await page.getByRole('link', { name: 'Manage Teams' }).click();
  await page.getByRole('button', { name: 'Add Team' }).click();
  await page.getByLabel('Name').fill(teamName);
  await page.getByRole('button', { name: 'Create team' }).click();
  await expect(page.locator('.MuiCard-root').filter({ hasText: teamName })).toBeVisible();

  await page.goto(`http://${ROOT_DOMAIN}/manage`);
  await page.getByRole('link', { name: 'Seasons' }).click();
  await page.getByRole('button', { name: 'Add Season' }).click();
  await page.getByLabel('Label').fill(seasonLabel);
  await page.getByLabel('Start date').fill(`${year}-01-01`);
  await page.getByLabel('End date').fill(`${year}-12-31`);
  await page.getByRole('button', { name: 'Create season' }).click();
  await expect(page).toHaveURL(/\/manage\/fixtures\/seasons$/);

  await page.goto(`http://${ROOT_DOMAIN}/manage`);
  await page.getByRole('link', { name: 'Players' }).click();
  for (const person of people) {
    await page.getByRole('button', { name: 'Add Player' }).click();
    await page.getByLabel('First name').fill(person.first);
    await page.getByLabel('Last name').fill(person.last);
    await page.getByLabel('Date of birth').fill(`${year - 25}-01-01`);
    await page.getByRole('button', { name: 'Create player' }).click();
    await expect(page).toHaveURL(/\/manage\/players$/);
    await expect(page.locator('.MuiCard-root').filter({ hasText: `${person.first} ${person.last}` })).toBeVisible();
  }

  // The team's season squad: the pool the import matches our names against.
  await page.goto(`http://${ROOT_DOMAIN}/manage`);
  await page.getByRole('link', { name: 'Club Structure' }).click();
  await page.getByRole('button', { name: sectionName, exact: true }).click();
  await page.getByRole('link', { name: 'Manage Teams' }).click();
  await page.locator('.MuiCard-root').filter({ hasText: teamName }).getByRole('link', { name: 'View' }).click();
  await page.getByRole('link', { name: 'Edit' }).click();
  await page.getByRole('tab', { name: 'Squad' }).click();
  await page.getByLabel('Season').click();
  await page.getByRole('option', { name: seasonLabel, exact: true }).click();
  for (const person of people) {
    const fullName = `${person.first} ${person.last}`;
    await page.getByRole('button', { name: 'Add player' }).click();
    await page.getByRole('combobox', { name: 'Search players' }).click();
    await page.getByRole('option', { name: fullName, exact: true }).click();
    await expect(page.getByText(fullName, { exact: true })).toBeVisible();
  }

  // The match the document belongs to: ours at home, an external opponent away, two days ago.
  await page.goto(`http://${ROOT_DOMAIN}/manage/fixtures/matches`);
  await page.getByRole('button', { name: 'Add Match' }).click();
  await page.getByLabel('Season').click();
  await page.getByRole('option', { name: seasonLabel, exact: true }).click();
  await page.getByLabel('Match date & time').fill(`${matchDate}T09:00`);
  await addFieldInline(page, `E2E Imp Ground ${uniqueSuffix}`);
  await page.getByLabel('Home team').click();
  await page.getByRole('option', { name: teamName, exact: true }).click();
  await page.getByRole('group', { name: 'Away side' }).getByRole('button', { name: 'Other' }).click();
  await page.getByLabel('Away opponent name').fill(opponent);
  await page.getByRole('button', { name: 'Create match' }).click();
  await expect(page).toHaveURL(/\/manage\/fixtures\/matches$/);

  return {
    teamName,
    opponent,
    matchDate,
    hari: `Hari Konduru${surnameSuffix}`,
    sam: `Sam Patel${surnameSuffix}`,
    neil: `Neil Naidoo${surnameSuffix}`,
    gus: `Gus Gopal${surnameSuffix}`,
    surnameSuffix,
  };
}

// The common-format document: our side is "A" and batted first (the figures are small and plain so the totals add up), the
// opposition is "B". Our three players are written the way a scorer would ("Hari K", "Sam P", "Neil N"): each a guess.
function documentFor(fixture: Fixture, externalId: string): string {
  return JSON.stringify(
    {
      schemaVersion: 1,
      source: { provider: 'E2EJSON', externalMatchId: externalId },
      match: { date: fixture.matchDate, startTime: '09:00' },
      teams: [
        { key: 'A', name: fixture.teamName },
        { key: 'B', name: fixture.opponent },
      ],
      toss: { wonBy: 'A', decision: 'BAT' },
      result: { outcome: 'WON', winner: 'A', margin: { type: 'RUNS', value: 24 }, scheduledOvers: 40 },
      innings: [
        {
          battingTeam: 'A',
          runs: 92,
          wickets: 2,
          overs: '40.0',
          extras: { wides: 6, noBalls: 1, byes: 2, legByes: 1, penalty: 0 },
          batting: [
            { player: 'Hari K', howOut: 'BOWLED', bowler: 'Opp Bowler', runs: 42, balls: 51 },
            { player: 'Sam P', howOut: 'NOT_OUT', runs: 30, balls: 28 },
            { player: 'Neil N', howOut: 'BOWLED', bowler: 'Opp Bowler', runs: 10, balls: 14 },
          ],
          bowling: [{ player: 'Opp Bowler', overs: '40.0', maidens: 0, runs: 92, wickets: 2 }],
        },
        {
          battingTeam: 'B',
          runs: 68,
          wickets: 3,
          overs: '40.0',
          extras: { wides: 4, noBalls: 0, byes: 2, legByes: 2, penalty: 0 },
          batting: [
            { player: 'Opp Batter', howOut: 'BOWLED', bowler: 'Hari K', runs: 30, balls: 40 },
            { player: 'Opp Second', howOut: 'BOWLED', bowler: 'Hari K', runs: 20, balls: 30 },
            { player: 'Opp Third', howOut: 'BOWLED', bowler: 'Sam P', runs: 10, balls: 20 },
          ],
          bowling: [
            { player: 'Hari K', overs: '20.0', maidens: 1, runs: 30, wickets: 2 },
            { player: 'Sam P', overs: '20.0', maidens: 0, runs: 34, wickets: 1 },
          ],
        },
      ],
    },
    null,
    2,
  );
}

// Results -> Import result -> JSON -> paste -> Continue, landing on the Match step.
async function pasteDocument(page: Page, document: string) {
  await page.goto(`http://${ROOT_DOMAIN}/manage/results`);
  await expect(page.getByRole('heading', { name: 'Results', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Import result' }).first().click();
  await expect(page).toHaveURL(/\/manage\/results\/import$/);
  await expect(page.getByRole('heading', { name: 'Import result' })).toBeVisible();
  await page.getByRole('radio', { name: /Cricket Legend JSON/ }).click();
  await page.getByRole('tab', { name: 'Paste' }).click();
  await page.getByLabel('Pasted result content').fill(document);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Which match is this?')).toBeVisible();
}

// Match step: the match is chosen by its opponent (nothing is preselected), then Next.
async function chooseMatch(page: Page, opponent: string) {
  await page.getByRole('radiogroup', { name: 'Match' }).getByRole('radio', { name: new RegExp(opponent) }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Which side is which?')).toBeVisible();
}

const guessChip = (page: Page, fileName: string) => page.getByRole('button', { name: new RegExp(`^Guess: file said ${fileName},`) });

test.describe('Match result import golden path (104-match-results-import-adaptors.md)', () => {
  test.beforeEach(() => {
    test.skip(!!process.env.CI, 'requires local Keycloak, not wired into CI yet, see docs/plans/005-admin-login.md Flag #2');
    test.skip(
      !CLUB_ADMIN_USERNAME || !CLUB_ADMIN_PASSWORD || !CLUB_ADMIN_CLUB_ID,
      "requires E2E_CLUB_ADMIN_USERNAME / E2E_CLUB_ADMIN_PASSWORD / E2E_CLUB_ADMIN_CLUB_ID, see this file's prerequisites",
    );
  });

  test('manager pastes a JSON document, confirms the teams, checks the Guess chips and publishes the imported result', async ({ page }) => {
    // Section, team, season, three players, squad and a match before the import itself.
    test.setTimeout(240_000);
    await loginAsClubAdmin(page);
    const fixture = await setUpClub(page);

    // --- Source and Match: nothing is saved yet, and nothing is chosen for the manager. ---
    await pasteDocument(page, documentFor(fixture, `ext-${fixture.surnameSuffix}`));
    await expect(page.getByTestId('import-file-summary')).toContainText(fixture.teamName);
    await expect(page.getByRole('radiogroup', { name: 'Match' }).getByRole('radio', { checked: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
    await chooseMatch(page, fixture.opponent);

    // --- Teams: the sides are proposed; swap them, then swap back (the mapping is the manager's to confirm). ---
    await page.getByRole('button', { name: 'Swap sides' }).click();
    await expect(page.getByText('Chosen by you').first()).toBeVisible();
    await page.getByRole('button', { name: 'Swap sides' }).click();
    await page.getByRole('button', { name: 'Create draft and review' }).click();

    // --- The draft is created and not published; the summary counts the guesses. ---
    const created = page.getByTestId('import-created');
    await expect(created).toContainText('Draft created.');
    await expect(created).toContainText('2 are guesses to check');
    await created.getByRole('button', { name: 'Review in the result wizard' }).click();
    await expect(page).toHaveURL(/\/manage\/results\/[^/]+\/capture\?imported=1$/);
    await expect(page.getByTestId('imported-chip')).toContainText('Imported from E2EJSON');
    await expect(page.getByText(/Draft created from the import/)).toBeVisible();

    // --- Teams step: the banner and a Guess chip for each of the three; nothing is published. ---
    const banner = page.getByTestId('import-guess-banner');
    await expect(banner).toContainText('3 names were matched by a best guess');
    for (const fileName of ['Hari K', 'Sam P', 'Neil N']) await expect(guessChip(page, fileName)).toBeVisible();

    // --- Confirm Hari's guess from his chip. ---
    await guessChip(page, 'Hari K').click();
    await expect(page.getByText(/File said 'Hari K'/)).toBeVisible();
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(guessChip(page, 'Hari K')).toHaveCount(0);

    // --- Change Sam's guess to Gus: Change opens the picker with what the file said; Gus is in the team squad. ---
    await guessChip(page, 'Sam P').click();
    await page.getByRole('button', { name: 'Change', exact: true }).click();
    const picker = page.getByRole('dialog', { name: 'Choose the player' });
    await expect(picker.getByText(/File said:/)).toContainText('Sam P');
    await picker.getByRole('button', { name: 'Team squad' }).click();
    await picker.getByRole('button', { name: new RegExp(fixture.gus) }).click();
    await expect(guessChip(page, 'Sam P')).toHaveCount(0);
    await expect(page.getByText(fixture.gus).first()).toBeVisible();

    // --- Review blocks on Neil, the one left unconfirmed; its Fix goes back to Teams. ---
    await page.getByRole('button', { name: /^Step \d+: Review/ }).click();
    const checks = page.getByRole('list', { name: 'Checks' });
    await expect(checks).toContainText('Neil N');
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
    await checks.getByRole('button', { name: 'Fix' }).first().click();
    await expect(page.getByText('Who is playing?')).toBeVisible();

    // --- Confirm Neil, review again, and publish. ---
    await guessChip(page, 'Neil N').click();
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(page.getByTestId('import-guess-banner')).toHaveCount(0);
    await page.getByRole('button', { name: /^Step \d+: Review/ }).click();
    await expect(page.getByTestId('result-preview')).toContainText('won by 24 runs');
    const acknowledge = page.getByRole('checkbox', { name: /I have checked these warnings/ });
    if (await acknowledge.count()) await acknowledge.check();
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page).toHaveURL(/\/manage\/results$/);
    await expect(page.locator('.MuiCard-root').filter({ hasText: fixture.opponent }).getByText('Draft', { exact: true })).toHaveCount(0);
  });

  test('importing the same document again updates the same draft, and a corrected name is remembered', async ({ page }) => {
    test.setTimeout(240_000);
    await loginAsClubAdmin(page);
    const fixture = await setUpClub(page);
    const document = documentFor(fixture, `again-${fixture.surnameSuffix}`);

    // --- First import: create the draft, change Sam P to Gus (the manager's correction), and save. ---
    await pasteDocument(page, document);
    await chooseMatch(page, fixture.opponent);
    await page.getByRole('button', { name: 'Create draft and review' }).click();
    await page.getByTestId('import-created').getByRole('button', { name: 'Review in the result wizard' }).click();
    await guessChip(page, 'Sam P').click();
    await page.getByRole('button', { name: 'Change', exact: true }).click();
    const picker = page.getByRole('dialog', { name: 'Choose the player' });
    await picker.getByRole('button', { name: 'Team squad' }).click();
    await picker.getByRole('button', { name: new RegExp(fixture.gus) }).click();
    await expect(guessChip(page, 'Sam P')).toHaveCount(0);
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText(/Draft saved/)).toBeVisible();

    // --- Second import of the same document: the match is marked as imported before, replacing the draft needs the tick,
    // and the corrected name is not flagged the second time (the club remembered "Sam P"). ---
    await pasteDocument(page, document);
    await page.getByRole('radiogroup', { name: 'Match' }).getByRole('radio', { name: new RegExp(fixture.opponent) }).click();
    await expect(page.getByText('Imported from this id before')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    const create = page.getByRole('button', { name: 'Create draft and review' });
    await expect(create).toBeDisabled();
    await page.getByRole('checkbox', { name: 'Replace the existing draft' }).check();
    await create.click();

    const created = page.getByTestId('import-created');
    await expect(created).toContainText('Draft created.');
    // Hari and Neil are guesses again; Sam P resolved from the remembered name.
    await expect(created).toContainText('2 are guesses to check');
    await created.getByRole('button', { name: 'Review in the result wizard' }).click();
    await expect(guessChip(page, 'Sam P')).toHaveCount(0);
    await expect(guessChip(page, 'Hari K')).toBeVisible();
    await expect(page.getByText(fixture.gus).first()).toBeVisible();
  });
});
