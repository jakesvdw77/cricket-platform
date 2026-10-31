import { test, expect } from '@playwright/test';
import { createLeagueWithSeason, loginAsClubAdmin } from './helpers/leagueSetup';

/**
 * E2E golden path for docs/specs/127-return-navigation.md: from a league's Schedule the manager opens Manage Schedule, Add
 * Match, saves, and lands back on the schedule showing the match; a reload of the match form keeps its "Back to ..." label.
 *
 * NOT RUN YET: written against the finished build. The match form opens with the league and season preselected; the test saves it
 * as the form stands, so if the form needs more required fields in a fresh club the save step is where to extend it.
 *
 * Runs against a real dev server AND local Keycloak (same prerequisites as manager-league-management.spec.ts).
 * NOT run in CI: skips itself whenever process.env.CI is set.
 */

test.describe('Return navigation golden path (127)', () => {
  test.beforeEach(() => {
    test.skip(!!process.env.CI, 'requires local Keycloak, not wired into CI yet (docs/specs/095 note)');
    test.skip(
      !process.env.E2E_CLUB_ADMIN_USERNAME || !process.env.E2E_CLUB_ADMIN_PASSWORD || !process.env.E2E_CLUB_ADMIN_CLUB_ID,
      'requires E2E_CLUB_ADMIN_USERNAME / E2E_CLUB_ADMIN_PASSWORD / E2E_CLUB_ADMIN_CLUB_ID',
    );
  });

  test('Manage Schedule, Add Match, Save returns to the schedule, and a reload keeps the Back label', async ({ page }) => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const leagueName = `E2E Return League ${suffix}`;

    await loginAsClubAdmin(page);
    await createLeagueWithSeason(page, leagueName, `E2E Return Season ${suffix}`);
    const schedule = new URL(page.url());

    await page.getByTestId('manage-schedule').click();
    await page.getByRole('menuitem', { name: /Add Match/ }).click();
    await expect(page).toHaveURL(/\/manage\/fixtures\/matches\/new/);
    await expect(page).toHaveURL(/returnTo=/);

    // The Back link names the origin, and still does after a reload (the origin lives in the address, not in memory).
    const back = page.getByRole('link', { name: /^Back to / }).or(page.getByRole('button', { name: /^Back to / }));
    await expect(back.first()).toBeVisible();
    const label = await back.first().innerText();
    await page.reload();
    await expect(back.first()).toHaveText(label);

    await page.getByRole('button', { name: /^(Save|Create)/ }).first().click();
    await expect(page).toHaveURL(new RegExp(`${schedule.pathname.replace(/\//g, '\\/')}`));
  });
});
