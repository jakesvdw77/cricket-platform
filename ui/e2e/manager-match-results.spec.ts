import { test, expect } from '@playwright/test';

/**
 * E2E golden path for docs/specs/100-match-results-core.md's Test Plan (Playwright row) and Acceptance Criteria: a club
 * manager creates a (past-dated) match, opens Results, taps Capture result, picks the awaiting match, records a
 * won-by-runs result with the toss and both scores in the four wizard steps, saves a draft, sees it as a draft on the
 * Results page, publishes it, and sees the match as Completed on the Matches page. A second, short test records a tie
 * decided by a super over. Both run at the desktop and the mobile viewport (the two projects in playwright.config.ts).
 *
 * Runs against a real running dev server AND real local Keycloak (not Testcontainers, no mocking)
 * — start all of these before running, same as ui/e2e/manager-fields-directory.spec.ts:
 *   - backend: `cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev` (port 8082)
 *   - frontend: `cd ui && npm run dev` (port 5173)
 *   - Keycloak: `auth.localhost:8180`, realm `cricketlegend`, client `cricketlegend`
 *
 * PREREQUISITES, all from the environment (no credentials live in this repo): the CLUB_ADMIN test account every
 * manager e2e spec uses:
 *   E2E_CLUB_ADMIN_USERNAME / E2E_CLUB_ADMIN_PASSWORD / E2E_CLUB_ADMIN_CLUB_ID
 * The club needs at least one season and one own team (the match form uses the first of each).
 *
 * NOT run in CI (no Keycloak in `e2e-smoke`) — skips itself whenever process.env.CI is set.
 */

const ROOT_DOMAIN = process.env.E2E_ROOT_DOMAIN ?? 'localhost:5173';
const CLUB_ADMIN_USERNAME = process.env.E2E_CLUB_ADMIN_USERNAME;
const CLUB_ADMIN_PASSWORD = process.env.E2E_CLUB_ADMIN_PASSWORD;
const CLUB_ADMIN_CLUB_ID = process.env.E2E_CLUB_ADMIN_CLUB_ID;

type Page = import('@playwright/test').Page;

async function login(page: Page, username: string, password: string) {
  await page.goto(`http://${ROOT_DOMAIN}/login`);
  await page.getByLabel('Username or email').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

// Creates a match against a free-text opponent, dated `daysAgo` days in the past, and returns the opponent's name (the
// match's unique handle: the card and picker row both read "<own team> vs <opponent>").
async function createPastMatch(page: Page, opponentName: string, daysAgo: number) {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.goto(`http://${ROOT_DOMAIN}/manage/fixtures/matches`);
  await page.getByRole('button', { name: 'Add Match' }).click();
  await expect(page).toHaveURL(/\/manage\/fixtures\/matches\/new$/);
  await page.getByRole('combobox', { name: 'Season' }).click();
  await page.getByRole('option').first().click();
  await page.getByLabel('Match date & time').fill(`${date}T09:00`);
  await page.getByRole('combobox', { name: 'Home team' }).click();
  await page.getByRole('option').first().click();
  await page.getByRole('group', { name: 'Away side' }).getByRole('button', { name: 'Other' }).click();
  await page.getByRole('textbox', { name: /away/i }).fill(opponentName);
  await page.getByRole('button', { name: 'Create match' }).click();
  await expect(page).toHaveURL(/\/manage\/fixtures\/matches$/);
}

// Results -> Capture result -> the awaiting match's row; lands on the wizard's first step.
async function openWizardFor(page: Page, opponentName: string) {
  await page.goto(`http://${ROOT_DOMAIN}/manage/results`);
  await expect(page.getByRole('heading', { name: 'Results', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Capture result' }).first().click();
  const picker = page.getByRole('dialog', { name: 'Capture a result' });
  await picker.getByLabel('Search teams or league').fill(opponentName);
  await picker.getByTestId('awaiting-match').filter({ hasText: opponentName }).click();
  await expect(page).toHaveURL(/\/manage\/results\/[^/]+\/capture$/);
  await expect(page.getByRole('heading', { name: 'Capture result' })).toBeVisible();
}

const nextTo = (page: Page, label: string) => page.getByRole('button', { name: `Next: ${label}` });

// The wizard opens on Teams (docs/specs/101, decision 22); the result steps are picked by name, never by number.
const toStep = (page: Page, label: string) => page.getByRole('button', { name: new RegExp(`^Step \\d+: ${label}`) }).click();

// Fills one innings row (0-based) of the Scores step: runs, wickets, overs as typed on a scorecard.
async function fillInnings(page: Page, row: number, runs: string, wickets: string, overs: string) {
  const innings = page.getByTestId('innings-row').nth(row);
  await innings.getByRole('spinbutton', { name: /runs$/ }).fill(runs);
  await innings.getByRole('spinbutton', { name: /wickets$/ }).fill(wickets);
  await innings.getByLabel('Overs', { exact: true }).fill(overs);
}

test.describe('Match results golden path (100-match-results-core.md)', () => {
  test.beforeEach(() => {
    test.skip(!!process.env.CI, 'requires local Keycloak — not wired into CI yet, see docs/plans/005-admin-login.md Flag #2');
    test.skip(
      !CLUB_ADMIN_USERNAME || !CLUB_ADMIN_PASSWORD || !CLUB_ADMIN_CLUB_ID,
      "requires E2E_CLUB_ADMIN_USERNAME / E2E_CLUB_ADMIN_PASSWORD / E2E_CLUB_ADMIN_CLUB_ID — see this file's prerequisites",
    );
  });

  test('manager captures a won-by-runs result, saves it as a draft, publishes it and sees the match as Completed', async ({ page }) => {
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const opponent = `E2E Results Opponents ${uniqueSuffix}`;

    await login(page, CLUB_ADMIN_USERNAME as string, CLUB_ADMIN_PASSWORD as string);
    await expect(page).toHaveURL(new RegExp('/manage$'));
    await createPastMatch(page, opponent, 3);

    // --- Results -> Capture result -> the awaiting match. ---
    await openWizardFor(page, opponent);

    // --- Teams is optional: go to Toss and field, where the home side won the toss and batted. ---
    await nextTo(page, 'Toss and field').click();
    await page.getByRole('radiogroup', { name: 'Who won the toss?' }).getByRole('radio').first().click();
    await page.getByRole('button', { name: 'Bat', exact: true }).click();

    // --- Result: one tile, the winner. ---
    await nextTo(page, 'Result').click();
    await page.getByRole('radio', { name: /^Won/ }).click();
    await page.getByRole('radiogroup', { name: 'Who won?' }).getByRole('radio').first().click(); // the home (own) side

    // --- Scores and margin (the optional scorecard steps are skipped): home 180/6 in 40 overs, away 150/9 in 38.4 overs; overs as "38.4", not a decimal. ---
    await page.getByRole('button', { name: /^Step \d+: Scores and margin/ }).click();
    await expect(page.getByTestId('toss-context')).toBeVisible();
    await fillInnings(page, 0, '180', '6', '40');
    await fillInnings(page, 1, '150', '9', '38.4');
    // 38.7 is refused in plain English
    await page.getByTestId('innings-row').nth(1).getByLabel('Overs', { exact: true }).fill('38.7');
    await expect(page.getByText(/must be 0 to 5/)).toBeVisible();
    await page.getByTestId('innings-row').nth(1).getByLabel('Overs', { exact: true }).fill('38.4');
    await expect(page.getByTestId('suggested-result')).toContainText('won by 30 runs');

    // --- Save as a draft (no full validity needed), then see the draft on the Results page. ---
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText(/Draft saved/)).toBeVisible();
    await page.goto(`http://${ROOT_DOMAIN}/manage/results`);
    const card = page.locator('.MuiCard-root').filter({ hasText: opponent });
    await expect(card).toBeVisible();
    await expect(card.getByText('Draft', { exact: true })).toBeVisible();
    await expect(card.getByTestId('result-line')).toContainText('won by 30 runs');

    // --- Continue the draft from the card, review, and publish. ---
    await card.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByRole('heading', { name: 'Edit result' })).toBeVisible();
    await page.getByRole('button', { name: /^Step \d+: Review/ }).click();
    await expect(page.getByTestId('result-preview')).toContainText('won by 30 runs');
    await expect(page.getByText('The margin of 30 runs matches the scores.')).toBeVisible();
    // Any warning must be ticked before Publish unlocks (none are expected on this result, so the box may be absent).
    const acknowledge = page.getByRole('checkbox', { name: /I have checked these warnings/ });
    if (await acknowledge.count()) await acknowledge.check();
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page).toHaveURL(/\/manage\/results$/);

    // --- Published: no longer a draft, Edit is off until unpublished. ---
    const published = page.locator('.MuiCard-root').filter({ hasText: opponent });
    await expect(published.getByText('Draft', { exact: true })).toHaveCount(0);
    await expect(published.getByRole('button', { name: 'Edit' })).toBeDisabled();

    // --- The Matches page shows the match as Completed. ---
    await page.goto(`http://${ROOT_DOMAIN}/manage/fixtures/matches`);
    await page.getByLabel('Search').first().fill(opponent);
    const matchCard = page.locator('.MuiCard-root').filter({ hasText: opponent });
    await expect(matchCard.getByText('Completed')).toBeVisible();
    await expect(matchCard.getByRole('button', { name: 'View result' })).toBeVisible();
  });

  test('manager records a tie decided in a super over', async ({ page }) => {
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const opponent = `E2E Super Over Opponents ${uniqueSuffix}`;

    await login(page, CLUB_ADMIN_USERNAME as string, CLUB_ADMIN_PASSWORD as string);
    await expect(page).toHaveURL(new RegExp('/manage$'));
    await createPastMatch(page, opponent, 4);
    await openWizardFor(page, opponent);

    // Won, decided by a super over: the first super over pair is offered on the Scores step.
    await toStep(page, 'Result');
    await page.getByRole('radio', { name: /^Won/ }).click();
    await page.getByRole('button', { name: 'Super over', exact: true }).click();
    await page.getByRole('radiogroup', { name: 'Who won?' }).getByRole('radio').nth(1).click(); // the opponent wins it

    await page.getByRole('button', { name: /^Step \d+: Scores and margin/ }).click();
    // No toss was recorded, so the wizard asks who batted first.
    await page.getByRole('radiogroup', { name: 'Who batted first?' }).getByRole('radio').first().click();

    // Level at 150, then the super over: the second batter bats first in it (the opponent here).
    await fillInnings(page, 0, '150', '8', '40');
    await fillInnings(page, 1, '150', '9', '40');
    await expect(page.getByTestId('super-over')).toHaveCount(1);
    await fillInnings(page, 2, '12', '1', '1');
    await fillInnings(page, 3, '8', '2', '1');
    await expect(page.getByTestId('suggested-result')).toContainText('won in the super over');

    // Review: the result reads as a tie won in the super over and is clean.
    await page.getByRole('button', { name: /^Step \d+: Review/ }).click();
    await expect(page.getByTestId('result-preview')).toContainText('Tied');
    await expect(page.getByTestId('result-preview')).toContainText('won in the super over');
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled();
  });
});
