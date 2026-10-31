import { expect } from '@playwright/test';

type Page = import('@playwright/test').Page;

export const ROOT_DOMAIN = process.env.E2E_ROOT_DOMAIN ?? 'localhost:5173';

export async function loginAsClubAdmin(page: Page) {
  await page.goto(`http://${ROOT_DOMAIN}/login`);
  await page.getByLabel('Username or email').fill(process.env.E2E_CLUB_ADMIN_USERNAME as string);
  await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_CLUB_ADMIN_PASSWORD as string);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/manage$/);
}

/**
 * Creates a league and a season through the UI (same steps as manager-league-management.spec.ts) and leaves the browser on the
 * league's Schedule for that season. The season spans the whole current year, so a fixture dated tomorrow is inside it.
 */
export async function createLeagueWithSeason(page: Page, leagueName: string, seasonLabel: string) {
  const year = new Date().getFullYear();
  await page.goto(`http://${ROOT_DOMAIN}/manage/fixtures/leagues/new`);
  await page.getByLabel('Name').fill(leagueName);
  await page.getByRole('button', { name: 'Create league' }).click();
  await expect(page).toHaveURL(/\/manage\/fixtures\/leagues$/);

  await page.goto(`http://${ROOT_DOMAIN}/manage/fixtures/seasons/new`);
  await page.getByLabel('Label').fill(seasonLabel);
  await page.getByLabel('Start date').fill(`${year}-01-01`);
  await page.getByLabel('End date').fill(`${year}-12-31`);
  await page.getByRole('button', { name: 'Create season' }).click();
  await expect(page).toHaveURL(/\/manage\/fixtures\/seasons$/);

  await page.goto(`http://${ROOT_DOMAIN}/manage/fixtures/leagues`);
  await page.locator('.MuiCard-root').filter({ hasText: leagueName }).getByRole('link', { name: 'View' }).click();
  await expect(page).toHaveURL(/\/manage\/fixtures\/leagues\/[^/]+\/schedule/);
}

// ISO date (yyyy-MM-dd) `days` from today.
export function isoDateFromToday(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
