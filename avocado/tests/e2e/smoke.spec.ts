import { expect, test } from '@playwright/test';

test('M0 dev harness serves the sidebar', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('banner')).toContainText('Avocado');
});
