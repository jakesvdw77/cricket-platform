import { test, expect } from '@playwright/test';

/**
 * E2E golden path for docs/specs/094-club-structure-and-seasons.md (Test Plan, Playwright row): the Club profile's
 * read-only org chart and its slide-in section panel, then the Seasons page reached from the side menu.
 * Desktop (1280x720): click the first section node in the chart, the slide-in panel opens with the section name as its
 * heading and an Edit link to /manage/sections?sectionId=..., following it lands on /manage/sections; then open Seasons
 * from the side menu and see the heading and the four counters. Mobile (Pixel 5): the nested section list shows instead
 * of the chart, and Seasons is opened from the Menu sheet.
 *
 * Runs against a real dev server AND real local Keycloak (no mocking), with the same environment variables and skip
 * rules as ui/e2e/manager-availability-players-layout.spec.ts:
 *   export E2E_CLUB_ADMIN_USERNAME=... E2E_CLUB_ADMIN_PASSWORD=... E2E_CLUB_ADMIN_CLUB_ID=...
 * It reads whatever sections and seasons the club already has and creates nothing (the add-season step is left to
 * manager-league-management.spec.ts), so it skips itself when the club has no sections. Not run in CI (no Keycloak in
 * `e2e-smoke`).
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

// The Seasons page heading and its four counters (Current shows the season label or None, so it is matched by name).
async function expectSeasonsPage(page: Page) {
  await expect(page).toHaveURL(/\/manage\/fixtures\/seasons$/);
  await expect(page.getByRole('heading', { name: 'Seasons', exact: true })).toBeVisible();
  for (const counter of ['Current', 'Upcoming', 'Past', 'Inactive']) {
    await expect(page.getByText(counter, { exact: true }).first()).toBeVisible();
  }
}

test.describe('Club structure and Seasons (094-club-structure-and-seasons.md)', () => {
  test.beforeEach(() => {
    test.skip(!!process.env.CI, 'requires local Keycloak, not wired into CI yet, see docs/plans/005-admin-login.md Flag #2');
    test.skip(
      !CLUB_ADMIN_USERNAME || !CLUB_ADMIN_PASSWORD || !CLUB_ADMIN_CLUB_ID,
      "requires E2E_CLUB_ADMIN_USERNAME / E2E_CLUB_ADMIN_PASSWORD / E2E_CLUB_ADMIN_CLUB_ID, see this file's header comment",
    );
  });

  test('desktop: a chart node opens the slide-in panel, Edit lands on /manage/sections, Seasons opens from the side menu', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop layout');
    await loginAsClubAdmin(page);
    await page.goto(`http://${ROOT_DOMAIN}/manage/club-profile`);

    const firstNode = page.locator('[data-section-id]').first();
    const empty = page.getByText('No sections yet');
    await expect(firstNode.or(empty)).toBeVisible({ timeout: 15_000 });
    test.skip(await empty.isVisible(), 'the club has no sections to show in the chart');

    // The chart is read-only: no "+" controls.
    await expect(page.getByRole('button', { name: /Add a child section under/ })).toHaveCount(0);

    // Names are not assumed: read the first node's own name.
    const sectionName = (await firstNode.getAttribute('aria-label')) as string;
    await firstNode.click();
    await expect(page.getByRole('heading', { level: 2, name: sectionName })).toBeVisible();
    const edit = page.getByRole('link', { name: 'Edit', exact: true });
    await expect(edit).toHaveAttribute('href', /\/manage\/sections\?sectionId=/);

    await edit.click();
    await expect(page).toHaveURL(/\/manage\/sections/);

    // Seasons from the desktop side menu: heading and the four counters.
    await page.getByRole('link', { name: 'Seasons', exact: true }).click();
    await expectSeasonsPage(page);
  });

  test('mobile: the nested list replaces the chart, and Seasons opens from the Menu sheet', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'phone layout');
    await loginAsClubAdmin(page);
    await page.goto(`http://${ROOT_DOMAIN}/manage/club-profile`);

    const list = page.getByRole('tree', { name: 'Section' });
    const empty = page.getByText('No sections yet');
    await expect(list.or(empty)).toBeVisible({ timeout: 15_000 });
    test.skip(await empty.isVisible(), 'the club has no sections to show in the list');
    await expect(page.locator('[data-section-id]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Expand club structure' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('link', { name: 'Seasons', exact: true }).click();
    await expectSeasonsPage(page);
  });
});
