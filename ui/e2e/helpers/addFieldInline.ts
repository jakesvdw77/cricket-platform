import { expect } from '@playwright/test';

type Page = import('@playwright/test').Page;

/**
 * docs/specs/099-fields-directory.md: the match form's single "Field (optional)" box replaced the
 * free-text Venue input. This adds a brand-new field from the picker's "Add a new field..." option
 * (one dialog: no ground, no area type) and leaves it selected, so a spec that used to type a
 * venue now ends in the same state, with the match's venue text equal to `name`.
 *
 * The name must be unique per call (a second field with the same name and city is a 409
 * duplicate). Owner and City are the only other required answers; Country is defaulted by the app.
 */
export async function addFieldInline(page: Page, name: string, city = 'Pretoria') {
  const picker = page.getByRole('combobox', { name: 'Field (optional)' });
  await picker.click();
  await picker.fill(name);
  await page.getByRole('option', { name: 'Add a new field...' }).click();

  // A dialog on a desktop, a bottom sheet (drawer) on a phone.
  const dialog = page.locator('[role="dialog"], .MuiDrawer-paper').filter({ hasText: 'Add a new field' }).last();
  await expect(dialog.getByLabel('Name')).toHaveValue(name);
  await dialog.getByLabel('Owner').fill('E2E Owner');
  await dialog.getByLabel('City').fill(city);
  await dialog.getByRole('button', { name: 'Add and select' }).click();

  await expect(dialog).toBeHidden();
  await expect(picker).toHaveValue(name);
}
