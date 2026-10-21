import { test, expect } from '@playwright/test';

/**
 * E2E golden path for docs/specs/116-team-stats.md's Test Plan (End-to-end row) and Acceptance Criteria:
 * Leaderboards -> Teams tab -> the table sorted by Wins -> reverse the sort -> change the Season -> open a team -> see the record,
 * the form strip and the highlights -> Back lands on the same sorted, filtered table -> open the same team from its Team detail
 * page's Statistics card.
 * Runs at the desktop and the mobile viewport (the two projects in playwright.config.ts).
 *
 * Runs against a real running dev server AND real local Keycloak (not Testcontainers, no mocking)
 * - start all of these before running, same as ui/e2e/manager-player-stats.spec.ts:
 *   - backend: `cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev` (port 8082)
 *   - frontend: `cd ui && npm run dev` (port 5173)
 *   - Keycloak: `auth.localhost:8180`, realm `cricketlegend`, client `cricketlegend`
 *
 * PREREQUISITES, all from the environment (no credentials live in this repo): the CLUB_ADMIN test account every manager e2e spec uses:
 *   E2E_CLUB_ADMIN_USERNAME / E2E_CLUB_ADMIN_PASSWORD / E2E_CLUB_ADMIN_CLUB_ID
 * The club needs at least one PUBLISHED result that includes one of its teams (capture and publish one through Results, see
 * ui/e2e/manager-match-results.spec.ts). This spec does not seed results: there is no API-level seeding in this repo. When the club
 * has none the test skips itself and says why, rather than failing.
 *
 * NOT run in CI (no Keycloak in `e2e-smoke`) - skips itself whenever process.env.CI is set.
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

// Picks another Season than the one shown when the club has more than one with data; otherwise leaves the filter alone.
// A phone keeps its filters in a bottom sheet behind the Filters button.
async function changeSeason(page: Page) {
  const filtersButton = page.getByRole('button', { name: /^Filters/ });
  const onPhone = await filtersButton.isVisible();
  if (onPhone) {
    await filtersButton.click();
  }
  await page.getByRole('combobox', { name: 'Season' }).click();
  const options = page.getByRole('option');
  if ((await options.count()) > 1) {
    await options.nth(1).click();
  } else {
    await page.keyboard.press('Escape');
  }
  if (onPhone) {
    await page.keyboard.press('Escape');
  }
}

test.describe('Team statistics golden path (116-team-stats.md)', () => {
  test.beforeEach(() => {
    test.skip(!!process.env.CI, 'requires local Keycloak - not wired into CI yet, see docs/plans/005-admin-login.md Flag #2');
    test.skip(
      !CLUB_ADMIN_USERNAME || !CLUB_ADMIN_PASSWORD || !CLUB_ADMIN_CLUB_ID,
      "requires E2E_CLUB_ADMIN_USERNAME / E2E_CLUB_ADMIN_PASSWORD / E2E_CLUB_ADMIN_CLUB_ID - see this file's prerequisites",
    );
  });

  test('Leaderboards -> Teams -> sort and reverse -> change Season -> team page -> Back to the same table -> Statistics card on Team detail', async ({ page }) => {
    await login(page, CLUB_ADMIN_USERNAME as string, CLUB_ADMIN_PASSWORD as string);
    await openLeaderboardsFromMenu(page);

    // --- The Teams tab: every team with a counted result, ranked by Wins. ---
    await page.getByRole('tab', { name: 'Teams' }).click();
    await expect(page).toHaveURL(/tab=teams/);
    await expect(page.getByRole('tab', { name: 'Teams', selected: true })).toBeVisible();
    const rows = page.getByTestId('standings-row');
    const empty = page.getByText(/No published results (yet|match these filters)/);
    await expect(rows.first().or(empty)).toBeVisible({ timeout: 15_000 });
    test.skip(!(await rows.first().isVisible()), 'the club has no published result for one of its teams; capture and publish one first');
    await expect(page.getByRole('table', { name: 'Teams statistics' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Sort by' })).toContainText('Wins');
    await expect(page.getByRole('columnheader', { name: /^W/ }).first()).toBeVisible();
    await expect(page.getByTestId('board-footer')).toContainText(/Showing \d+ of \d+ teams\./);
    await expect(page.getByTestId('board-footer')).toContainText(/Based on \d+ published results?\./);
    await expect(page.getByRole('combobox', { name: 'Team' })).toHaveCount(0);

    // --- Reverse the sort (the heading again). ---
    await page.getByRole('button', { name: /^Wins, sorted descending/ }).click();
    await expect(page).toHaveURL(/dir=asc/);
    await expect(page.getByRole('button', { name: /^Wins, sorted ascending/ })).toBeVisible();

    // --- Change the Season; the table is reloaded under it (or says nothing matches). ---
    await changeSeason(page);
    await expect(rows.first().or(empty)).toBeVisible({ timeout: 15_000 });
    test.skip(!(await rows.first().isVisible()), 'the club has no published team result in the other season; the rest of the path needs one');

    // --- Open a team: the page carries the filters; record, form strip and highlights show. ---
    const firstLink = rows.first().getByRole('link').first();
    const teamName = ((await firstLink.innerText()) ?? '').trim();
    const href = (await firstLink.getAttribute('href')) ?? '';
    expect(href).toMatch(/^\/manage\/teams\/[^/]+\/stats\?.*seasonId=/);
    const teamId = /\/manage\/teams\/([^/]+)\/stats/.exec(href)?.[1] ?? '';
    await firstLink.click();
    await expect(page).toHaveURL(new RegExp(`/manage/teams/${teamId}/stats`));
    await expect(page.getByRole('heading', { name: teamName, level: 1 })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('stats-basis')).toContainText(/Based on \d+ published results?\./);
    await expect(page.getByTestId('tile-played')).toBeVisible();
    await expect(page.getByTestId('tile-win-percent')).toBeVisible();
    await expect(page.getByTestId('team-form-strip')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Last results, newest first' }).getByRole('link').first()).toBeVisible();
    await expect(page.getByTestId('team-record-card')).toBeVisible();
    await expect(page.getByTestId('team-highlights-card')).toBeVisible();
    await expect(page.getByTestId('team-nrr-card')).toBeVisible();
    await expect(page.getByTestId('not-captured-panel')).toContainText('Partnerships');

    // --- Back returns to the same Teams table: same tab, same (reversed) Wins sort. ---
    await page.getByRole('link', { name: 'Back to Teams' }).click();
    await expect(page).toHaveURL(/\/manage\/leaderboards\?.*tab=teams/);
    await expect(page).toHaveURL(/dir=asc/);
    await expect(page.getByRole('tab', { name: 'Teams', selected: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Wins, sorted ascending/ })).toBeVisible({ timeout: 15_000 });
    await expect(rows.first()).toBeVisible();

    // --- The same team from its Team detail page's Statistics card (the Teams list opens the detail page). ---
    await page.goto(`http://${ROOT_DOMAIN}/manage/teams`);
    await page.getByRole('link', { name: teamName, exact: true }).first().click();
    const card = page.getByTestId('team-statistics-card');
    await expect(card).toBeVisible({ timeout: 15_000 });
    const viewStatistics = card.getByRole('link', { name: 'View statistics' });
    await expect(viewStatistics).toHaveAttribute('href', `/manage/teams/${teamId}/stats`);
    await viewStatistics.click();
    await expect(page).toHaveURL(new RegExp(`/manage/teams/${teamId}/stats`));
    await expect(page.getByRole('heading', { name: teamName, level: 1 })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('tile-played')).toBeVisible();
  });
});
