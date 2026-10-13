import { test, expect } from '@playwright/test';
import { addFieldInline } from './helpers/addFieldInline';

/**
 * E2E golden path for docs/specs/099-fields-directory.md's Test Plan (Playwright row) and
 * Acceptance Criteria: a club manager creates a match and adds an away field inline from the
 * match form's Field picker (one dialog, no ground or type step), sees the Unverified flag on the
 * match; a platform admin verifies the field from the queue; the manager reloads the match and the
 * flag is gone. A final step (only when a second club admin is configured) has a second club find
 * the now-verified field in the directory and add it to its own fields.
 *
 * Runs against a real running dev server AND real local Keycloak (not Testcontainers, no mocking)
 * — start all of these before running, same as ui/e2e/manager-availability-polls.spec.ts:
 *   - backend: `cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev` (port 8082)
 *   - frontend: `cd ui && npm run dev` (port 5173)
 *   - Keycloak: `auth.localhost:8180`, realm `cricketlegend`, client `cricketlegend`
 *
 * PREREQUISITES, all from the environment (no credentials live in this repo):
 *   - the CLUB_ADMIN test account every manager e2e spec uses:
 *       E2E_CLUB_ADMIN_USERNAME / E2E_CLUB_ADMIN_PASSWORD / E2E_CLUB_ADMIN_CLUB_ID
 *   - the platform admin: E2E_ADMIN_USERNAME / E2E_ADMIN_PASSWORD (default platform-admin / platform-admin,
 *     as admin-login.spec.ts)
 *   - optional, for the last step only: a club admin of a DIFFERENT club:
 *       E2E_CLUB_ADMIN_2_USERNAME / E2E_CLUB_ADMIN_2_PASSWORD / E2E_CLUB_ADMIN_2_CLUB_ID
 *     Without them that step is skipped and the rest still runs.
 *
 * NOT run in CI (no Keycloak in `e2e-smoke`) — skips itself whenever process.env.CI is set.
 */

const ROOT_DOMAIN = process.env.E2E_ROOT_DOMAIN ?? 'localhost:5173';
const CLUB_ADMIN_USERNAME = process.env.E2E_CLUB_ADMIN_USERNAME;
const CLUB_ADMIN_PASSWORD = process.env.E2E_CLUB_ADMIN_PASSWORD;
const CLUB_ADMIN_CLUB_ID = process.env.E2E_CLUB_ADMIN_CLUB_ID;
const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME ?? 'platform-admin';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'platform-admin';
const CLUB_2_USERNAME = process.env.E2E_CLUB_ADMIN_2_USERNAME;
const CLUB_2_PASSWORD = process.env.E2E_CLUB_ADMIN_2_PASSWORD;
const CLUB_2_CLUB_ID = process.env.E2E_CLUB_ADMIN_2_CLUB_ID;
const HAS_SECOND_CLUB = !!CLUB_2_USERNAME && !!CLUB_2_PASSWORD && !!CLUB_2_CLUB_ID;

type Page = import('@playwright/test').Page;

async function login(page: Page, username: string, password: string) {
  await page.goto(`http://${ROOT_DOMAIN}/login`);
  await page.getByLabel('Username or email').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

// Same section-tree helper as manager-availability-polls.spec.ts.
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

test.describe('Fields directory golden path (099-fields-directory.md)', () => {
  test.beforeEach(() => {
    test.skip(!!process.env.CI, 'requires local Keycloak — not wired into CI yet, see docs/plans/005-admin-login.md Flag #2');
    test.skip(
      !CLUB_ADMIN_USERNAME || !CLUB_ADMIN_PASSWORD || !CLUB_ADMIN_CLUB_ID,
      "requires E2E_CLUB_ADMIN_USERNAME / E2E_CLUB_ADMIN_PASSWORD / E2E_CLUB_ADMIN_CLUB_ID — see this file's prerequisites",
    );
  });

  test('manager adds an away field inline from a match, sees it flagged Unverified, a platform admin verifies it and the flag goes', async ({
    page,
    browser,
  }) => {
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sectionName = `E2E Field Section ${uniqueSuffix}`;
    const teamName = `E2E Field Team ${uniqueSuffix}`;
    const seasonLabel = `E2E Field Season ${uniqueSuffix}`;
    const opponentName = `E2E Field Opponents ${uniqueSuffix}`;
    const fieldName = `E2E Away Park ${uniqueSuffix}`;
    const matchTitle = `${teamName} vs ${opponentName}`;
    const today = new Date();
    const matchDateTimeLocal = `${new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}T09:00`;

    await login(page, CLUB_ADMIN_USERNAME as string, CLUB_ADMIN_PASSWORD as string);
    await expect(page).toHaveURL(new RegExp('/manage$'));

    // --- Set-up: a section, a team and a season to hang the match on. ---
    await page.getByRole('link', { name: 'Club Structure' }).click();
    await addTopLevelSection(page, sectionName);
    await page.getByRole('link', { name: 'Manage Teams' }).click();
    await page.getByRole('button', { name: 'Add Team' }).click();
    await page.getByLabel('Name').fill(teamName);
    await page.getByRole('button', { name: 'Create team' }).click();
    await expect(page.locator('.MuiCard-root').filter({ hasText: teamName })).toBeVisible();

    await page.goto(`http://${ROOT_DOMAIN}/manage/fixtures/seasons`);
    await page.getByRole('button', { name: 'Add Season' }).click();
    await page.getByLabel('Label').fill(seasonLabel);
    await page.getByLabel('Start date').fill(`${today.getFullYear()}-01-01`);
    await page.getByLabel('End date').fill(`${today.getFullYear()}-12-31`);
    await page.getByRole('button', { name: 'Create season' }).click();
    await expect(page).toHaveURL(/\/manage\/fixtures\/seasons$/);

    // --- The match, with an away field added inline: no ground, type or playing-area step. ---
    await page.goto(`http://${ROOT_DOMAIN}/manage/fixtures/matches`);
    await page.getByRole('button', { name: 'Add Match' }).click();
    await expect(page).toHaveURL(/\/manage\/fixtures\/matches\/new$/);
    await page.getByLabel('Season').click();
    await page.getByRole('option', { name: seasonLabel, exact: true }).click();
    await page.getByLabel('Match date & time').fill(matchDateTimeLocal);
    await page.getByLabel('Home team').click();
    await page.getByRole('option', { name: teamName, exact: true }).click();
    await page.getByRole('button', { name: 'External opponent' }).nth(1).click();
    await page.getByLabel('Away opponent name').fill(opponentName);

    await addFieldInline(page, fieldName);
    // The picked field is unverified, so the form warns before saving.
    await expect(page.getByText('This field has not been verified yet. The address may be wrong.')).toBeVisible();
    await expect(page.getByText(/area type|playing area|ground/i)).toHaveCount(0);

    await page.getByRole('button', { name: 'Create match' }).click();
    await expect(page).toHaveURL(/\/manage\/fixtures\/matches$/);

    // --- The match shows the Unverified flag on its card and on its page. ---
    const card = page.locator('.MuiCard-root').filter({ hasText: matchTitle });
    await expect(card.getByText('Unverified field')).toBeVisible();
    await page.getByRole('link', { name: matchTitle }).first().click();
    const matchUrl = page.url();
    await expect(page.getByTestId('match-figure-venue')).toContainText(fieldName);
    await expect(page.getByTestId('match-figure-venue')).toContainText('Unverified');

    // --- A platform admin (own browser session) finds it in the queue and verifies it. ---
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await login(adminPage, ADMIN_USERNAME, ADMIN_PASSWORD);
    await expect(adminPage).toHaveURL(/\/admin$/);
    await expect(adminPage.getByText('Fields to verify')).toBeVisible();
    await adminPage.goto(`http://${ROOT_DOMAIN}/admin/fields`);
    await adminPage.getByPlaceholder('Search by field name or city').fill(fieldName);
    const adminCard = adminPage.locator('.MuiCard-root').filter({ hasText: fieldName });
    await expect(adminCard).toBeVisible();
    await adminCard.getByRole('button', { name: 'Change status' }).click();
    await adminPage.getByRole('menuitem', { name: 'Verify' }).click();
    // It leaves the Unverified queue.
    await expect(adminCard).toHaveCount(0);
    await adminContext.close();

    // --- The manager reloads the match: the flag is gone without the match being edited. ---
    await page.goto(matchUrl);
    await expect(page.getByTestId('match-figure-venue')).toContainText(fieldName);
    await expect(page.getByTestId('match-figure-venue')).not.toContainText('Unverified');
    await page.goto(`http://${ROOT_DOMAIN}/manage/fixtures/matches`);
    await expect(page.locator('.MuiCard-root').filter({ hasText: matchTitle })).toBeVisible();
    await expect(page.locator('.MuiCard-root').filter({ hasText: matchTitle }).getByText('Unverified field')).toHaveCount(0);

    // --- A second club finds the verified field in the directory and adds it to its own fields. ---
    await test.step('second club reuses the field (needs E2E_CLUB_ADMIN_2_*)', async () => {
      test.skip(!HAS_SECOND_CLUB, 'requires E2E_CLUB_ADMIN_2_USERNAME / E2E_CLUB_ADMIN_2_PASSWORD / E2E_CLUB_ADMIN_2_CLUB_ID');

      const club2Context = await browser.newContext();
      const club2Page = await club2Context.newPage();
      await login(club2Page, CLUB_2_USERNAME as string, CLUB_2_PASSWORD as string);
      await expect(club2Page).toHaveURL(/\/manage$/);
      await club2Page.goto(`http://${ROOT_DOMAIN}/manage/fixtures/fields`);
      // The directory is platform-wide; the "own fields only" shortlist may hide it, so turn that off.
      const ownOnly = club2Page.getByLabel('Show only our fields').first();
      if (await ownOnly.isChecked()) {
        await ownOnly.uncheck();
      }
      await club2Page.getByPlaceholder('Search by field name or city').fill(fieldName);
      const found = club2Page.locator('.MuiCard-root').filter({ hasText: fieldName });
      await expect(found).toBeVisible();
      await expect(found.getByTestId('field-status-badge')).toHaveText('Verified');
      await found.getByRole('button', { name: 'Add to our fields' }).click();
      await expect(found.getByTestId('field-ours-chip')).toHaveText('Our field');
      await club2Context.close();
    });
  });
});
