import { expect, test } from '@playwright/test';

test('keeps project selection synchronized and restores the sidebar after threshold collapse', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const sidebar = page.locator('.sidebar');
  const frame = page.locator('.frame');
  const splitter = page.getByRole('separator', { name: '调整侧边栏宽度' });
  await page.screenshot({ path: 'test-results/phase121-default.png' });

  await page.getByRole('button', { name: '新建' }).click();
  await page.screenshot({ path: 'test-results/phase121-create-menu.png' });
  await page.getByRole('menuitem', { name: '创建项目' }).click();
  await page.getByLabel('项目名称').fill('视觉检查项目');
  await page.getByRole('dialog', { name: '创建项目' }).getByRole('button', { name: '创建项目', exact: true }).click();
  await page.locator('.contact-item').first().hover();
  await page.screenshot({ path: 'test-results/phase121-hover.png' });
  await splitter.press('End');
  await expect(sidebar).toHaveCSS('width', '310px');

  const search = page.getByLabel('搜索联系人');
  await search.focus();
  await expect(page.locator('.search-pill')).toHaveAttribute('data-state', 'focused');
  await search.fill('不存在的项目');
  await expect(page.getByRole('button', { name: '清空搜索' })).toBeVisible();
  await page.screenshot({ path: 'test-results/phase121-search-input.png' });
  await page.getByRole('button', { name: '清空搜索' }).click();
  await expect(search).toBeFocused();
  await expect(page.locator('.search-pill')).toHaveAttribute('data-state', 'focused');
  await search.fill('不存在的项目');
  await expect(page.locator('.contact-item')).toHaveCount(2);

  const box = await splitter.boundingBox();
  if (!box) throw new Error('splitter is not visible');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 180, box.y + box.height / 2);
  await page.mouse.up();
  expect(await frame.getAttribute('class')).toContain('entering');
  expect((await sidebar.boundingBox())?.width).toBeGreaterThan(0);
  await page.waitForTimeout(120);
  await page.screenshot({ path: 'test-results/phase121-collapse-transition.png' });
  await expect(page.getByRole('button', { name: '退出 Agent Switcher' })).toBeVisible();
  await expect(page.getByLabel('项目与智能体').getByRole('button', { name: '视觉检查项目' })).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/phase121-switcher-selected.png' });

  await page.getByRole('button', { name: '退出 Agent Switcher' }).click();
  await expect(sidebar).toHaveCSS('width', '310px');
  await expect(page.locator('.sidebar').getByRole('button', { name: /视觉检查项目/ })).toHaveAttribute('aria-pressed', 'true');
});
