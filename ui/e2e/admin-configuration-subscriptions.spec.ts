import { test, expect } from '@playwright/test';

/**
 * E2E golden path for docs/specs/009-subscriptions.md (extended by
 * docs/specs/011-inline-club-creation-in-subscription-form.md's inline-Club creation and
 * docs/specs/014-subscription-responsible-contact.md's inline-Person creation): log in as the
 * seeded platform_admin test user, navigate Configuration -> Subscriptions, create a Subscription
 * linking a seeded Club to a seeded ACTIVE Product, confirm it appears in the list, open it and
 * change it to a different Product, cancel it, confirm it stays visible with a Cancelled status
 * badge, then re-open it and confirm it renders the disabled-Club-picker edit state. A dedicated
 * third test covers 014's own golden path: adding a brand-new responsible person inline via
 * PersonPicker (search finds no match, "+ Add" reveals the create-mode fields), confirming the
 * created Subscription's edit view shows that person as responsible, then a second Subscription
 * reusing that same person's email confirms PersonPicker surfaces them as an existing, selectable
 * match rather than offering to create a duplicate.
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
 * fixture club) — this spec logs in the same way, by selecting a club.
 *
 * PREREQUISITE 2: a Keycloak user carrying the platform_admin realm role must exist in the local
 * `cricketlegend` realm — same seeded user ui/e2e/admin-login.spec.ts and
 * ui/e2e/admin-configuration-products.spec.ts already rely on (username and password both default
 * to `platform-admin`, overridable via E2E_ADMIN_USERNAME / E2E_ADMIN_PASSWORD).
 *
 * PREREQUISITE 3: at least one ACTIVE Product must exist (this spec creates its own via the
 * Configuration -> Products screen at the start of the test, rather than depending on manually
 * seeded data, since 008's Product screen is already covered end-to-end by its own spec).
 *
 * NOT run in CI (docs/plans/009-subscriptions.md's own Test Plan entry, matching 005's/008's own
 * precedent) — `.github/workflows/ci.yml`'s `e2e-smoke` job has no Keycloak. Local-only until that
 * infra decision is made. Skips itself whenever `process.env.CI` is set, same as
 * ui/e2e/admin-login.spec.ts and ui/e2e/admin-configuration-products.spec.ts.
 */

const CLUB_NAME = process.env.E2E_CLUB_NAME ?? 'Riverside CC';
const ROOT_DOMAIN = process.env.E2E_ROOT_DOMAIN ?? 'localhost:5173';
const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME ?? 'platform-admin';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'platform-admin';

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

// docs/specs/014-subscription-responsible-contact.md: the Subscription form's create mode always
// requires a resolved responsible person (existing selection or complete new draft) before
// submit — every "Add Subscription" flow in this file needs to drive PersonPicker one way or the
// other. Searches with `query` first (no match expected), then adds the four fields inline via
// the "+ Add ... as a new person" affordance.
async function addNewResponsiblePersonInline(
  page: import('@playwright/test').Page,
  { query, firstName, lastName, email, phone }: { query: string; firstName: string; lastName: string; email: string; phone: string },
) {
  await page.getByLabel('Responsible person').fill(query);
  await page.getByRole('button', { name: `+ Add "${query}" as a new person` }).click();
  await page.getByLabel('First name').fill(firstName);
  await page.getByLabel('Last name').fill(lastName);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Phone').fill(phone);
}

test.describe('Admin Subscriptions golden path (009)', () => {
  test.beforeEach(() => {
    test.skip(!!process.env.CI, 'requires local Keycloak — not wired into CI yet, see docs/plans/009-subscriptions.md');
  });

  test('platform admin creates, views, changes, and cancels a Subscription', async ({ page }) => {
    const uniqueSuffix = Date.now();
    const productACode = `E2E_SUB_STANDARD_${uniqueSuffix}`;
    const productAName = `E2E Sub Standard ${uniqueSuffix}`;
    const productBCode = `E2E_SUB_PRO_${uniqueSuffix}`;
    const productBName = `E2E Sub Pro ${uniqueSuffix}`;

    await loginBySelectingClub(page, CLUB_NAME);

    // Seed two ACTIVE Products via Configuration -> Products first (008's own screen, already
    // covered end-to-end by its own spec — used here only as fixture data for this spec).
    await page.getByRole('link', { name: 'Configuration' }).click();
    await page.getByRole('link', { name: /^Products/ }).click();
    await expect(page).toHaveURL(/\/admin\/configuration\/products$/);

    for (const [code, name] of [
      [productACode, productAName],
      [productBCode, productBName],
    ]) {
      await page.getByRole('button', { name: 'Add Product' }).click();
      await page.getByLabel('Code').fill(code);
      await page.getByLabel('Name').fill(name);
      await page.getByRole('button', { name: 'Create product' }).click();
      await expect(page).toHaveURL(/\/admin\/configuration\/products$/);

      const card = page.locator('.MuiCard-root').filter({ hasText: name });
      await card.getByRole('link', { name: 'Edit' }).click();
      await page.getByLabel('Publish (set Active)').click();
      await page.getByRole('button', { name: 'Save changes' }).click();
      await expect(page).toHaveURL(/\/admin\/configuration\/products$/);
    }

    // Configuration -> Subscriptions.
    await page.getByRole('link', { name: 'Configuration' }).click();
    await expect(page).toHaveURL(/\/admin\/configuration$/);
    await page.getByRole('link', { name: /^Subscriptions/ }).click();
    await expect(page).toHaveURL(/\/admin\/configuration\/subscriptions$/);

    // Create a Subscription linking the seeded Club to the first seeded ACTIVE Product.
    await page.getByRole('button', { name: 'Add Subscription' }).click();
    await expect(page).toHaveURL(/\/admin\/configuration\/subscriptions\/new$/);

    await page.getByLabel('Club').fill(CLUB_NAME);
    await page.getByText(CLUB_NAME, { exact: true }).click();
    await page.getByLabel('Product').click();
    await page.getByRole('option', { name: new RegExp(productAName) }).click();

    // 014: a responsible person (existing selection or complete new draft) is required before
    // this form can submit — added inline here since this test's own focus is the
    // create/view/change/cancel lifecycle, not PersonPicker itself (see the dedicated 014 test
    // below for that).
    const responsibleEmail = `e2e.responsible.${uniqueSuffix}@example.com`;
    await addNewResponsiblePersonInline(page, {
      query: responsibleEmail,
      firstName: 'Riley',
      lastName: 'Responsible',
      email: responsibleEmail,
      phone: '0215550100',
    });

    await page.getByRole('button', { name: 'Create subscription' }).click();

    // Confirm it in the list.
    await expect(page).toHaveURL(/\/admin\/configuration\/subscriptions$/);
    const subscriptionCard = page.locator('.MuiCard-root').filter({ hasText: CLUB_NAME });
    await expect(subscriptionCard).toBeVisible();
    await expect(subscriptionCard.getByText(productAName)).toBeVisible();
    await expect(subscriptionCard.getByText('Active')).toBeVisible();

    // Open it: the Club picker is disabled once editing.
    await subscriptionCard.getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/admin\/configuration\/subscriptions\/.+\/edit$/);
    await expect(page.getByLabel('Club')).toBeDisabled();
    await expect(page.getByLabel('Club')).toHaveValue(CLUB_NAME);

    // Change its Product (upgrade).
    await page.getByLabel('Product').click();
    await page.getByRole('option', { name: new RegExp(productBName) }).click();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page).toHaveURL(/\/admin\/configuration\/subscriptions$/);
    const upgradedCard = page.locator('.MuiCard-root').filter({ hasText: CLUB_NAME });
    await expect(upgradedCard.getByText(productBName)).toBeVisible();

    // Cancel it.
    await upgradedCard.getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/admin\/configuration\/subscriptions\/.+\/edit$/);
    await page.getByRole('button', { name: 'Cancel Subscription' }).click();
    await expect(page.getByText('Cancel this subscription?')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm cancel' }).click();

    // It stays visible with a Cancelled status badge.
    await expect(page).toHaveURL(/\/admin\/configuration\/subscriptions$/);
    const cancelledCard = page.locator('.MuiCard-root').filter({ hasText: CLUB_NAME });
    await expect(cancelledCard).toBeVisible();
    await expect(cancelledCard.getByText('Cancelled')).toBeVisible();

    // Re-opening it shows the disabled-Club-picker edit state, and no "Cancel Subscription"
    // action for an already-cancelled Subscription.
    await cancelledCard.getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/admin\/configuration\/subscriptions\/.+\/edit$/);
    await expect(page.getByLabel('Club')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Cancel Subscription' })).toHaveCount(0);
  });

  test('platform admin creates a Subscription for a brand-new Club, added inline from the Club picker (011)', async ({
    page,
  }) => {
    const uniqueSuffix = Date.now();
    const productCode = `E2E_SUB_INLINE_${uniqueSuffix}`;
    const productName = `E2E Sub Inline ${uniqueSuffix}`;
    const newClubName = `E2E Meadowbrook CC ${uniqueSuffix}`;
    const newClubSlug = `e2e-meadowbrook-cc-${uniqueSuffix}`;

    await loginBySelectingClub(page, CLUB_NAME);

    // Seed one ACTIVE Product via Configuration -> Products (008's own screen, already covered
    // end-to-end by its own spec — used here only as fixture data for this spec).
    await page.getByRole('link', { name: 'Configuration' }).click();
    await page.getByRole('link', { name: /^Products/ }).click();
    await expect(page).toHaveURL(/\/admin\/configuration\/products$/);

    await page.getByRole('button', { name: 'Add Product' }).click();
    await page.getByLabel('Code').fill(productCode);
    await page.getByLabel('Name').fill(productName);
    await page.getByRole('button', { name: 'Create product' }).click();
    await expect(page).toHaveURL(/\/admin\/configuration\/products$/);

    const productCard = page.locator('.MuiCard-root').filter({ hasText: productName });
    await productCard.getByRole('link', { name: 'Edit' }).click();
    await page.getByLabel('Publish (set Active)').click();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page).toHaveURL(/\/admin\/configuration\/products$/);

    // Configuration -> Subscriptions -> Add Subscription.
    await page.getByRole('link', { name: 'Configuration' }).click();
    await expect(page).toHaveURL(/\/admin\/configuration$/);
    await page.getByRole('link', { name: /^Subscriptions/ }).click();
    await expect(page).toHaveURL(/\/admin\/configuration\/subscriptions$/);

    await page.getByRole('button', { name: 'Add Subscription' }).click();
    await expect(page).toHaveURL(/\/admin\/configuration\/subscriptions\/new$/);

    // Search a club name with no existing match, then use "+ Add ... as a new club".
    await page.getByLabel('Club').fill(newClubName);
    const addAffordance = page.getByRole('button', { name: `+ Add "${newClubName}" as a new club` });
    await expect(addAffordance).toBeVisible();
    await addAffordance.click();

    // Name pre-fills from the search query; Slug auto-derives — override it with a
    // collision-proof, run-unique value so repeat local runs don't hit a duplicate-slug 409.
    await expect(page.getByLabel('Name')).toHaveValue(newClubName);
    await page.getByLabel('Slug').fill(newClubSlug);

    await page.getByLabel('Product').click();
    await page.getByRole('option', { name: new RegExp(productName) }).click();

    // 014: a responsible person is required before this form can submit — see
    // addNewResponsiblePersonInline's own comment.
    const responsibleEmail = `e2e.responsible.inline-club.${uniqueSuffix}@example.com`;
    await addNewResponsiblePersonInline(page, {
      query: responsibleEmail,
      firstName: 'Riley',
      lastName: 'Responsible',
      email: responsibleEmail,
      phone: '0215550100',
    });

    await page.getByRole('button', { name: 'Create subscription' }).click();

    // The new Subscription appears in the list against the newly-created Club.
    await expect(page).toHaveURL(/\/admin\/configuration\/subscriptions$/);
    const newSubscriptionCard = page.locator('.MuiCard-root').filter({ hasText: newClubName });
    await expect(newSubscriptionCard).toBeVisible();
    await expect(newSubscriptionCard.getByText(productName)).toBeVisible();
    await expect(newSubscriptionCard.getByText('Active')).toBeVisible();

    // The Club itself was actually created (not just referenced) — visible in 010's own Club
    // Onboarding list as Active.
    await page.getByRole('link', { name: 'Club Onboarding' }).click();
    await expect(page).toHaveURL(/\/admin\/onboarding$/);
    const newClubCard = page.locator('.MuiCard-root').filter({ hasText: newClubName });
    await expect(newClubCard).toBeVisible();
    await expect(newClubCard.getByText('Active')).toBeVisible();
  });

  test('platform admin adds a new responsible person inline via PersonPicker (014), then a second Subscription reuses that person as an existing match rather than offering a duplicate', async ({
    page,
  }) => {
    const uniqueSuffix = Date.now();
    const productCode = `E2E_SUB_PERSON_${uniqueSuffix}`;
    const productName = `E2E Sub Person ${uniqueSuffix}`;
    const clubOneName = `E2E Kingsmead CC ${uniqueSuffix}`;
    const clubOneSlug = `e2e-kingsmead-cc-${uniqueSuffix}`;
    const clubTwoName = `E2E Newlands CC ${uniqueSuffix}`;
    const clubTwoSlug = `e2e-newlands-cc-${uniqueSuffix}`;
    const responsibleEmail = `e2e.responsible.person.${uniqueSuffix}@example.com`;
    const responsibleLabel = `Riley Responsible — ${responsibleEmail}`;

    await loginBySelectingClub(page, CLUB_NAME);

    // Seed one ACTIVE Product — fixture data only, already covered end-to-end by 008's own spec.
    await page.getByRole('link', { name: 'Configuration' }).click();
    await page.getByRole('link', { name: /^Products/ }).click();
    await expect(page).toHaveURL(/\/admin\/configuration\/products$/);

    await page.getByRole('button', { name: 'Add Product' }).click();
    await page.getByLabel('Code').fill(productCode);
    await page.getByLabel('Name').fill(productName);
    await page.getByRole('button', { name: 'Create product' }).click();
    await expect(page).toHaveURL(/\/admin\/configuration\/products$/);

    const productCard = page.locator('.MuiCard-root').filter({ hasText: productName });
    await productCard.getByRole('link', { name: 'Edit' }).click();
    await page.getByLabel('Publish (set Active)').click();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page).toHaveURL(/\/admin\/configuration\/products$/);

    // First Subscription: a brand-new Club (inline, 011) and a brand-new responsible person
    // (inline, 014) — search for the person's email finds no match, so the "+ Add" affordance is
    // used, not a selection from the results.
    await page.getByRole('link', { name: 'Configuration' }).click();
    await expect(page).toHaveURL(/\/admin\/configuration$/);
    await page.getByRole('link', { name: /^Subscriptions/ }).click();
    await expect(page).toHaveURL(/\/admin\/configuration\/subscriptions$/);

    await page.getByRole('button', { name: 'Add Subscription' }).click();
    await expect(page).toHaveURL(/\/admin\/configuration\/subscriptions\/new$/);

    await page.getByLabel('Club').fill(clubOneName);
    await page.getByRole('button', { name: `+ Add "${clubOneName}" as a new club` }).click();
    await expect(page.getByLabel('Name')).toHaveValue(clubOneName);
    await page.getByLabel('Slug').fill(clubOneSlug);

    await page.getByLabel('Product').click();
    await page.getByRole('option', { name: new RegExp(productName) }).click();

    await page.getByLabel('Responsible person').fill(responsibleEmail);
    const addPersonAffordance = page.getByRole('button', { name: `+ Add "${responsibleEmail}" as a new person` });
    await expect(addPersonAffordance).toBeVisible();
    await addPersonAffordance.click();
    await page.getByLabel('First name').fill('Riley');
    await page.getByLabel('Last name').fill('Responsible');
    // Email pre-filled from the search query since it looked like one — confirm, then fill Phone.
    await expect(page.getByLabel('Email')).toHaveValue(responsibleEmail);
    await page.getByLabel('Phone').fill('0215550100');

    await page.getByRole('button', { name: 'Create subscription' }).click();
    await expect(page).toHaveURL(/\/admin\/configuration\/subscriptions$/);

    // The created Subscription's edit view shows the new person as responsible.
    const firstSubscriptionCard = page.locator('.MuiCard-root').filter({ hasText: clubOneName });
    await expect(firstSubscriptionCard).toBeVisible();
    await firstSubscriptionCard.getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/admin\/configuration\/subscriptions\/.+\/edit$/);
    await expect(page.getByLabel('Responsible person')).toBeDisabled();
    await expect(page.getByLabel('Responsible person')).toHaveValue(responsibleLabel);

    // Second Subscription, a different (inline-created) Club, reusing the same person's email —
    // searched and selected this time, confirming PersonPicker surfaces them as an existing match
    // rather than offering to create a duplicate.
    await page.getByRole('link', { name: 'Configuration' }).click();
    await expect(page).toHaveURL(/\/admin\/configuration$/);
    await page.getByRole('link', { name: /^Subscriptions/ }).click();
    await expect(page).toHaveURL(/\/admin\/configuration\/subscriptions$/);

    await page.getByRole('button', { name: 'Add Subscription' }).click();
    await expect(page).toHaveURL(/\/admin\/configuration\/subscriptions\/new$/);

    await page.getByLabel('Club').fill(clubTwoName);
    await page.getByRole('button', { name: `+ Add "${clubTwoName}" as a new club` }).click();
    await expect(page.getByLabel('Name')).toHaveValue(clubTwoName);
    await page.getByLabel('Slug').fill(clubTwoSlug);

    await page.getByLabel('Product').click();
    await page.getByRole('option', { name: new RegExp(productName) }).click();

    await page.getByLabel('Responsible person').fill(responsibleEmail);
    const existingPersonOption = page.getByRole('option', { name: responsibleLabel });
    await expect(existingPersonOption).toBeVisible();
    // No "+ Add" affordance offered — the exact match is presented as a selectable existing
    // person instead of a duplicate-create prompt.
    await expect(page.getByRole('button', { name: `+ Add "${responsibleEmail}" as a new person` })).toHaveCount(0);
    await existingPersonOption.click();

    // Selecting an existing person renders their fields read-only/disabled, never editable —
    // the UI's own reinforcement of the backend's "link, don't overwrite" rule.
    await expect(page.getByLabel('First name')).toHaveValue('Riley');
    await expect(page.getByLabel('First name')).toBeDisabled();

    await page.getByRole('button', { name: 'Create subscription' }).click();
    await expect(page).toHaveURL(/\/admin\/configuration\/subscriptions$/);

    const secondSubscriptionCard = page.locator('.MuiCard-root').filter({ hasText: clubTwoName });
    await expect(secondSubscriptionCard).toBeVisible();
    await secondSubscriptionCard.getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/admin\/configuration\/subscriptions\/.+\/edit$/);
    await expect(page.getByLabel('Responsible person')).toHaveValue(responsibleLabel);
  });
});
