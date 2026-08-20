import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/**
 * E2E golden path for docs/specs/010-minimal-club-creation.md and
 * docs/specs/012-club-profile.md: log in as the seeded platform_admin test user, navigate to
 * Club Onboarding, create a Club, complete its profile (org type, contact, address, branding)
 * on the edit screen the create flow now drops the admin onto, reload that screen to confirm
 * every profile field actually persisted, edit its name, suspend it, confirm the Suspended
 * badge, reactivate it.
 *
 * Runs against a real running dev server AND real local Keycloak (not Testcontainers, no
 * mocking) — start all of these before running:
 *   - backend: `cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev` (port 8082)
 *   - frontend: `cd ui && npm run dev` (port 5173)
 *   - Keycloak: `auth.localhost:8180`, realm `cricketlegend`, client `cricketlegend`
 *     (docs/specs/005-admin-login.md's Implementation-time addendum)
 *
 * PREREQUISITE 1: at least one Club row with status = 'ACTIVE' must exist in the dev
 * `cricketlegend_platform` database, per ui/e2e/admin-login.spec.ts's own prerequisite (shared
 * fixture club) — this spec logs in the same way, by selecting a club. The Club this test
 * creates is a brand-new, separate fixture-free row (unique slug per run), not the login club.
 *
 * PREREQUISITE 2: a Keycloak user carrying the platform_admin realm role must exist in the local
 * `cricketlegend` realm — same seeded user ui/e2e/admin-login.spec.ts and
 * ui/e2e/admin-configuration-subscriptions.spec.ts already rely on (username and password both
 * default to `platform-admin`, overridable via E2E_ADMIN_USERNAME / E2E_ADMIN_PASSWORD).
 *
 * NOT run in CI (docs/plans/010-minimal-club-creation.md's own Test Plan entry, matching
 * 005's/008's/009's own precedent, and docs/plans/012-club-profile.md's Test Plan entry follows
 * the same precedent) — `.github/workflows/ci.yml`'s `e2e-smoke` job has no Keycloak. Local-only
 * until that infra decision is made. Skips itself whenever `process.env.CI` is set, same as the
 * sibling e2e specs.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CLUB_NAME = process.env.E2E_CLUB_NAME ?? 'Riverside CC';
const ROOT_DOMAIN = process.env.E2E_ROOT_DOMAIN ?? 'localhost:5173';
const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME ?? 'platform-admin';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'platform-admin';

const LOGO_FIXTURE = path.join(__dirname, 'fixtures', 'test-logo.png');
const NON_IMAGE_FIXTURE = path.join(__dirname, 'fixtures', 'not-an-image.txt');

async function loginBySelectingClub(page: import('@playwright/test').Page, clubName: string) {
  await page.goto(`http://${ROOT_DOMAIN}/`);

  await page.getByRole('button', { name: 'Log in' }).click();
  await page.getByLabel('Search for your club').fill(clubName);
  await page.getByText(clubName, { exact: true }).click();

  // Real cross-subdomain top-level navigation to the selected club's /login, which immediately
  // redirects to real Keycloak.
  await page.getByLabel('Username or email').fill(ADMIN_USERNAME);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText('You are logged in as an admin')).toBeVisible();
}

test.describe('Admin Club Onboarding golden path (010, 012)', () => {
  test.beforeEach(() => {
    test.skip(
      !!process.env.CI,
      'requires local Keycloak — not wired into CI yet, see docs/plans/010-minimal-club-creation.md and docs/plans/012-club-profile.md',
    );
  });

  test('platform admin creates a Club, completes its profile, edits it, suspends, and reactivates it', async ({ page }) => {
    const uniqueSuffix = Date.now();
    const newClubName = `E2E Onboarding Club ${uniqueSuffix}`;
    const newClubSlug = `e2e-onboarding-${uniqueSuffix}`;
    const renamedClubName = `E2E Onboarding Club (renamed) ${uniqueSuffix}`;

    await loginBySelectingClub(page, CLUB_NAME);

    // Sidebar -> Club Onboarding.
    await page.getByRole('link', { name: 'Club Onboarding' }).click();
    await expect(page).toHaveURL(/\/admin\/onboarding$/);

    // Create a Club.
    await page.getByRole('button', { name: 'Add Club' }).click();
    await expect(page).toHaveURL(/\/admin\/onboarding\/new$/);

    await page.getByLabel('Name').fill(newClubName);
    await page.getByLabel('Slug').fill(newClubSlug);
    await page.getByRole('button', { name: 'Create club' }).click();

    // 012: a successful create now drops the admin straight onto the edit route (not back to
    // the list), so profile completion continues immediately, in edit mode — see
    // ClubFormPage.tsx's saveMutation.onSuccess.
    await expect(page).toHaveURL(/\/admin\/onboarding\/.+\/edit$/);

    // Basic Info is the default/active tab. The club now exists, so the org-type field (and the
    // Contact/Address/Branding tabs) are enabled, not the create-mode-disabled state ClubForm
    // shows before a club exists.
    const typeField = page.getByLabel('Type');
    await expect(typeField).not.toHaveAttribute('aria-disabled', 'true');
    await typeField.click();
    await page.getByRole('option', { name: 'Academy' }).click();

    // Contact tab.
    await page.getByRole('tab', { name: 'Contact' }).click();
    await page.getByLabel('Email').fill('info@e2e-onboarding-club.example.com');
    await page.getByLabel('Phone').fill('+27 21 555 0100');
    await page.getByLabel('Website').fill('e2e-onboarding-club.example.com');

    // Address tab.
    await page.getByRole('tab', { name: 'Address' }).click();
    await page.getByLabel('Number').fill('12');
    await page.getByLabel('Street').fill('Main Road');
    await page.getByLabel('City').fill('Cape Town');
    await page.getByLabel('Province/State').fill('Western Cape');
    await page.getByLabel('Country').fill('South Africa');
    await page.getByLabel('Postal code').fill('8001');

    // Branding tab — first confirm a non-image upload is rejected client-side and never
    // completes a successful upload, then upload a real logo.
    await page.getByRole('tab', { name: 'Branding' }).click();
    await page.getByLabel('Logo file').setInputFiles(NON_IMAGE_FIXTURE);
    await expect(
      page.getByText(
        `"${path.basename(NON_IMAGE_FIXTURE)}" isn't a supported image type. Upload a PNG, JPEG, or WebP file instead.`,
      ),
    ).toBeVisible();
    // Rejected file never became a successful upload — the control still offers "Upload Logo",
    // not "Replace" (which only appears once a value/URL has actually been set).
    await expect(page.getByRole('button', { name: 'Upload Logo' })).toBeVisible();

    await page.getByLabel('Logo file').setInputFiles(LOGO_FIXTURE);
    await expect(page.getByRole('button', { name: 'Replace' })).toBeVisible();

    // Save — from the edit route, this is an edit-mode save, which navigates back to the list
    // (unchanged from 010's original behaviour; only create-mode navigation changed in 012).
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page).toHaveURL(/\/admin\/onboarding$/);

    let card = page.locator('.MuiCard-root').filter({ hasText: newClubName });
    await expect(card).toBeVisible();
    await expect(card.getByText(newClubSlug)).toBeVisible();
    await expect(card.getByText('Active')).toBeVisible();

    // Reload the edit screen and confirm every profile value actually persisted, not just that
    // the save request succeeded.
    await card.getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/admin\/onboarding\/.+\/edit$/);

    await expect(page.getByLabel('Name')).toHaveValue(newClubName);
    await expect(page.getByLabel('Type')).toHaveText('Academy');

    await page.getByRole('tab', { name: 'Contact' }).click();
    await expect(page.getByLabel('Email')).toHaveValue('info@e2e-onboarding-club.example.com');
    await expect(page.getByLabel('Phone')).toHaveValue('+27 21 555 0100');
    // WebsiteInput normalizes a missing protocol to https:// on blur, so the persisted value
    // carries the scheme even though the admin typed it without one.
    await expect(page.getByLabel('Website')).toHaveValue('https://e2e-onboarding-club.example.com');

    await page.getByRole('tab', { name: 'Address' }).click();
    await expect(page.getByLabel('Number')).toHaveValue('12');
    await expect(page.getByLabel('Street')).toHaveValue('Main Road');
    await expect(page.getByLabel('City')).toHaveValue('Cape Town');
    await expect(page.getByLabel('Province/State')).toHaveValue('Western Cape');
    await expect(page.getByLabel('Country')).toHaveValue('South Africa');
    await expect(page.getByLabel('Postal code')).toHaveValue('8001');

    await page.getByRole('tab', { name: 'Branding' }).click();
    await expect(page.getByRole('button', { name: 'Replace' })).toBeVisible();

    // Edit its name — already on the edit screen from the reload/verification step above, no
    // need to navigate back to the list and click Edit again.
    await page.getByRole('tab', { name: 'Basic Info' }).click();
    await page.getByLabel('Name').fill(renamedClubName);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page).toHaveURL(/\/admin\/onboarding$/);

    card = page.locator('.MuiCard-root').filter({ hasText: renamedClubName });
    await expect(card).toBeVisible();

    // Suspend it.
    await card.getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/admin\/onboarding\/.+\/edit$/);
    await page.getByRole('button', { name: 'Suspend' }).click();
    await expect(page.getByText('Suspend this club?')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm suspend' }).click();

    // Confirm the Suspended badge.
    await expect(page).toHaveURL(/\/admin\/onboarding$/);
    const suspendedCard = page.locator('.MuiCard-root').filter({ hasText: renamedClubName });
    await expect(suspendedCard).toBeVisible();
    await expect(suspendedCard.getByText('Suspended')).toBeVisible();

    // Reactivate it.
    await suspendedCard.getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/admin\/onboarding\/.+\/edit$/);
    await page.getByRole('button', { name: 'Reactivate' }).click();
    await expect(page.getByText('Reactivate this club?')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm reactivate' }).click();

    await expect(page).toHaveURL(/\/admin\/onboarding$/);
    const reactivatedCard = page.locator('.MuiCard-root').filter({ hasText: renamedClubName });
    await expect(reactivatedCard).toBeVisible();
    await expect(reactivatedCard.getByText('Active')).toBeVisible();
  });
});
