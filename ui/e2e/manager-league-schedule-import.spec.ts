import { test, expect } from '@playwright/test';
import { createLeagueWithSeason, isoDateFromToday, loginAsClubAdmin } from './helpers/leagueSetup';

/**
 * E2E golden paths for docs/specs/098-league-schedule-import.md and 125-editable-import-rows.md (End-to-end rows): a club
 * manager opens a league's Schedule, Manage Schedule, Import Schedule, and either (1) uploads a converted CSV or (2) starts with
 * an empty schedule and types two fixtures; then checks the rows, names the new teams, confirms, sees the report and the matches,
 * and deletes the import.
 *
 * NOT RUN YET: written against the finished build. Every name is invented and carries a per-run suffix. Both tests create
 * league teams through the import (no club team is involved), so the scope choice is "All matches" and no Our teams step shows.
 *
 * Runs against a real dev server AND local Keycloak, same prerequisites as ui/e2e/manager-league-management.spec.ts:
 *   E2E_CLUB_ADMIN_USERNAME / E2E_CLUB_ADMIN_PASSWORD / E2E_CLUB_ADMIN_CLUB_ID
 * NOT run in CI (no Keycloak in `e2e-smoke`): skips itself whenever process.env.CI is set.
 */

const CLUB_ADMIN_USERNAME = process.env.E2E_CLUB_ADMIN_USERNAME;
const CLUB_ADMIN_PASSWORD = process.env.E2E_CLUB_ADMIN_PASSWORD;
const CLUB_ADMIN_CLUB_ID = process.env.E2E_CLUB_ADMIN_CLUB_ID;

type Page = import('@playwright/test').Page;

async function openImportSchedule(page: Page) {
  await page.getByTestId('manage-schedule').click();
  await page.getByRole('menuitem', { name: /Import Schedule/ }).click();
  await expect(page).toHaveURL(/\/schedule\/import/);
}

async function confirmAndDelete(page: Page, home: string, away: string) {
  await page.getByRole('button', { name: /^Confirm and create/ }).click();
  await expect(page.getByTestId('report-created-value')).not.toHaveText('0');
  await page.getByRole('link', { name: 'View schedule' }).click();
  await expect(page.getByText(home).first()).toBeVisible();
  await expect(page.getByText(away).first()).toBeVisible();

  // Back to the report through the import history, then delete the import and see the matches go.
  await page.getByTestId('manage-league').click();
  await page.getByRole('menuitem', { name: /Imports/ }).click();
  await page.getByRole('link', { name: /Open|View/ }).first().click();
  await page.getByRole('button', { name: /delete import/i }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete import' }).click();
  await expect(page.getByText(/deleted/i).first()).toBeVisible();
}

test.describe('League schedule import golden paths (098, 125)', () => {
  test.beforeEach(() => {
    test.skip(!!process.env.CI, 'requires local Keycloak, not wired into CI yet (docs/specs/095 note)');
    test.skip(!CLUB_ADMIN_USERNAME || !CLUB_ADMIN_PASSWORD || !CLUB_ADMIN_CLUB_ID, 'requires E2E_CLUB_ADMIN_USERNAME / E2E_CLUB_ADMIN_PASSWORD / E2E_CLUB_ADMIN_CLUB_ID');
  });

  test('uploads a converted CSV, checks the rows, names the teams, confirms, sees the report and deletes the import', async ({ page }) => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const home = `E2E Hawks ${suffix}`;
    const away = `E2E Kites ${suffix}`;
    const csv = ['Date,Start time,Home team,Away team,Venue,Notes', `${isoDateFromToday(7)},09:00,${home},${away},E2E Oval ${suffix},`].join('\n');

    await loginAsClubAdmin(page);
    await createLeagueWithSeason(page, `E2E Import League ${suffix}`, `E2E Import Season ${suffix}`);
    await openImportSchedule(page);

    await page.getByText('All matches').first().click();
    await page.locator('input[type="file"]').setInputFiles({ name: 'schedule.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.getByRole('button', { name: 'Upload and Check Rows' }).click();

    await expect(page.getByRole('table', { name: 'Import rows' })).toContainText(home);
    await page.getByRole('button', { name: 'Next' }).click();
    // Teams step: both names are new, so each is created from its proposal.
    for (const name of [home, away]) {
      await expect(page.getByText(name).first()).toBeVisible();
    }
    for (const create of await page.getByRole('button', { name: /^Create/ }).all()) await create.click();
    await page.getByRole('button', { name: 'Next' }).click();

    await confirmAndDelete(page, home, away);
  });

  test('starts with an empty schedule, types two fixtures, confirms and deletes the import', async ({ page }) => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const teams = [`E2E Lions ${suffix}`, `E2E Tigers ${suffix}`, `E2E Bears ${suffix}`, `E2E Wolves ${suffix}`];

    await loginAsClubAdmin(page);
    await createLeagueWithSeason(page, `E2E Typed League ${suffix}`, `E2E Typed Season ${suffix}`);
    await openImportSchedule(page);

    await page.getByRole('button', { name: 'Start with an empty schedule' }).click();
    await expect(page.getByText('No rows yet. Add the first match.')).toBeVisible();

    for (const [index, [homeName, awayName]] of [[teams[0], teams[1]], [teams[2], teams[3]]].entries()) {
      await page.getByRole('button', { name: 'Add row' }).click();
      await page.getByLabel('Date').fill(isoDateFromToday(7 + index));
      await page.getByLabel('Home team').fill(homeName);
      await page.getByLabel('Away team').fill(awayName);
      await page.getByRole('button', { name: 'Save' }).click();
    }
    await expect(page.getByText('Added').first()).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    for (const create of await page.getByRole('button', { name: /^Create/ }).all()) await create.click();
    await page.getByRole('button', { name: 'Next' }).click();

    await confirmAndDelete(page, teams[0], teams[3]);
  });
});
