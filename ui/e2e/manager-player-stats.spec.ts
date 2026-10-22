import { test, expect } from '@playwright/test';

/**
 * E2E golden paths for docs/specs/103-player-stats.md's Test Plan (End-to-end row) and Acceptance Criteria:
 *   (1) a player with a published result and a scorecard: open the Player page, see the six headline figures and the
 *       form strips, press View full breakdown, change the Season filter, see the Batting then the Bowling tab and the
 *       basis line;
 *   (2) Leaderboards: open it from the menu (Schedule group), see the Batting table, sort by another column and reverse
 *       it, open a row (it lands on that player's stats carrying the filters), then the Awards tab and its minimums.
 *   (3) docs/specs/115-player-match-list.md: a player's Matches tab: open it, change Season, press Show more when offered, open a
 *       match, and Back to Matches lands on the same filtered list.
 * (PDF and text output of the Awards sheet are deferred, spec decision 10, so they are not part of this spec.)
 * Runs at the desktop and the mobile viewport (the two projects in playwright.config.ts).
 *
 * Runs against a real running dev server AND real local Keycloak (not Testcontainers, no mocking)
 * — start all of these before running, same as ui/e2e/manager-match-results.spec.ts:
 *   - backend: `cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev` (port 8082)
 *   - frontend: `cd ui && npm run dev` (port 5173)
 *   - Keycloak: `auth.localhost:8180`, realm `cricketlegend`, client `cricketlegend`
 *
 * PREREQUISITES, all from the environment (no credentials live in this repo): the CLUB_ADMIN test account every
 * manager e2e spec uses:
 *   E2E_CLUB_ADMIN_USERNAME / E2E_CLUB_ADMIN_PASSWORD / E2E_CLUB_ADMIN_CLUB_ID
 * The club needs at least one PUBLISHED result with a batting card (capture one through Results, see
 * ui/e2e/manager-match-results.spec.ts, and publish it) so a player has a figure on the Batting board. This spec does not seed
 * results: there is no API-level seeding in this repo, and the capture wizard has its own golden path. When the club has
 * no such result the tests skip themselves and say why, rather than failing.
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
  await expect(page).toHaveURL(new RegExp('/manage$'));
}

// Leaderboards from the menu: the side menu on a desktop, the Menu sheet on a phone (Schedule group, after Results).
async function openLeaderboardsFromMenu(page: Page) {
  const menuButton = page.getByRole('button', { name: 'Menu' });
  if (await menuButton.isVisible()) {
    await menuButton.click();
  }
  await page.getByRole('link', { name: /^Leaderboards/ }).first().click();
  await expect(page).toHaveURL(/\/manage\/leaderboards/);
  await expect(page.getByRole('heading', { name: 'Leaderboards', level: 1 })).toBeVisible();
}

// Shows "All seasons" so a result of any date is on the board whatever today's season is (the Season default is the current
// one, and the saved choice is per club in this browser's localStorage, which is fresh in each Playwright context).
async function chooseSeason(page: Page, option: string | RegExp) {
  // A phone keeps its filters in a bottom sheet behind the Filters button.
  const filtersButton = page.getByRole('button', { name: /^Filters/ });
  const onPhone = await filtersButton.isVisible();
  if (onPhone) {
    await filtersButton.click();
  }
  await page.getByRole('combobox', { name: 'Season' }).click();
  await page.getByRole('option', { name: option }).click();
  if (onPhone) {
    await page.keyboard.press('Escape');
  }
}

// The first player on the All-seasons Batting board: its row link is /manage/players/<id>/stats?..., so the id comes from there.
async function firstBoardPlayerId(page: Page): Promise<string | null> {
  await openLeaderboardsFromMenu(page);
  const rows = page.getByTestId('standings-row');
  const empty = page.getByText(/No published results match these filters|Nobody is on this table yet/);
  await expect(rows.first().or(empty)).toBeVisible({ timeout: 15_000 });
  if (!(await rows.first().isVisible())) {
    await chooseSeason(page, 'All seasons');
    await expect(rows.first().or(empty)).toBeVisible({ timeout: 15_000 });
  }
  if (!(await rows.first().isVisible())) {
    return null;
  }
  // The row (role=row) is no longer a link itself: the player's name inside it is the real link.
  const href = await rows.first().getByRole('link').first().getAttribute('href');
  return /\/manage\/players\/([^/]+)\/stats/.exec(href ?? '')?.[1] ?? null;
}

test.describe('Player statistics and leaderboards golden paths (103-player-stats.md)', () => {
  test.beforeEach(() => {
    test.skip(!!process.env.CI, 'requires local Keycloak — not wired into CI yet, see docs/plans/005-admin-login.md Flag #2');
    test.skip(
      !CLUB_ADMIN_USERNAME || !CLUB_ADMIN_PASSWORD || !CLUB_ADMIN_CLUB_ID,
      "requires E2E_CLUB_ADMIN_USERNAME / E2E_CLUB_ADMIN_PASSWORD / E2E_CLUB_ADMIN_CLUB_ID — see this file's prerequisites",
    );
  });

  test('Player page Cricket card -> View full breakdown -> change Season -> Batting and Bowling tabs -> basis line', async ({ page }) => {
    await login(page, CLUB_ADMIN_USERNAME as string, CLUB_ADMIN_PASSWORD as string);
    const playerId = await firstBoardPlayerId(page);
    test.skip(playerId === null, 'the club has no published result with a batting card; capture and publish one first');

    // --- The Player page: six headline figures and no "coming soon". ---
    await page.goto(`http://${ROOT_DOMAIN}/manage/players/${playerId}`);
    const card = page.getByTestId('player-stats-card');
    await expect(card).toBeVisible({ timeout: 15_000 });
    for (const label of ['Matches', 'Runs', 'Batting avg', 'Strike rate', 'Wickets', 'Economy']) {
      await expect(card.getByTestId('player-info-field').filter({ hasText: label })).toBeVisible();
    }
    await expect(page.getByText(/coming soon/i)).toHaveCount(0);
    // The card says what its figures rest on, and the batting form strip shows for a player with an innings.
    await expect(card.getByText(/Based on \d+ published results? with this player on the team list/)).toBeVisible();
    await expect(card.getByRole('list', { name: 'Batting, last 5 innings' })).toBeVisible();

    // --- View full breakdown is a real link to the stats page. ---
    const breakdown = card.getByRole('link', { name: 'View full breakdown' });
    await expect(breakdown).toHaveAttribute('href', `/manage/players/${playerId}/stats`);
    await breakdown.click();
    await expect(page).toHaveURL(new RegExp(`/manage/players/${playerId}/stats`));
    // docs/specs/117-stats-dashboard.md: a link without ?tab= lands on Overview, the first tab; Batting is one click away.
    await expect(page.getByRole('tab', { name: 'Overview', selected: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Batting' }).click();
    await expect(page.getByRole('tab', { name: 'Batting', selected: true })).toBeVisible();
    const basis = page.getByTestId('stats-basis');
    await expect(basis).toContainText(/Based on \d+ published results? with this player on the team list: \d+ with a batting card\./);
    await expect(page.getByTestId('tile-runs')).toBeVisible();

    // --- Change the Season filter to a season this player has data for (only those are offered), then back to all. ---
    await page.getByRole('combobox', { name: 'Season' }).click();
    const seasonOptions = page.getByRole('option');
    const offered = await seasonOptions.count();
    expect(offered).toBeGreaterThanOrEqual(1); // at least "All seasons"
    if (offered > 1) {
      await seasonOptions.nth(1).click();
      await expect(basis).toBeVisible();
      await expect(page.getByTestId('tile-runs').or(page.getByText('No batting card has been captured for these results.'))).toBeVisible();
    } else {
      await page.keyboard.press('Escape');
    }

    // --- Bowling tab: its own basis line, and the three separate haul counters when the player has a bowling card. ---
    await page.getByRole('tab', { name: 'Bowling' }).click();
    await expect(page).toHaveURL(/tab=bowling/);
    await expect(page.getByRole('tab', { name: 'Bowling', selected: true })).toBeVisible();
    await expect(basis).toContainText(/with a bowling card\./);
    const bowlingNote = page.getByText('No bowling card has been captured for these results.');
    await expect(page.getByTestId('haul-3').or(bowlingNote)).toBeVisible();
    if (await page.getByTestId('haul-3').isVisible()) {
      await expect(page.getByTestId('haul-4')).toBeVisible();
      await expect(page.getByTestId('haul-5')).toBeVisible();
    }

    // --- Fielding no longer carries the awards and the record; Awards & record does. ---
    await page.getByRole('tab', { name: 'Fielding' }).click();
    await expect(page.getByText('Record while playing')).toHaveCount(0);
    await page.getByRole('tab', { name: 'Awards & record' }).click();
    await expect(page.getByText('Record while playing')).toBeVisible();
  });

  test('Leaderboards from the menu -> table -> sort and reverse -> row opens the player stats -> Awards and minimums', async ({ page }) => {
    await login(page, CLUB_ADMIN_USERNAME as string, CLUB_ADMIN_PASSWORD as string);
    const playerId = await firstBoardPlayerId(page);
    test.skip(playerId === null, 'the club has no published result with a batting card; capture and publish one first');

    // --- The Batting board lists everyone with a figure; the table is ranked by Runs scored by default. ---
    const rows = page.getByTestId('standings-row');
    await expect(rows.first()).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Batting', selected: true })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Sort by' })).toContainText('Runs scored');
    await expect(page.getByTestId('board-footer')).toContainText(/Showing \d+ of \d+\./);

    // --- Sort by another column from its heading, then reverse it (the heading again, or the Reverse order button). ---
    await page.getByRole('button', { name: 'Sort by Batting average' }).click();
    await expect(page).toHaveURL(/sort=average/);
    const sorted = page.getByRole('button', { name: /^Batting average, sorted descending/ });
    await expect(sorted).toBeVisible();
    await sorted.click();
    await expect(page).toHaveURL(/dir=asc/);
    await expect(page.getByRole('button', { name: /^Batting average, sorted ascending/ })).toBeVisible();
    // The optional minimum belongs to a rate sort and is empty by default (everyone stays listed).
    const minimum = page.getByRole('textbox', { name: 'Minimum innings' });
    await expect(minimum).toBeVisible();
    await expect(minimum).toHaveValue('');
    // Changing the sort starts from the column's natural direction again.
    await page.getByRole('button', { name: 'Sort by Runs scored' }).click();
    await expect(page).not.toHaveURL(/dir=/);

    // --- A row opens that player's stats, carrying the board's filters. ---
    const href = await rows.first().getByRole('link').first().getAttribute('href');
    expect(href).toMatch(/^\/manage\/players\/[^/]+\/stats\?.*seasonId=/);
    await rows.first().click();
    await expect(page).toHaveURL(/\/manage\/players\/[^/]+\/stats\?/);
    await expect(page.getByTestId('stats-basis')).toBeVisible({ timeout: 15_000 });

    // --- Back to Leaderboards (the menu) -> Awards: the title block, the minimums pre-filled with defaults, the categories. ---
    await openLeaderboardsFromMenu(page);
    await page.getByRole('tab', { name: 'Awards' }).click();
    await expect(page).toHaveURL(/tab=awards/);
    await expect(page.getByTestId('awards-title')).toBeVisible();
    const minimumInnings = page.getByRole('textbox', { name: 'Minimum innings' });
    const minimumOvers = page.getByRole('textbox', { name: 'Minimum overs' });
    await expect(minimumInnings).toBeVisible();
    await expect(minimumOvers).toBeVisible();
    await expect(minimumInnings).not.toHaveValue('', { timeout: 15_000 }); // pre-filled with the filter-aware default
    await expect(minimumOvers).not.toHaveValue('');
    await expect(page.getByTestId('awards-default-hint')).toContainText(/^Default \d+ and \d+ for these filters\./);
    await expect(page.getByRole('button', { name: 'Reset to default' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Choose categories' })).toBeVisible();
    // At least one award card (or the quiet "nobody qualified" note) is on the sheet.
    await expect(page.locator('[data-testid^="award-"]').first()).toBeVisible();

    // Changing a minimum enables Reset to default, and Reset puts the default back.
    const defaultInnings = await minimumInnings.inputValue();
    await minimumInnings.fill(String(Number(defaultInnings) + 1));
    await expect(page.getByRole('button', { name: 'Reset to default' })).toBeEnabled();
    await page.getByRole('button', { name: 'Reset to default' }).click();
    await expect(minimumInnings).toHaveValue(defaultInnings);
  });

  test('Matches tab -> change Season -> Show more -> open a match -> Back to Matches returns to the same list (115-player-match-list.md)', async ({ page }) => {
    await login(page, CLUB_ADMIN_USERNAME as string, CLUB_ADMIN_PASSWORD as string);
    const playerId = await firstBoardPlayerId(page);
    test.skip(playerId === null, 'the club has no published result with a batting card; capture and publish one first');

    // --- Open the player's stats and switch to Matches; All seasons so a result of any date is listed. ---
    await page.goto(`http://${ROOT_DOMAIN}/manage/players/${playerId}/stats`);
    await expect(page.getByTestId('stats-basis')).toBeVisible({ timeout: 15_000 });
    await chooseSeason(page, 'All seasons');
    await page.getByRole('tab', { name: 'Matches' }).click();
    await expect(page).toHaveURL(/tab=matches/);
    await expect(page.getByRole('tab', { name: 'Matches', selected: true })).toBeVisible();

    // A table row on a desktop, a card on a phone; either way the footer counts the matches.
    const items = page.locator('[data-testid="match-row"], [data-testid="match-card"]');
    const footer = page.getByTestId('matches-footer');
    await expect(items.first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('tile-matches')).toBeVisible();
    await expect(footer).toContainText(/Showing \d+ of \d+ match(es)?/);
    await expect(page.getByText(/^Total/)).toHaveCount(0);

    // --- Change the Season to one the player has data for (only those are offered). ---
    const filtersButton = page.getByRole('button', { name: /^Filters/ });
    const onPhone = await filtersButton.isVisible();
    if (onPhone) {
      await filtersButton.click();
    }
    await page.getByRole('combobox', { name: 'Season' }).click();
    const seasonOptions = page.getByRole('option');
    if ((await seasonOptions.count()) > 1) {
      await seasonOptions.nth(1).click();
    } else {
      await page.keyboard.press('Escape');
    }
    if (onPhone) {
      await page.keyboard.press('Escape');
    }
    await expect(items.first()).toBeVisible({ timeout: 15_000 });
    await expect(footer).toContainText(/Showing \d+ of \d+ match(es)?/);

    // --- Show more, when the server has another page. ---
    const showMore = page.getByRole('button', { name: 'Show more' });
    if (await showMore.isVisible()) {
      const before = await items.count();
      await showMore.click();
      await expect.poll(() => items.count()).toBeGreaterThan(before);
    }

    // --- Open a match: the result page offers Back to Matches, which lands on the same filtered list. ---
    const firstText = await items.first().innerText();
    await page.getByRole('link', { name: /open result/ }).first().click();
    await expect(page).toHaveURL(/\/manage\/results\/[^/?]+$/);
    const back = page.getByRole('link', { name: 'Back to Matches' });
    await expect(back).toBeVisible({ timeout: 15_000 });
    await back.click();
    await expect(page).toHaveURL(new RegExp(`/manage/players/${playerId}/stats\\?.*tab=matches`));
    await expect(page).toHaveURL(/seasonId=/);
    await expect(page.getByRole('tab', { name: 'Matches', selected: true })).toBeVisible();
    await expect(items.first()).toBeVisible({ timeout: 15_000 });
    // The same filters bring back the same newest match at the top (Show more progress is not restored).
    expect(await items.first().innerText()).toBe(firstText);
  });
});
