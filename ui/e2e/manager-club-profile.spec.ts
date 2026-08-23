import { test, expect } from '@playwright/test';

/**
 * E2E golden paths for docs/specs/020-club-manager-access.md, per its Test Plan and Acceptance
 * Criteria:
 *   1. Log in as a CLUB_ADMIN-provisioned test user, land on /manage (not "Not authorized"),
 *      open Club Profile, edit a field, save, reload, and confirm it persisted.
 *   2. Separately, a direct page refresh on /manage (already logged in) keeps the session rather
 *      than dropping to a logged-out state — this is what actually verifies keycloak.ts's
 *      AUTH_AWARE_PATH_PREFIXES fix (adding '/manage' alongside '/admin') in a real browser,
 *      not just in a unit test.
 *
 * Runs against a real running dev server AND real local Keycloak (not Testcontainers, no mocking)
 * — start all of these before running, same as ui/e2e/admin-login.spec.ts:
 *   - backend: `cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev` (port 8082)
 *   - frontend: `cd ui && npm run dev` (port 5173)
 *   - Keycloak: `auth.localhost:8180`, realm `cricketlegend`, client `cricketlegend`
 *     (docs/specs/005-admin-login.md's Implementation-time addendum)
 *
 * PREREQUISITE: a CLUB_ADMIN test identity must exist, provisioned entirely out of band — there is
 * no in-repo seeding for this, and (unlike admin-login.spec.ts's platform-admin/platform-admin
 * defaults) there is no seeded default CLUB_ADMIN account in this repo either, so all three env
 * vars below are required with no fallback. Two ways to provision one, per docs/specs/020-club-
 * manager-access.md's Rollout Notes:
 *
 *   1. Drive the real Subscription-creation flow (/admin/billing, per docs/specs/016-keycloak-
 *      account-provisioning.md) for a known ACTIVE club with a real responsible-person email —
 *      016's SubscriptionServiceImpl.create() auto-provisions a Keycloak user AND a matching
 *      RoleAssignment(CLUB_ADMIN, CLUB, <that club's id>) end to end, no manual RoleAssignment
 *      step needed. Set the Keycloak password via the "forgot password" flow (or the Keycloak
 *      console) so it's known.
 *   2. Or, provision directly: create a Keycloak user in the `cricketlegend` realm via the
 *      console (out of band, same as admin-login.spec.ts's platform_admin user), then manually
 *      insert/confirm a matching `Person(keycloakUserId = <that user's Keycloak id>)` row and a
 *      `RoleAssignment(role = CLUB_ADMIN, scopeType = CLUB, scopeId = <a known Club's id>)` row
 *      against the local `cricketlegend_platform` database.
 *
 * Provide the resulting credentials and club id via E2E_CLUB_ADMIN_USERNAME /
 * E2E_CLUB_ADMIN_PASSWORD / E2E_CLUB_ADMIN_CLUB_ID — no defaults, since (unlike the platform_admin
 * case) there is no standard seeded identity to fall back to.
 *
 * NOT run in CI (matching every other Keycloak-dependent spec in this repo, e.g. admin-login.spec.ts)
 * — `.github/workflows/ci.yml`'s `e2e-smoke` job has no Keycloak. These tests skip themselves
 * whenever process.env.CI is set rather than failing that job.
 */

const ROOT_DOMAIN = process.env.E2E_ROOT_DOMAIN ?? 'localhost:5173';
const CLUB_ADMIN_USERNAME = process.env.E2E_CLUB_ADMIN_USERNAME;
const CLUB_ADMIN_PASSWORD = process.env.E2E_CLUB_ADMIN_PASSWORD;
const CLUB_ADMIN_CLUB_ID = process.env.E2E_CLUB_ADMIN_CLUB_ID;

async function completeKeycloakLogin(page: import('@playwright/test').Page) {
  // Keycloak's own login form — not part of this app, so no shared component/selector to reuse
  // (same helper shape as admin-login.spec.ts's completeKeycloakLogin).
  await page.getByLabel('Username or email').fill(CLUB_ADMIN_USERNAME as string);
  await page.getByLabel('Password', { exact: true }).fill(CLUB_ADMIN_PASSWORD as string);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

async function loginAsClubAdmin(page: import('@playwright/test').Page) {
  await page.goto(`http://${ROOT_DOMAIN}/login`);
  await completeKeycloakLogin(page);
}

async function expectManagerShellVisible(page: import('@playwright/test').Page) {
  await expect(page).toHaveURL(new RegExp(`/manage$`));
  await expect(page.getByText('Not authorized')).not.toBeVisible();
  await expect(page.getByRole('link', { name: 'Club Profile' })).toBeVisible();
}

test.describe('Club manager access golden paths (020-club-manager-access.md)', () => {
  test.beforeEach(() => {
    test.skip(!!process.env.CI, 'requires local Keycloak — not wired into CI yet, see docs/plans/005-admin-login.md Flag #2');
    test.skip(
      !CLUB_ADMIN_USERNAME || !CLUB_ADMIN_PASSWORD || !CLUB_ADMIN_CLUB_ID,
      'requires E2E_CLUB_ADMIN_USERNAME / E2E_CLUB_ADMIN_PASSWORD / E2E_CLUB_ADMIN_CLUB_ID — no default CLUB_ADMIN fixture exists in this repo, see this file\'s PREREQUISITE comment',
    );
  });

  test('club admin logs in, edits and saves their club profile, and the change persists across a reload', async ({
    page,
  }) => {
    await loginAsClubAdmin(page);
    await expectManagerShellVisible(page);

    await page.getByRole('link', { name: 'Club Profile' }).click();
    await expect(page).toHaveURL(/\/manage\/club-profile$/);

    await page.getByRole('tab', { name: 'Contact' }).click();
    const phoneField = page.getByLabel('Phone');
    await phoneField.fill('');
    await phoneField.fill('+27 21 555 0199');

    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText("Something went wrong saving your club's profile")).not.toBeVisible();

    await page.reload();
    await page.getByRole('tab', { name: 'Contact' }).click();
    await expect(page.getByLabel('Phone')).toHaveValue('+27 21 555 0199');
  });

  test('a direct page refresh on /manage keeps the session, instead of dropping to a logged-out state', async ({
    page,
  }) => {
    await loginAsClubAdmin(page);
    await expectManagerShellVisible(page);

    await page.reload();

    await expectManagerShellVisible(page);
  });

  // docs/specs/022-club-social-media.md's golden path — extends this file's existing club-profile
  // e2e coverage rather than a new spec file, per that spec's own Test Plan wording ("extends
  // 020's existing club-profile e2e coverage").
  test('club admin adds a known-platform and a custom social link, saves, and both persist across a reload; removing one and saving removes it too', async ({
    page,
  }) => {
    await loginAsClubAdmin(page);
    await expectManagerShellVisible(page);

    await page.getByRole('link', { name: 'Club Profile' }).click();
    await expect(page).toHaveURL(/\/manage\/club-profile$/);

    await page.getByRole('tab', { name: 'Social Media' }).click();

    // Known platform: Facebook, picked via the preset dropdown.
    await page.getByRole('button', { name: 'Add link' }).click();
    await page.getByLabel('Platform').first().click();
    await page.getByRole('option', { name: 'Facebook' }).click();
    await page.getByLabel('URL').first().fill('https://facebook.com/cricketlegend');

    // Fully custom platform label, via "Custom…".
    await page.getByRole('button', { name: 'Add link' }).click();
    await page.getByLabel('Platform').nth(1).click();
    await page.getByRole('option', { name: 'Custom…' }).click();
    await page.getByLabel('Platform').nth(1).fill('Discord');
    await page.getByLabel('URL').nth(1).fill('https://discord.gg/cricketlegend');

    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText("Something went wrong saving your club's profile")).not.toBeVisible();

    await page.reload();
    await page.getByRole('tab', { name: 'Social Media' }).click();

    await expect(page.getByLabel('Platform').first()).toHaveValue('facebook');
    await expect(page.getByLabel('URL').first()).toHaveValue('https://facebook.com/cricketlegend');
    await expect(page.getByLabel('Platform').nth(1)).toHaveValue('Discord');
    await expect(page.getByLabel('URL').nth(1)).toHaveValue('https://discord.gg/cricketlegend');

    // Remove the custom Discord link, save, reload, confirm it's gone (Facebook stays).
    await page.getByRole('button', { name: 'Remove Discord' }).click();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText("Something went wrong saving your club's profile")).not.toBeVisible();

    await page.reload();
    await page.getByRole('tab', { name: 'Social Media' }).click();

    await expect(page.getByLabel('Platform')).toHaveCount(1);
    await expect(page.getByLabel('Platform').first()).toHaveValue('facebook');
  });
});
