import { test, expect } from '@playwright/test';

/**
 * E2E golden path for docs/specs/114-share-result.md's Test Plan (Playwright row) and Acceptance Criteria.
 *
 * NOT RUN LOCALLY: this file was written without a Keycloak, a backend or a dev server to run it against (the
 * Playwright tier here needs all three), so it has never been executed. Treat the first real run as its test: selectors
 * follow the accessible names in the Share dialog's components and the other manager specs, but any of them may need a
 * small adjustment. It is not wired into CI (no Keycloak in `e2e-smoke`) and skips itself whenever process.env.CI is set.
 *
 * What it covers, at the desktop and the mobile viewport (the two projects in playwright.config.ts):
 *  1. Golden path: the manager captures and publishes a result with a scorecard (the opposition's players are typed in
 *     with deliberately distinctive first names), opens Results, taps Share on that published result, picks Image,
 *     switches the template and the size and sees the preview change, switches back to Square 1080 and downloads the PNG
 *     (a download event with 1080 x 1080 pixels read from the PNG header); then opens WhatsApp, makes sure First names as
 *     initials is on, copies the text and checks the clipboard has first initial plus surname ("Z. Quimby") and no full
 *     first name.
 *  2. A draft result shows no Share button (the spec decided that a draft has none, as a published result has no Publish).
 *  3. A short junior-league test: First names as initials is locked on with the visible reason.
 *
 * Runs against a real running dev server AND real local Keycloak (not Testcontainers, no mocking), same as
 * ui/e2e/manager-match-results.spec.ts, whose helpers this follows:
 *   - backend: `cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev` (port 8082)
 *   - frontend: `cd ui && npm run dev` (port 5173)
 *   - Keycloak: `auth.localhost:8180`, realm `cricketlegend`, client `cricketlegend`
 *
 * PREREQUISITES, all from the environment (no credentials live in this repo): the CLUB_ADMIN test account every
 * manager e2e spec uses:
 *   E2E_CLUB_ADMIN_USERNAME / E2E_CLUB_ADMIN_PASSWORD / E2E_CLUB_ADMIN_CLUB_ID
 * The club needs at least one season and one own team (the match form uses the first of each). The junior test also needs
 * E2E_JUNIOR_RESULT_OPPONENT: text that identifies one PUBLISHED result of a junior-league match on the Results page (the
 * opponent's name, say), because a junior league cannot be created from here; the test skips without it.
 */

const ROOT_DOMAIN = process.env.E2E_ROOT_DOMAIN ?? 'localhost:5173';
const CLUB_ADMIN_USERNAME = process.env.E2E_CLUB_ADMIN_USERNAME;
const CLUB_ADMIN_PASSWORD = process.env.E2E_CLUB_ADMIN_PASSWORD;
const CLUB_ADMIN_CLUB_ID = process.env.E2E_CLUB_ADMIN_CLUB_ID;
const JUNIOR_RESULT_OPPONENT = process.env.E2E_JUNIOR_RESULT_OPPONENT;

type Page = import('@playwright/test').Page;

// Distinctive opposition players, so a leaked full first name cannot be mistaken for anything else on the page.
const BOWLER_FIRST = 'Zephaniah';
const BOWLER_LAST = 'Quimby';
const OTHER_OPPOSITION = ['Thaddeus Voorhees', 'Barnaby Oyelaran'];

async function login(page: Page, username: string, password: string) {
  await page.goto(`http://${ROOT_DOMAIN}/login`);
  await page.getByLabel('Username or email').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

// Creates a match against a free-text opponent, dated `daysAgo` days in the past (as manager-match-results.spec.ts does).
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

async function fillInnings(page: Page, row: number, runs: string, wickets: string, overs: string) {
  const innings = page.getByTestId('innings-row').nth(row);
  await innings.getByRole('spinbutton', { name: /runs$/ }).fill(runs);
  await innings.getByRole('spinbutton', { name: /wickets$/ }).fill(wickets);
  await innings.getByLabel('Overs', { exact: true }).fill(overs);
}

// Captures a won-by-runs result WITH a scorecard (the opposition typed in, a first batter bowled by BOWLER) and publishes it,
// following the Teams-first flow of manager-match-results.spec.ts. Leaves the page on the Results list.
async function capturePublishedScorecardResult(page: Page, opponent: string) {
  await createPastMatch(page, opponent, 5);
  await openWizardFor(page, opponent);

  const sidePicker = page.getByRole('radiogroup', { name: 'Who is playing?' });
  await expect(sidePicker.getByRole('radio')).toHaveCount(2);
  const populate = page.getByRole('button', { name: 'Populate from the team' });
  if (await populate.count()) await populate.click();

  await sidePicker.getByRole('radio').nth(1).click();
  await page.getByLabel('Type or paste names, one per line').fill([`1. ${BOWLER_FIRST} ${BOWLER_LAST}`, ...OTHER_OPPOSITION.map((name, index) => `${index + 2}. ${name}`)].join('\n'));
  await page.getByRole('button', { name: 'Add names' }).click();
  await expect(page.getByLabel(`Name, ${BOWLER_FIRST} ${BOWLER_LAST}`)).toBeVisible();

  await nextTo(page, 'Toss and field').click();
  await page.getByRole('radiogroup', { name: 'Who won the toss?' }).getByRole('radio').first().click();
  await page.getByRole('button', { name: 'Bat', exact: true }).click();

  await nextTo(page, 'Result').click();
  await page.getByRole('radio', { name: /^Won/ }).click();
  await page.getByRole('radiogroup', { name: 'Who won?' }).getByRole('radio').first().click();

  // The first batter is bowled by the opposition's distinctive bowler, so his name appears in the share text.
  await nextTo(page, 'Batting').click();
  const firstHowOut = page.getByRole('textbox', { name: /^How out, / }).first();
  await firstHowOut.click();
  await firstHowOut.pressSequentially('b');
  await firstHowOut.press('Enter');
  const bowlerPick = page.getByRole('combobox', { name: /^Bowler, / }).first();
  await bowlerPick.click();
  await page.getByRole('option', { name: `${BOWLER_FIRST} ${BOWLER_LAST}` }).click();

  await nextTo(page, 'Bowling and fielding').click();
  await nextTo(page, 'Awards').click();
  await nextTo(page, 'Scores and margin').click();
  await fillInnings(page, 0, '180', '6', '40');
  await fillInnings(page, 1, '150', '9', '38.4');
  await nextTo(page, 'Review').click();
  const acknowledge = page.getByRole('checkbox', { name: /I have checked these warnings/ });
  if (await acknowledge.count()) await acknowledge.check();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page).toHaveURL(/\/manage\/results$/);
}

const cardFor = (page: Page, text: string) => page.locator('.MuiCard-root').filter({ hasText: text });

// The pixel size of a PNG, read from its IHDR chunk (bytes 16 to 23, big-endian width then height).
function pngSize(bytes: Buffer): { width: number; height: number } {
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test.describe('Share a published result golden path (114-share-result.md)', () => {
  test.beforeEach(() => {
    test.skip(!!process.env.CI, 'requires local Keycloak, not wired into CI yet, see docs/plans/005-admin-login.md Flag #2');
    test.skip(
      !CLUB_ADMIN_USERNAME || !CLUB_ADMIN_PASSWORD || !CLUB_ADMIN_CLUB_ID,
      "requires E2E_CLUB_ADMIN_USERNAME / E2E_CLUB_ADMIN_PASSWORD / E2E_CLUB_ADMIN_CLUB_ID, see this file's prerequisites",
    );
  });

  test('manager shares a published result as an image, then copies the WhatsApp text with first names as initials, and a draft has no Share', async ({ page, context }) => {
    // The clipboard is read back at the end of the test.
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const opponent = `E2E Share Opponents ${uniqueSuffix}`;

    await login(page, CLUB_ADMIN_USERNAME as string, CLUB_ADMIN_PASSWORD as string);
    await expect(page).toHaveURL(new RegExp('/manage$'));
    await capturePublishedScorecardResult(page, opponent);

    // --- Results: the published result has a Share button; Share opens the dialog with the five formats. ---
    const card = cardFor(page, opponent);
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Share' }).click();
    const dialog = page.getByRole('dialog', { name: 'Share result' });
    await expect(dialog.getByRole('radio')).toHaveCount(5);

    // --- Image: change the template and the size and see the preview change. ---
    await dialog.getByRole('radio', { name: /^Image/ }).click();
    const preview = dialog.getByRole('img', { name: /^Result card:/ });
    await expect(preview).toBeVisible();
    const drawn = () => preview.evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL());
    const dimensions = () => preview.evaluate((canvas) => `${(canvas as HTMLCanvasElement).width}x${(canvas as HTMLCanvasElement).height}`);
    await expect.poll(dimensions).toBe('1080x1080');
    const before = await drawn();

    await dialog.getByRole('button', { name: 'Night' }).click();
    await expect.poll(drawn).not.toBe(before);
    await dialog.getByRole('button', { name: 'Portrait 4:5' }).click();
    await expect.poll(dimensions).toBe('1080x1350');

    // --- Back to Square 1080 and download the PNG (the main button is Download where the browser cannot share files; on a
    // phone it is Share with Download beside it, so the Download button is always the one to press here). ---
    await dialog.getByRole('button', { name: 'Square 1080' }).click();
    await expect.poll(dimensions).toBe('1080x1080');
    const downloadButton = dialog.getByRole('button', { name: 'Download PNG' });
    await expect(downloadButton).toBeEnabled();
    const [download] = await Promise.all([page.waitForEvent('download'), downloadButton.click()]);
    expect(download.suggestedFilename()).toMatch(/\.png$/);
    const path = await download.path();
    const fs = await import('node:fs/promises');
    expect(pngSize(await fs.readFile(path))).toEqual({ width: 1080, height: 1080 });

    // --- WhatsApp: First names as initials on, Scorecard text (it lists the players), Copy text. ---
    await dialog.getByRole('button', { name: 'Back' }).click();
    await dialog.getByRole('radio', { name: /WhatsApp/ }).click();
    const message = dialog.getByRole('textbox', { name: 'Message text' });
    await expect(message).toBeVisible();
    await dialog.getByRole('button', { name: 'Scorecard text' }).click();

    const initials = dialog.getByRole('checkbox', { name: 'First names as initials' });
    if (!(await initials.isChecked())) {
      // Off: the full names are shown, so the check below cannot pass vacuously.
      await expect(message).toHaveValue(new RegExp(`${BOWLER_FIRST} ${BOWLER_LAST}`));
      await initials.check();
    }
    // (A locked-on switch, for a junior team, is already checked; either way it is on now.)
    await expect(initials).toBeChecked();
    await expect(message).toHaveValue(new RegExp(`${BOWLER_FIRST[0]}\\. ${BOWLER_LAST}`));

    await dialog.getByRole('button', { name: 'Copy text' }).click();
    await expect(dialog.getByText('Message copied.')).toBeVisible();
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain(`${BOWLER_FIRST[0]}. ${BOWLER_LAST}`);
    for (const full of [BOWLER_FIRST, ...OTHER_OPPOSITION.map((name) => name.split(' ')[0])]) {
      expect(clipboard).not.toContain(full);
    }

    // --- A draft result has no Share button (the spec: Share only on a published result). ---
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog', { name: 'Share result' })).toHaveCount(0);
    const draftOpponent = `E2E Share Draft ${uniqueSuffix}`;
    await createPastMatch(page, draftOpponent, 6);
    await openWizardFor(page, draftOpponent);
    await page.getByRole('button', { name: /^Step \d+: Result/ }).click();
    await page.getByRole('radio', { name: /^Won/ }).click();
    await page.getByRole('radiogroup', { name: 'Who won?' }).getByRole('radio').first().click();
    await page.getByRole('button', { name: /^Step \d+: Scores and margin/ }).click();
    await page.getByRole('radiogroup', { name: 'Who batted first?' }).getByRole('radio').first().click();
    await fillInnings(page, 0, '120', '5', '40');
    await fillInnings(page, 1, '100', '9', '40');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText(/Draft saved/)).toBeVisible();

    await page.goto(`http://${ROOT_DOMAIN}/manage/results`);
    const draftCard = cardFor(page, draftOpponent);
    await expect(draftCard.getByText('Draft', { exact: true })).toBeVisible();
    await expect(draftCard.getByRole('button', { name: 'Share' })).toHaveCount(0);
    await draftCard.getByRole('heading').click();
    await expect(page.getByTestId('result-actions')).toBeVisible();
    await expect(page.getByTestId('result-actions').getByRole('button', { name: 'Share' })).toHaveCount(0);
  });

  test('a result of a junior league opens with First names as initials locked on', async ({ page }) => {
    test.skip(!JUNIOR_RESULT_OPPONENT, 'needs a published result of a junior-league match: set E2E_JUNIOR_RESULT_OPPONENT to text that identifies its card');

    await login(page, CLUB_ADMIN_USERNAME as string, CLUB_ADMIN_PASSWORD as string);
    await expect(page).toHaveURL(new RegExp('/manage$'));
    await page.goto(`http://${ROOT_DOMAIN}/manage/results`);
    await expect(page.getByRole('heading', { name: 'Results', level: 1 })).toBeVisible();

    await cardFor(page, JUNIOR_RESULT_OPPONENT as string).first().getByRole('button', { name: 'Share' }).click();
    const dialog = page.getByRole('dialog', { name: 'Share result' });
    await dialog.getByRole('radio', { name: /WhatsApp/ }).click();

    const initials = dialog.getByRole('checkbox', { name: 'First names as initials' });
    await expect(initials).toBeChecked();
    await expect(initials).toBeDisabled();
    await expect(dialog.getByText('Always on for junior leagues')).toBeVisible();
    // Clicking it changes nothing (force: a disabled control, as the user would try).
    await initials.click({ force: true }).catch(() => undefined);
    await expect(initials).toBeChecked();
  });
});
