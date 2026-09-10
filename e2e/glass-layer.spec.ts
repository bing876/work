import { expect, test } from '@playwright/test';

test('uses one frame glass surface with transparent internal regions', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const frame = page.locator('.frame');
  await expect(frame).toHaveCSS('width', '1400px');
  await expect(frame).toHaveCSS('height', '900px');
  await expect(frame).toHaveCSS('border-radius', '20px');
  await expect(frame).toHaveCSS('border-top-width', '3px');
  await expect(frame).toHaveCSS('backdrop-filter', 'blur(80px)');
  await expect(page.locator('.rail')).toHaveCSS('width', '55px');

  for (const selector of ['.rail', '.sidebar']) {
    expect(await page.locator(selector).evaluate((element) => getComputedStyle(element).backgroundImage)).toContain('linear-gradient');
  }
  await expect(page.locator('.main-area')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');

  await expect(page.locator('.rail')).toHaveCSS('border-right-width', '1px');
  await expect(page.locator('.sidebar')).toHaveCSS('border-right-width', '1px');

  const railBox = await page.locator('.rail').boundingBox();
  for (const selector of ['.menu-btn', '.tab', '.hamburger-btn']) {
    const box = await page.locator(selector).first().boundingBox();
    expect(railBox).not.toBeNull();
    expect(box).not.toBeNull();
    expect(Math.abs((box!.x + box!.width / 2) - (railBox!.x + railBox!.width / 2))).toBeLessThan(.01);
  }
  await page.screenshot({
    path: '../../../visual-review/workbench-vnext-visual-source-of-truth-v0.1/phase054-glass-layer/01-default.png',
  });
});
