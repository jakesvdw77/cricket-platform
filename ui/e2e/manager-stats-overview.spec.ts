import { test, expect } from '@playwright/test';

/**
 * E2E golden path for docs/specs/117-stats-dashboard.md's Test Plan (End-to-end row) and Acceptance Criteria. The user-visible name of the
 * Dashboard is "Overview":
 *   (1) a player with a scorecard: open the player's Statistics, see Overview as the first and landing tab, the four tiles and then the
 *       Batting group open with its three cards, expand Bowling and see its three cards, switch Runs per innings to its table and read a
 *       sum equal to the Runs tile, and open the table of Wickets by type;
 *   (2) a team: open the team page, see the Overview block after the form strip, expanded with five cards, Hide it, Show it, and see the
 *       results total equal the Played tile.
 * Runs at the desktop and the mobile viewport (the two projects in playwright.config.ts).
 *
 * Runs against a real running dev server AND real local Keycloak (not Testcontainers, no mocking)
 * - start all of these before running, same as ui/e2e/manager-player-stats.spec.ts:
 *   - backend: `cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev` (port 9082)
 *   - frontend: `cd ui && npm run dev` (port 5173)
 *   - Keycloak: `auth.localhost:8180`, realm `cricketlegend`, client `cricketlegend`
 *
 * PREREQUISITES, all from the environment (no credentials live in this repo): the CLUB_ADMIN test account every manager e2e spec uses:
 *   E2E_CLUB_ADMIN_USERNAME / E2E_CLUB_ADMIN_PASSWORD / E2E_CLUB_ADMIN_CLUB_ID
 * The club needs at least one PUBLISHED result with a batting card that includes one of its teams (capture and publish one through
 * Results, see ui/e2e/manager-match-results.spec.ts). This spec does not seed results: there is no API-level seeding in this repo.
 * When the club has none the tests skip themselves and say why, rather than failing.
 *
 * NOT run in CI (no Keycloak in `e2e-smoke`) - skips itself whenever process.env.CI is set. (Playwright has not been run since 104: this
 * file is type-checked, not yet run.)
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

// Leaderboards from the menu: the side menu on a desktop, the Menu sheet on a phone.
async function openLeaderboardsFromMenu(page: Page) {
  const menuButton = page.getByRole('button', { name: 'Menu' });
  if (await menuButton.isVisible()) {
    await menuButton.click();
  }
  await page.getByRole('link', { name: /^Leaderboards/ }).first().click();
  await expect(page).toHaveURL(/\/manage\/leaderboards/);
  await expect(page.getByRole('heading', { name: 'Leaderboards', level: 1 })).toBeVisible();
}

// Shows "All seasons" so a result of any date is on the board whatever today's season is.
async function chooseAllSeasons(page: Page) {
  const filtersButton = page.getByRole('button', { name: /^Filters/ });
  const onPhone = await filtersButton.isVisible();
  if (onPhone) {
    await filtersButton.click();
  }
  await page.getByRole('combobox', { name: 'Season' }).click();
  await page.getByRole('option', { name: 'All seasons' }).click();
  if (onPhone) {
    await page.keyboard.press('Escape');
  }
}

// The first row's link on the All-seasons board of the current tab: /manage/<kind>/<id>/stats?..., so the address comes from there.
async function firstBoardStatsHref(page: Page, kind: 'players' | 'teams'): Promise<string | null> {
  const rows = page.getByTestId('standings-row');
  const empty = page.getByText(/No published results match these filters|Nobody is on this table yet|No published results yet/);
  await expect(rows.first().or(empty)).toBeVisible({ timeout: 15_000 });
  if (!(await rows.first().isVisible())) {
    await chooseAllSeasons(page);
    await expect(rows.first().or(empty)).toBeVisible({ timeout: 15_000 });
  }
  if (!(await rows.first().isVisible())) {
    return null;
  }
  const href = await rows.first().getByRole('link').first().getAttribute('href');
  return new RegExp(`^/manage/${kind}/[^/]+/stats`).test(href ?? '') ? href : null;
}

test.describe('Statistics Overview golden paths (117-stats-dashboard.md)', () => {
  test.beforeEach(() => {
    test.skip(!!process.env.CI, 'requires local Keycloak - not wired into CI yet, see docs/plans/005-admin-login.md Flag #2');
    test.skip(
      !CLUB_ADMIN_USERNAME || !CLUB_ADMIN_PASSWORD || !CLUB_ADMIN_CLUB_ID,
      "requires E2E_CLUB_ADMIN_USERNAME / E2E_CLUB_ADMIN_PASSWORD / E2E_CLUB_ADMIN_CLUB_ID - see this file's prerequisites",
    );
  });

  test('Player statistics -> Overview first tab -> tiles then Batting charts -> expand Bowling -> View as table', async ({ page }) => {
    await login(page, CLUB_ADMIN_USERNAME as string, CLUB_ADMIN_PASSWORD as string);
    await openLeaderboardsFromMenu(page);
    const href = await firstBoardStatsHref(page, 'players');
    test.skip(href === null, 'the club has no published result with a batting card; capture and publish one first');

    // --- A link without ?tab= lands on Overview, the first of the six tabs. ---
    const playerStatsPath = (href as string).split('?')[0];
    await page.goto(`http://${ROOT_DOMAIN}${playerStatsPath}`);
    await expect(page.getByRole('tab', { name: 'Overview', selected: true })).toBeVisible({ timeout: 15_000 });
    const tabs = page.getByRole('tablist', { name: 'Statistics' }).getByRole('tab');
    await expect(tabs).toHaveText(['Overview', 'Batting', 'Bowling', 'Fielding', 'Awards & record', 'Matches']);
    await chooseAllSeasons(page);
    await expect(page.getByTestId('stats-basis')).toBeVisible({ timeout: 15_000 });

    // --- The four tiles first, then the Batting group open with its three cards, and Bowling collapsed. ---
    for (const id of ['tile-matches', 'tile-runs', 'tile-wickets', 'tile-catches']) {
      await expect(page.getByTestId(id)).toBeVisible();
    }
    const batting = page.getByTestId('dashboard-group-batting-toggle');
    const bowling = page.getByTestId('dashboard-group-bowling-toggle');
    await expect(batting).toHaveAttribute('aria-expanded', 'true');
    await expect(bowling).toHaveAttribute('aria-expanded', 'false');
    for (const card of ['runs-per-innings', 'dismissals', 'batting-trend']) {
      await expect(page.getByTestId(`dashboard-card-${card}`)).toBeVisible({ timeout: 15_000 });
    }
    await expect(page.getByTestId('dashboard-card-wickets-per-match')).toHaveCount(0);
    // The tiles sit above the charts.
    const tilesBox = await page.getByTestId('tile-runs').boundingBox();
    const chartBox = await page.getByTestId('dashboard-card-runs-per-innings').boundingBox();
    expect((tilesBox?.y ?? 0) < (chartBox?.y ?? 0)).toBe(true);

    // --- Runs per innings as a table: when the whole series is shown, its Total is the Runs tile. ---
    const runsCard = page.getByTestId('dashboard-card-runs-per-innings');
    const toggle = runsCard.getByRole('button', { name: 'View as table' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(runsCard.getByRole('table')).toBeVisible();
    const total = runsCard.getByTestId('runs-per-innings-total');
    if (await total.isVisible()) {
      const tileRuns = ((await page.getByTestId('tile-runs-value').innerText()) ?? '').trim();
      await expect(total.getByRole('cell').nth(2)).toHaveText(tileRuns);
    }
    await toggle.click();
    await expect(runsCard.getByRole('table')).toHaveCount(0);

    // --- Expand Bowling: its three cards appear, in order, labelled Bowling. ---
    await bowling.click();
    await expect(bowling).toHaveAttribute('aria-expanded', 'true');
    for (const card of ['wickets-per-match', 'wickets-by-type', 'economy-rate']) {
      await expect(page.getByTestId(`dashboard-card-${card}`)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId(`${card}-subtitle`)).toHaveText('Bowling');
    }

    // --- Wickets by type as a table: its Total is the server's wicket total, the Wickets tile when the player took wickets. ---
    const typeCard = page.getByTestId('dashboard-card-wickets-by-type');
    const typeToggle = typeCard.getByRole('button', { name: 'View as table' });
    if (await typeToggle.isVisible()) {
      await typeToggle.click();
      const tileWickets = ((await page.getByTestId('tile-wickets-value').innerText()) ?? '').trim();
      await expect(typeCard.getByTestId('wickets-by-type-total').getByRole('cell').nth(1)).toHaveText(tileWickets);
    }

    // --- Existing ?tab links are unchanged: Batting opens Batting, with no overview body. ---
    await page.getByRole('tab', { name: 'Batting' }).click();
    await expect(page).toHaveURL(/tab=batting/);
    await expect(page.getByRole('tab', { name: 'Batting', selected: true })).toBeVisible();
    await expect(page.getByTestId('dashboard-tab')).toHaveCount(0);
  });

  test('Team page -> Overview block after the form strip with five cards -> Hide -> Show -> results total equals Played', async ({ page }) => {
    await login(page, CLUB_ADMIN_USERNAME as string, CLUB_ADMIN_PASSWORD as string);
    await openLeaderboardsFromMenu(page);
    await page.getByRole('tab', { name: 'Teams' }).click();
    await expect(page).toHaveURL(/tab=teams/);
    const href = await firstBoardStatsHref(page, 'teams');
    test.skip(href === null, 'the club has no published result for one of its teams; capture and publish one first');

    await page.goto(`http://${ROOT_DOMAIN}${href as string}`);
    await expect(page.getByTestId('tile-played')).toBeVisible({ timeout: 15_000 });

    // --- The block sits after the form strip, expanded by default, with five cards. ---
    const block = page.getByTestId('team-dashboard');
    await expect(block).toBeVisible();
    const stripBox = await page.getByTestId('team-form-strip').boundingBox();
    const blockBox = await block.boundingBox();
    expect((stripBox?.y ?? 0) < (blockBox?.y ?? 0)).toBe(true);
    const toggle = page.getByTestId('team-dashboard-toggle');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    for (const card of ['results', 'runs-scored', 'run-rate-trend', 'extras-conceded', 'dot-balls']) {
      await expect(block.getByTestId(`dashboard-card-${card}`)).toBeVisible({ timeout: 15_000 });
    }

    // --- Results: the table total is the Played tile. ---
    const results = block.getByTestId('dashboard-card-results');
    await results.getByRole('button', { name: 'View as table' }).click();
    const played = ((await page.getByTestId('tile-played-value').innerText()) ?? '').trim();
    await expect(results.getByTestId('results-total').getByRole('cell').nth(1)).toHaveText(played);

    // --- Hide, then Show: the cards go and come back, the rest of the page stays. ---
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(block.getByTestId('dashboard-card-results')).toHaveCount(0);
    await expect(page.getByTestId('tile-played')).toBeVisible();
    await expect(page.getByTestId('team-record-card')).toBeVisible();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(block.getByTestId('dashboard-card-results')).toBeVisible({ timeout: 15_000 });
  });
});
