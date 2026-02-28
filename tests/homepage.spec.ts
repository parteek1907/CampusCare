import { test, expect } from '@playwright/test';

test('homepage has title and hero text', async ({ page }) => {
    await page.goto('/');

    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/CampusCare/);

    // Expect hero title to be visible
    await expect(page.locator('.hero-title')).toBeVisible();
    await expect(page.locator('.hero-title')).toContainText('Upgraded & Organized');

    // Check CTA button
    const getStarted = page.locator('#hero-cta');
    await expect(getStarted).toBeVisible();
    await expect(getStarted).toContainText('Get Started');
});
