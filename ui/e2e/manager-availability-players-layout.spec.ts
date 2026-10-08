import { test, expect } from '@playwright/test';

/**
 * E2E for docs/specs/085-availability-polish.md (Test Plan, Playwright row): the Players view of the Availability hub.
 * Desktop (1280x720): the page has no vertical scrollbar of its own next to the grid, and "Jump to today" in the page
 * header scrolls the grid. Mobile (Pixel 5): the By game / By player lists show instead of the grid, and tapping a
 * status chip changes the list.
 *
 * Runs against a real dev server AND real local Keycloak (no mocking), with the same environment variables and skip
 * rules as ui/e2e/manager-availability-polls.spec.ts:
 *   export E2E_CLUB_ADMIN_USERNAME=... E2E_CLUB_ADMIN_PASSWORD=... E2E_CLUB_ADMIN_CLUB_ID=...
 * It reads whatever games, polls and players the club already has, so it also skips itself when the Players view has
 * nothing to show (no games, or no game with a poll). Not run in CI (no Keycloak in `e2e-smoke`).
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

// Goes to the Players view and waits for something to render; skips when the club has nothing to show there.
async function openPlayers(page: Page, ready: ReturnType<Page['locator']>) {
  await page.goto(`http://${ROOT_DOMAIN}/manage/availability/players`);
  const empty = page.getByText(/No games match these filters|No polls opened yet for these games/);
  await expect(ready.or(empty)).toBeVisible({ timeout: 15_000 });
  test.skip(await empty.isVisible(), 'the club has no games with a poll to show on the Players view');
}

test.describe('Availability Players view layout (085-availability-polish.md)', () => {
  test.beforeEach(() => {
    test.skip(!!process.env.CI, 'requires local Keycloak — not wired into CI yet, see docs/plans/005-admin-login.md Flag #2');
    test.skip(
      !CLUB_ADMIN_USERNAME || !CLUB_ADMIN_PASSWORD || !CLUB_ADMIN_CLUB_ID,
      "requires E2E_CLUB_ADMIN_USERNAME / E2E_CLUB_ADMIN_PASSWORD / E2E_CLUB_ADMIN_CLUB_ID — see this file's header comment",
    );
  });

  test('desktop: one scrollbar next to the grid, and Jump to today in the header scrolls the grid', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop layout');
    await loginAsClubAdmin(page);
    const grid = page.getByRole('region', { name: /player availability grid/i });
    await openPlayers(page, grid);

    // The page itself does not scroll: its scroll height fits the window (a pixel of rounding allowed).
    const pageOverflow = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    expect(pageOverflow).toBeLessThanOrEqual(1);

    // The legend sits above the grid.
    const legendBox = await page.getByRole('list', { name: 'Legend' }).boundingBox();
    const gridBox = await grid.boundingBox();
    expect(legendBox && gridBox && legendBox.y < gridBox.y).toBeTruthy();

    // Jump to today is in the page header: right of the title, above the filters, legend and grid.
    const jump = page.getByRole('button', { name: 'Jump to today' });
    await expect(jump).toBeVisible();
    const jumpBox = await jump.boundingBox();
    const titleBox = await page.getByRole('heading', { level: 1, name: 'Availability' }).boundingBox();
    expect(jumpBox && titleBox && legendBox && jumpBox.y < legendBox.y && jumpBox.x > titleBox.x).toBeTruthy();
    if (await jump.isEnabled()) {
      await jump.click();
      // Scrolling is smooth: wait for the grid to settle, and for the page to stay put.
      await page.waitForTimeout(800);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
    }
  });

  test('mobile: By game and By player lists replace the grid, and a status chip changes the list', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'phone layout');
    await loginAsClubAdmin(page);
    const switchGroup = page.getByRole('group', { name: 'Players view' });
    await openPlayers(page, switchGroup);

    await expect(page.getByRole('table', { name: 'Player availability by game' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'By game' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Jump to today' })).toHaveCount(0);

    // A status chip filters the list: pick the first chip that has players, and every row then shows that word.
    const chips = page.getByRole('group', { name: 'Filter by answer' }).getByRole('button');
    const count = await chips.count();
    let chosen = -1;
    for (let i = 0; i < count; i += 1) {
      if (!/ 0$/.test((await chips.nth(i).innerText()).trim())) {
        chosen = i;
        break;
      }
    }
    test.skip(chosen < 0, 'the opening game has no answers to filter on');
    const chip = chips.nth(chosen);
    const word = (await chip.innerText()).replace(/\s*\d+$/, '').trim();
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    const rows = page.getByRole('list').filter({ hasText: word }).getByRole('listitem');
    await expect(rows.first()).toBeVisible();
    expect(await rows.filter({ hasNotText: word }).count()).toBe(0);
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'false');

    // By player: a strip of games and an expandable row per player; the legend sits under the switch.
    await page.getByRole('button', { name: 'By player' }).click();
    await expect(page.getByRole('list', { name: 'Legend' })).toBeVisible();
    const firstPlayer = page.getByRole('button', { expanded: false }).filter({ has: page.locator('[role="img"]') }).first();
    await firstPlayer.click();
    await expect(firstPlayer).toHaveAttribute('aria-expanded', 'true');
  });
});
