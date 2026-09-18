import { test, expect } from '@playwright/test';

/**
 * E2E golden path for docs/specs/029-league-management.md, extended to also cover
 * docs/specs/030-team-sheet-communication.md's "Communicate Team Sheet → Print as PDF" flow,
 * docs/specs/031-jersey-numbers.md's standing/per-squad jersey numbers,
 * docs/specs/032-match-availability-polls.md's admin/public poll flow, and
 * docs/specs/033-availability-aware-xi-builder.md's indicator treatment in PlayingXiBuilder plus
 * its own directly-requested (no-spec) admin-override addition (per each spec's own Test Plan,
 * which calls for extending this same golden path rather than a second, parallel one). Per
 * 029's Test Plan (End-to-end row) and Acceptance Criteria: log in as a CLUB_ADMIN-provisioned test
 * user, create a league with enforced age restrictions, create a season, affiliate a team into that
 * league for that season, add players to that team's squad for the season, schedule a match against
 * an external opponent with that league/season attached, build the home side's playing XI (add
 * players, reorder, set captain/wicketkeeper/twelfth man), confirm the playing-XI cap blocks a
 * further add once reached, confirm an age-ineligible player is rejected, reload and confirm every
 * change persisted server-side, then (032) open that side's availability poll from the new
 * Availability tab, generate/inspect the share text, open the poll's public link in a fresh
 * unauthenticated browser context, set a squad member's status there, confirm the admin tab's
 * response count updates on reload, close the poll and confirm the public page goes read-only, then
 * reopen it and confirm it accepts changes again — then (033) with that same poll reopened, set a
 * not-yet-added squad member's public response to Unavailable and confirm the red-tinted
 * "Unavailable for this match" treatment appears on their Home XI tab's Add-player option and
 * Twelfth Man option, set it to Unsure instead and confirm the orange-tinted treatment replaces it,
 * then use the admin-override status Chip on the Availability tab (added directly, no spec) to set
 * a different squad member's status without going through the public link at all — then (030) open
 * that same match's "Communicate Team Sheet" dialog from its card and print a PDF for both sides.
 * (031) Along the way: one squad
 * candidate is given a standing jersey number on their own profile, that number is overridden once
 * they're on the squad, a second squad member is given a squad number from scratch, a third's
 * attempt to reuse the first's squad number is rejected inline with a 409, and after a reload the
 * successful edits persisted, the rejected one didn't, and the first player's own standing number
 * is untouched.
 *
 * Runs against a real running dev server AND real local Keycloak (not Testcontainers, no mocking)
 * — start all of these before running, same as ui/e2e/manager-teams.spec.ts / manager-players.spec.ts:
 *   - backend: `cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev` (port 8082)
 *   - frontend: `cd ui && npm run dev` (port 5173)
 *   - Keycloak: `auth.localhost:8180`, realm `cricketlegend`, client `cricketlegend`
 *     (docs/specs/005-admin-login.md's Implementation-time addendum)
 *
 * PREREQUISITE: this reuses the exact same CLUB_ADMIN test account as
 * ui/e2e/manager-teams.spec.ts / manager-players.spec.ts (see either file's own PREREQUISITE
 * comment, and project memory reference_smoketest_club_admin.md) — provisioned entirely out of
 * band, no in-repo seeding. Provide the same three env vars, no defaults:
 *   export E2E_CLUB_ADMIN_USERNAME=smoketest-club-admin
 *   export E2E_CLUB_ADMIN_PASSWORD='SmokeTest123!'
 *   export E2E_CLUB_ADMIN_CLUB_ID=<that club's id>
 *
 * NOT run in CI (matching every other Keycloak-dependent spec in this repo, e.g.
 * manager-teams.spec.ts) — `.github/workflows/ci.yml`'s `e2e-smoke` job has no Keycloak. Skips
 * itself whenever process.env.CI is set rather than failing that job. Per this spec's own Rollout
 * Notes, this is deliberate — same precedent as every prior /manage spec's E2E tier.
 */

const ROOT_DOMAIN = process.env.E2E_ROOT_DOMAIN ?? 'localhost:5173';
const CLUB_ADMIN_USERNAME = process.env.E2E_CLUB_ADMIN_USERNAME;
const CLUB_ADMIN_PASSWORD = process.env.E2E_CLUB_ADMIN_PASSWORD;
const CLUB_ADMIN_CLUB_ID = process.env.E2E_CLUB_ADMIN_CLUB_ID;

async function completeKeycloakLogin(page: import('@playwright/test').Page) {
  // Keycloak's own login form — not part of this app, so no shared component/selector to reuse
  // (same helper shape as manager-teams.spec.ts's completeKeycloakLogin).
  await page.getByLabel('Username or email').fill(CLUB_ADMIN_USERNAME as string);
  await page.getByLabel('Password', { exact: true }).fill(CLUB_ADMIN_PASSWORD as string);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

async function loginAsClubAdmin(page: import('@playwright/test').Page) {
  await page.goto(`http://${ROOT_DOMAIN}/login`);
  await completeKeycloakLogin(page);
}

// Adds one top-level section via Club Structure's tree editor, renames it to `name`, and leaves it
// selected (auto-selected on create, per SectionTreeEditor) — byte-for-byte
// manager-teams.spec.ts's own addTopLevelSection helper (no shared e2e helper module exists in
// this repo — every spec keeps its own copy). Races the two possible end states of the tree
// (first-run empty vs. a tree already exists from prior manual/e2e runs).
async function addTopLevelSection(page: import('@playwright/test').Page, name: string) {
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

// Opens PlayingXiBuilder's "Add player" Autocomplete, picks `playerName`, sets the role via the
// add-row's own "Role" select (the LAST "Role"-labelled control in DOM order — every already-added
// XI row renders its own "Role" select first, per PlayingXiBuilder.tsx's own JSX order: the ordered
// rows Stack, then the add controls), then submits.
async function addPlayerToXi(
  page: import('@playwright/test').Page,
  playerName: string,
  role: 'Batsman' | 'Bowler' | 'All-rounder',
) {
  await page.getByRole('combobox', { name: 'Add player' }).click();
  await page.getByRole('option', { name: playerName, exact: true }).click();
  await page.getByLabel('Role').last().click();
  await page.getByRole('option', { name: role, exact: true }).click();
  await page.getByRole('button', { name: 'Add player' }).click();
}

test.describe('League Management golden path (029-league-management.md)', () => {
  test.beforeEach(() => {
    test.skip(!!process.env.CI, 'requires local Keycloak — not wired into CI yet, see docs/plans/005-admin-login.md Flag #2');
    test.skip(
      !CLUB_ADMIN_USERNAME || !CLUB_ADMIN_PASSWORD || !CLUB_ADMIN_CLUB_ID,
      'requires E2E_CLUB_ADMIN_USERNAME / E2E_CLUB_ADMIN_PASSWORD / E2E_CLUB_ADMIN_CLUB_ID — no default CLUB_ADMIN fixture exists in this repo, see this file\'s PREREQUISITE comment',
    );
  });

  test('club admin builds a league, season, affiliation, squad, match, and playing XI end to end, with the cap and age-eligibility rules enforced, and every change persists', async ({
    page,
    browser,
  }) => {
    // Date.now() alone can collide across projects (desktop-chromium/mobile-chromium run in
    // parallel workers and can land in the same millisecond) — appending a random component
    // avoids that, per manager-sponsor-contacts.spec.ts's own fix for the same issue.
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sectionName = `E2E League Section ${uniqueSuffix}`;
    const teamName = `E2E League Team ${uniqueSuffix}`;
    const leagueName = `E2E Vets League ${uniqueSuffix}`;
    const seasonLabel = `E2E Season ${uniqueSuffix}`;
    const awayOpponentName = `E2E Occasionals ${uniqueSuffix}`;
    const venue = `E2E Ground ${uniqueSuffix}`;

    const eligible1FullName = `AmaraOne E2ELeague${uniqueSuffix}`;
    const eligible2FullName = `AmaraTwo E2ELeague${uniqueSuffix}`;
    const eligible3FullName = `AmaraThree E2ELeague${uniqueSuffix}`;
    const ineligibleFullName = `AmaraYoung E2ELeague${uniqueSuffix}`;

    // Every "eligible" DOB uses 1 January so the birthday has always already passed by the time
    // this test runs later in the year — a clean, unambiguous age as of the league's own age
    // cutoff date (set to today, below), regardless of exactly which September/October/etc. day
    // this actually runs on.
    const today = new Date();
    const currentYear = today.getFullYear();
    const todayIso = today.toISOString().slice(0, 10);
    const seasonStart = `${currentYear}-01-01`;
    const seasonEnd = `${currentYear}-12-31`;
    const eligible1Dob = `${currentYear - 30}-01-01`;
    const eligible2Dob = `${currentYear - 40}-01-01`;
    const eligible3Dob = `${currentYear - 25}-01-01`;
    const ineligibleDob = `${currentYear - 10}-01-01`;
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const matchDateTimeLocal = `${tomorrow.toISOString().slice(0, 10)}T14:00`;

    await loginAsClubAdmin(page);
    await expect(page).toHaveURL(new RegExp('/manage$'));
    await expect(page.getByText('Not authorized')).not.toBeVisible();

    // --- Team: a section + one team, to affiliate into the league and build a squad for ---

    await page.getByRole('link', { name: 'Club Structure' }).click();
    await expect(page).toHaveURL(/\/manage\/sections$/);
    await addTopLevelSection(page, sectionName);
    await page.getByRole('link', { name: 'Manage Teams' }).click();
    await expect(page).toHaveURL(/\/manage\/sections\/[^/]+\/teams$/);
    await page.getByRole('button', { name: 'Add Team' }).click();
    await page.getByLabel('Name').fill(teamName);
    await page.getByRole('button', { name: 'Create team' }).click();
    await expect(page.locator('.MuiCard-root').filter({ hasText: teamName })).toBeVisible();

    // --- League: create with enforced age restrictions (minAge/maxAge/ageCutoffDate) ---

    await page.goto(`http://${ROOT_DOMAIN}/manage`);
    await page.getByRole('link', { name: 'Fixtures & Results' }).click();
    await expect(page).toHaveURL(/\/manage\/fixtures$/);
    await page.getByRole('link', { name: 'Leagues' }).click();
    await expect(page).toHaveURL(/\/manage\/fixtures\/leagues$/);
    await page.getByRole('button', { name: 'Add League' }).click();
    await expect(page).toHaveURL(/\/manage\/fixtures\/leagues\/new$/);
    await page.getByLabel('Name').fill(leagueName);
    await page.getByLabel('Playing XI size').fill('2');
    await page.getByLabel('Min age').fill('18');
    await page.getByLabel('Max age').fill('60');
    await page.getByLabel('Age cutoff date').fill(todayIso);
    await page.getByRole('button', { name: 'Create league' }).click();
    await expect(page).toHaveURL(/\/manage\/fixtures\/leagues$/);
    const leagueCard = page.locator('.MuiCard-root').filter({ hasText: leagueName });
    await expect(leagueCard).toBeVisible();
    await expect(leagueCard.getByText('Playing XI size')).toBeVisible();

    // --- Season: a single season spanning today, so it's auto-selected everywhere below ---

    await page.getByRole('link', { name: 'Back to Fixtures & Results' }).click();
    await expect(page).toHaveURL(/\/manage\/fixtures$/);
    await page.getByRole('link', { name: 'Seasons' }).click();
    await expect(page).toHaveURL(/\/manage\/fixtures\/seasons$/);
    await page.getByRole('button', { name: 'Add Season' }).click();
    await expect(page).toHaveURL(/\/manage\/fixtures\/seasons\/new$/);
    await page.getByLabel('Label').fill(seasonLabel);
    await page.getByLabel('Start date').fill(seasonStart);
    await page.getByLabel('End date').fill(seasonEnd);
    await page.getByRole('button', { name: 'Create season' }).click();
    await expect(page).toHaveURL(/\/manage\/fixtures\/seasons$/);
    await expect(page.locator('.MuiCard-root').filter({ hasText: seasonLabel })).toBeVisible();

    // --- Affiliation: enter the league, affiliate the team for this season ---

    await page.getByRole('link', { name: 'Back to Fixtures & Results' }).click();
    await page.getByRole('link', { name: 'Leagues' }).click();
    await leagueCard.getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/manage\/fixtures\/leagues\/.+\/edit$/);
    await page.getByRole('tab', { name: 'Affiliations' }).click();
    await page.getByRole('button', { name: 'Add team' }).click();
    await page.getByRole('combobox', { name: 'Search teams' }).click();
    await page.getByRole('option', { name: teamName, exact: true }).click();
    await expect(page.locator('.MuiCard-root').filter({ hasText: teamName })).toBeVisible();

    // --- Players: four squad candidates — three age-eligible, one deliberately too young ---
    //
    // docs/specs/031-jersey-numbers.md: eligible1 also gets a standing jersey number here, set on
    // their own PlayerForm (Basic Info tab) — independent from whatever they end up wearing on this
    // team's squad below. The other three are left without one, matching a real club where not
    // every player has claimed a "usual" number yet.

    await page.goto(`http://${ROOT_DOMAIN}/manage`);
    await page.getByRole('link', { name: 'Players' }).click();
    await expect(page).toHaveURL(/\/manage\/players$/);

    const eligible1StandingJerseyNumber = '77';

    for (const [fullName, dob, standingJerseyNumber] of [
      [eligible1FullName, eligible1Dob, eligible1StandingJerseyNumber],
      [eligible2FullName, eligible2Dob, undefined],
      [eligible3FullName, eligible3Dob, undefined],
      [ineligibleFullName, ineligibleDob, undefined],
    ] as const) {
      const [firstName, lastName] = fullName.split(' ');
      await page.getByRole('button', { name: 'Add Player' }).click();
      await expect(page).toHaveURL(/\/manage\/players\/new$/);
      await page.getByLabel('First name').fill(firstName);
      await page.getByLabel('Last name').fill(lastName);
      await page.getByLabel('Date of birth').fill(dob);
      if (standingJerseyNumber) {
        await page.getByLabel('Jersey number').fill(standingJerseyNumber);
      }
      await page.getByRole('button', { name: 'Create player' }).click();
      await expect(page).toHaveURL(/\/manage\/players$/);
      await expect(page.locator('.MuiCard-root').filter({ hasText: fullName })).toBeVisible();
    }

    // --- Squad: build the team's squad for this season with all four players ---

    await page.goto(`http://${ROOT_DOMAIN}/manage`);
    await page.getByRole('link', { name: 'Club Structure' }).click();
    await page.getByRole('button', { name: sectionName, exact: true }).click();
    await page.getByRole('link', { name: 'Manage Teams' }).click();
    await expect(page).toHaveURL(/\/manage\/sections\/[^/]+\/teams$/);
    await page.locator('.MuiCard-root').filter({ hasText: teamName }).getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/manage\/sections\/[^/]+\/teams\/.+\/edit$/);
    await page.getByRole('tab', { name: 'Squad' }).click();

    for (const fullName of [eligible1FullName, eligible2FullName, eligible3FullName, ineligibleFullName]) {
      await page.getByRole('button', { name: 'Add player' }).click();
      await page.getByRole('combobox', { name: 'Search players' }).click();
      await page.getByRole('option', { name: fullName, exact: true }).click();
      await expect(page.getByText(fullName, { exact: true })).toBeVisible();
    }

    // --- Jersey numbers (docs/specs/031-jersey-numbers.md): each SquadPlayerCard's own "Squad #"
    // Input (aria-labelled "<player's full name> squad number", committing on blur) is edited
    // inline, right here on the same Squad tab the squad itself was just built on. eligible1's
    // squad number already defaulted to their standing number (77, set above) at add-time — it's
    // overridden here to prove the two numbers are independent from that point on; eligible2 is
    // given a squad number from scratch (no standing number of their own).

    const eligible1SquadJerseyNumber = '10';
    const eligible2SquadJerseyNumber = '23';

    const eligible1SquadNumberInput = page.getByLabel(`${eligible1FullName} squad number`);
    await expect(eligible1SquadNumberInput).toHaveValue(eligible1StandingJerseyNumber);
    await eligible1SquadNumberInput.fill(eligible1SquadJerseyNumber);
    await eligible1SquadNumberInput.blur();
    await expect(eligible1SquadNumberInput).toHaveValue(eligible1SquadJerseyNumber);

    const eligible2SquadNumberInput = page.getByLabel(`${eligible2FullName} squad number`);
    await eligible2SquadNumberInput.fill(eligible2SquadJerseyNumber);
    await eligible2SquadNumberInput.blur();
    await expect(eligible2SquadNumberInput).toHaveValue(eligible2SquadJerseyNumber);

    // Attempt to give eligible3 the same number eligible1 now wears on this squad — blocked
    // server-side (409, DuplicateSquadJerseyNumberException) and surfaced as inline feedback on
    // eligible3's own card only (RecordCard's `feedback` prop), never a page-level toast, and never
    // touching eligible1's/eligible2's own cards.
    const eligible3Card = page.locator('.MuiCard-root').filter({ hasText: eligible3FullName });
    const eligible3SquadNumberInput = eligible3Card.getByLabel(`${eligible3FullName} squad number`);
    await eligible3SquadNumberInput.fill(eligible1SquadJerseyNumber);
    await eligible3SquadNumberInput.blur();
    await expect(eligible3Card.getByText(/already assigned/i)).toBeVisible();

    // Reload this tab — the two successful edits persisted server-side, and the rejected duplicate
    // never did (eligible3's own squad number stays unset).
    await page.reload();
    await page.getByRole('tab', { name: 'Squad' }).click();
    await expect(page.getByLabel(`${eligible1FullName} squad number`)).toHaveValue(eligible1SquadJerseyNumber);
    await expect(page.getByLabel(`${eligible2FullName} squad number`)).toHaveValue(eligible2SquadJerseyNumber);
    await expect(page.getByLabel(`${eligible3FullName} squad number`)).toHaveValue('');

    // eligible1's own standing jersey number (set on their PlayerForm, above) is unaffected by the
    // squad-number override just made above — the two numbers are independently stored and edited,
    // per this spec's two-number model.
    await page.goto(`http://${ROOT_DOMAIN}/manage`);
    await page.getByRole('link', { name: 'Players' }).click();
    await page
      .locator('.MuiCard-root')
      .filter({ hasText: eligible1FullName })
      .getByRole('link', { name: 'Edit' })
      .click();
    await expect(page).toHaveURL(/\/manage\/players\/.+\/edit$/);
    await expect(page.getByLabel('Jersey number')).toHaveValue(eligible1StandingJerseyNumber);

    // --- Match: schedule against an external (free-text) opponent, with the league/season attached ---

    await page.goto(`http://${ROOT_DOMAIN}/manage`);
    await page.getByRole('link', { name: 'Fixtures & Results' }).click();
    await page.getByRole('link', { name: 'Matches' }).click();
    await expect(page).toHaveURL(/\/manage\/fixtures\/matches$/);
    await page.getByRole('button', { name: 'Add Match' }).click();
    await expect(page).toHaveURL(/\/manage\/fixtures\/matches\/new$/);

    await page.getByLabel('Season').click();
    await page.getByRole('option', { name: seasonLabel, exact: true }).click();
    await page.getByLabel('League').click();
    await page.getByRole('option', { name: leagueName, exact: true }).click();
    await page.getByLabel('Match date & time').fill(matchDateTimeLocal);
    await page.getByLabel('Venue').fill(venue);

    // Home side defaults to "One of our teams" already — just pick this club's own team.
    await page.getByLabel('Home team').click();
    await page.getByRole('option', { name: teamName, exact: true }).click();

    // Away side: toggle to "External opponent" — the SECOND such toggle button in DOM order
    // (Home side's own identical-labelled toggle button renders first, per MatchForm.tsx's own
    // Home-side-before-Away-side JSX order); Home side is left in its default "team" mode.
    await page.getByRole('button', { name: 'External opponent' }).nth(1).click();
    await page.getByLabel('Away opponent name').fill(awayOpponentName);

    await page.getByRole('button', { name: 'Create match' }).click();
    await expect(page).toHaveURL(/\/manage\/fixtures\/matches$/);

    const matchTitle = `${teamName} vs ${awayOpponentName}`;
    const matchCard = page.locator('.MuiCard-root').filter({ hasText: matchTitle });
    await expect(matchCard).toBeVisible();

    // --- Playing XI: open the match, build the home side's XI ---

    await matchCard.getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/manage\/fixtures\/matches\/.+\/edit$/);
    await page.getByRole('tab', { name: 'Home XI' }).click();
    await expect(page.getByText('0 / 2')).toBeVisible();

    // Add the first eligible player — succeeds, cap not yet reached.
    await addPlayerToXi(page, eligible1FullName, 'Batsman');
    await expect(page.getByText('1 / 2')).toBeVisible();

    // Attempt to add the age-ineligible player — blocked server-side (below the league's own
    // minAge as of its ageCutoffDate), surfaced inline rather than silently failing. The XI count
    // stays unchanged.
    await page.getByRole('combobox', { name: 'Add player' }).click();
    await page.getByRole('option', { name: ineligibleFullName, exact: true }).click();
    await page.getByRole('button', { name: 'Add player' }).click();
    await expect(page.getByRole('alert')).toContainText('minAge');
    await expect(page.getByText('1 / 2')).toBeVisible();

    // Add the second eligible player — reaches the league's own configured cap of 2.
    await addPlayerToXi(page, eligible2FullName, 'Bowler');
    await expect(page.getByText('2 / 2')).toBeVisible();

    // Attempting to exceed the cap is blocked at the UI itself — the add control disables outright
    // once the cap is reached, rather than allowing a doomed request.
    await expect(page.getByText(/playing XI is full/i)).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Add player' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Add player' })).toBeDisabled();

    // Reorder: move the second-added player to the top of the batting order.
    await page.getByRole('button', { name: `Move ${eligible2FullName} up` }).click();

    // Captain, wicketkeeper (both drawn from the ordered XI), and twelfth man (drawn from the
    // squad but NOT counted against the cap, so the third eligible player — never added to the
    // XI — is a valid choice here).
    await page.getByLabel('Captain').click();
    await page.getByRole('option', { name: eligible2FullName, exact: true }).click();
    await page.getByLabel('Wicketkeeper').click();
    await page.getByRole('option', { name: eligible1FullName, exact: true }).click();
    await page.getByLabel('Twelfth man').click();
    await page.getByRole('option', { name: eligible3FullName, exact: true }).click();

    await expect(page.getByText('C', { exact: true })).toBeVisible();
    await expect(page.getByText('WK', { exact: true })).toBeVisible();

    // --- Reload — every change persisted server-side, not just in client state ---

    await page.reload();
    await page.getByRole('tab', { name: 'Home XI' }).click();
    await expect(page.getByText('2 / 2')).toBeVisible();

    // Batting order persisted: eligible2 (moved up) leads, eligible1 follows — proven via the
    // reorder IconButtons' own disabled state (the first row's "up" is disabled, the last row's
    // "down" is disabled) rather than bare name text, since eligible1/eligible2's names are each
    // also independently rendered a second time as the Wicketkeeper/Captain selects' own display
    // value below, which would otherwise make a plain getByText(name) ambiguous (strict-mode
    // violation).
    await expect(page.getByRole('button', { name: `Move ${eligible2FullName} up` })).toBeDisabled();
    await expect(page.getByRole('button', { name: `Move ${eligible1FullName} down` })).toBeDisabled();

    // Captain/keeper/twelfth-man selections persisted.
    await expect(page.getByLabel('Captain')).toHaveText(eligible2FullName);
    await expect(page.getByLabel('Wicketkeeper')).toHaveText(eligible1FullName);
    await expect(page.getByLabel('Twelfth man')).toHaveText(eligible3FullName);
    await expect(page.getByText('C', { exact: true })).toBeVisible();
    await expect(page.getByText('WK', { exact: true })).toBeVisible();

    // The cap-disabled state still holds — the age-ineligible player was never added, and the two
    // eligible players added earlier still fill the cap.
    await expect(page.getByRole('combobox', { name: 'Add player' })).toBeDisabled();

    // --- Availability poll (docs/specs/032-match-availability-polls.md): still on this same
    // match's edit page (Home XI tab) — open the home side's Availability tab, open a poll for the
    // full season squad (all four squad candidates added earlier, independent of who made the XI),
    // generate/inspect the share text, respond via the poll's own public link from a genuinely
    // fresh, unauthenticated browser context, confirm the admin side sees the updated response
    // count on reload, close the poll (public page goes read-only), then reopen it (writable again).

    await page.getByRole('tab', { name: 'Availability' }).click();
    await expect(page.getByRole('tab', { name: 'Home' })).toBeVisible();
    await expect(page.getByText(/no availability poll yet/i)).toBeVisible();
    await page.getByRole('button', { name: /open a poll for this side/i }).click();

    // Poll created open, with the full season squad (not just the playing XI) and every member
    // starting at "No response" — the four SummaryTile <h6> counts render in a fixed
    // Available/Unavailable/Unsure/No-response order (MatchAvailabilityTab.tsx), the only <h6> (and
    // therefore the only level-6 heading) rendered anywhere on this tab.
    await expect(page.getByText(eligible1FullName)).toBeVisible();
    const summaryCounts = page.getByRole('heading', { level: 6 });
    await expect(summaryCounts).toHaveCount(4);
    await expect(summaryCounts.nth(3)).toHaveText('4'); // No response

    // Share invite: generates a channel-agnostic, plain-text invite embedding this poll's own
    // public link — inspect it, then pull the link out to visit as an unauthenticated visitor.
    await page.getByRole('button', { name: /share invite/i }).click();
    await expect(page.getByRole('heading', { name: 'Share invite' })).toBeVisible();
    const inviteText = await page.getByLabel('Invite text').inputValue();
    const pollLinkMatch = inviteText.match(/https?:\/\/\S+\/poll\/[0-9a-fA-F-]+/);
    expect(pollLinkMatch).not.toBeNull();
    const pollLink = (pollLinkMatch as RegExpMatchArray)[0];
    await page.getByRole('button', { name: /^close$/i }).click();
    await expect(page.getByRole('heading', { name: 'Share invite' })).not.toBeVisible();

    // A real second browser context with zero auth state — not this same authenticated page
    // navigating to a public URL — proving the public page is genuinely reachable pre-login.
    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    await publicPage.goto(pollLink);
    await expect(publicPage.getByText(`${teamName} vs ${awayOpponentName}`)).toBeVisible();

    // Tap eligible1's own row to set Available — eligible1's squad jersey number (set earlier) is
    // shown alongside their name, per PublicAvailabilityPoll.tsx's own squadDisplayName format.
    const eligible1SquadDisplayName = `#${eligible1SquadJerseyNumber} ${eligible1FullName}`;
    const eligible1AvailableToggle = publicPage.getByLabel(`${eligible1SquadDisplayName}: Available`);
    await eligible1AvailableToggle.click();
    await expect(eligible1AvailableToggle).toHaveAttribute('aria-pressed', 'true');

    // Reload the admin tab (a fresh navigation, not just client state) — the response count
    // reflects the public response just made.
    await page.reload();
    await page.getByRole('tab', { name: 'Availability' }).click();
    await expect(page.getByRole('tab', { name: 'Home' })).toBeVisible();
    await expect(summaryCounts.nth(0)).toHaveText('1'); // Available
    await expect(summaryCounts.nth(3)).toHaveText('3'); // No response

    // Close the poll — the switch (a real MUI Switch, not a button) flips it closed.
    await page.getByRole('checkbox').click();
    await expect(page.getByText(/^poll closed$/i)).toBeVisible();

    // The public page, reloaded, is now read-only — every row's toggle group is disabled.
    await publicPage.reload();
    await expect(publicPage.getByText(/this poll is closed/i)).toBeVisible();
    await expect(eligible1AvailableToggle).toBeDisabled();

    // Reopen it — the public page, reloaded again, accepts changes once more.
    await page.getByRole('checkbox').click();
    await expect(page.getByText(/^poll open$/i)).toBeVisible();

    await publicPage.reload();
    await expect(publicPage.getByText(/this poll is closed/i)).not.toBeVisible();
    await expect(eligible1AvailableToggle).toBeEnabled();

    // --- Availability-aware XI builder (docs/specs/033-availability-aware-xi-builder.md): reuses
    // this same, now-reopened poll. eligible3 is a genuine "not yet added" candidate — set as
    // Twelfth Man above but never added to the ordered XI itself — so setting their public
    // response exercises both the Add-player Autocomplete and the Twelfth Man Select without
    // touching anyone already in the batting order.
    await publicPage.getByLabel(`${eligible3FullName}: Unavailable`).click();

    await page.getByRole('tab', { name: 'Home XI' }).click();
    await page.getByRole('combobox', { name: 'Add player' }).click();
    // Accessible name concatenates the option's name + caption once tinted, so this can no longer
    // be an exact match — a substring/regex lookup is the correct query from here on.
    const eligible3AddOption = page.getByRole('option', { name: new RegExp(eligible3FullName) });
    await expect(eligible3AddOption).toContainText(/unavailable for this match/i);
    await expect(eligible3AddOption).toHaveCSS('background-color', 'rgba(176, 64, 46, 0.16)');
    await page.keyboard.press('Escape');

    await page.getByLabel('Twelfth man').click();
    const eligible3TwelfthManOption = page.getByRole('option', { name: new RegExp(eligible3FullName) });
    await expect(eligible3TwelfthManOption).toContainText(/unavailable for this match/i);
    await page.keyboard.press('Escape');

    // A different response — Unsure — via the same public link; confirm the orange treatment
    // (not the red one above) shows wherever eligible3's name is displayed in the builder.
    await publicPage.getByLabel(`${eligible3FullName}: Unsure`).click();
    await page.getByLabel('Twelfth man').click();
    const eligible3UnsureOption = page.getByRole('option', { name: new RegExp(eligible3FullName) });
    await expect(eligible3UnsureOption).toContainText(/marked unsure for this match/i);
    await expect(eligible3UnsureOption).toHaveCSS('background-color', 'rgba(183, 121, 31, 0.16)');
    await page.keyboard.press('Escape');

    // --- Admin override (added directly, no spec — see the branch's own commit history): the
    // admin can set a squad member's status straight from the Availability tab's status Chip,
    // independent of the public link.
    await page.getByRole('tab', { name: 'Availability' }).click();
    await expect(page.getByRole('tab', { name: 'Home' })).toBeVisible();
    const eligible2StatusChip = page.getByRole('button', { name: new RegExp(`set.*${eligible2FullName}.*availability`, 'i') });
    await eligible2StatusChip.click();
    await page.getByRole('menuitem', { name: 'Unavailable' }).click();
    await expect(eligible2StatusChip).toHaveText(/unavailable/i);

    await publicContext.close();

    // --- Communicate Team Sheet (docs/specs/030-team-sheet-communication.md): extends this same
    // golden path per that spec's own Test Plan (End-to-end row) rather than a second, parallel
    // flow. This match's home side is a real, fully-printable Team (2/2 XI just built above); its
    // away side is the free-text `awayOpponentName` opponent scheduled earlier — no roster exists
    // for it, so its own scope option must stay disabled while "Both Teams" stays available.

    await page.getByRole('link', { name: 'Back to Matches' }).click();
    await expect(page).toHaveURL(/\/manage\/fixtures\/matches$/);
    await expect(matchCard).toBeVisible();

    await matchCard.getByRole('button', { name: 'Communicate Team Sheet' }).click();
    const teamSheetDialogHeading = page.getByRole('heading', { name: 'Communicate Team Sheet' });
    await expect(teamSheetDialogHeading).toBeVisible();

    // Away side is a free-text opponent (no MatchSide/roster to print), so its own scope option
    // (ToggleButton, labelled with the opponent's free-text name per TeamSheetCommunicationDialog.tsx)
    // is disabled; "Both Teams" stays enabled because the home side alone is printable.
    await expect(page.getByRole('button', { name: awayOpponentName })).toBeDisabled();
    const bothTeamsOption = page.getByRole('button', { name: 'Both Teams' });
    await expect(bothTeamsOption).toBeEnabled();

    // "Both Teams" is already the dialog's own default scope whenever at least one side is
    // printable (TeamSheetCommunicationDialog.tsx's defaultScope) — select it explicitly anyway so
    // this assertion doesn't silently depend on that default never changing.
    await bothTeamsOption.click();

    // window.open(url, '_blank') (MatchCard's handlePrint, ui/src/pages/manage/MatchList.tsx)
    // surfaces as a new Page on this same browser context in Playwright — start waiting for it
    // before the click that triggers it.
    const teamSheetPopupPromise = page.context().waitForEvent('page');
    await page.getByRole('button', { name: 'Print Both Teams' }).click();
    const teamSheetPopup = await teamSheetPopupPromise;
    await teamSheetPopup.waitForLoadState('domcontentloaded');
    expect(teamSheetPopup.url()).toMatch(/^blob:/);

    // TeamSheetCommunicationDialog.tsx's handlePrint calls onClose() once onPrint resolves
    // successfully — confirms the dialog itself didn't stay open after a successful print.
    await expect(teamSheetDialogHeading).not.toBeVisible();
  });
});
