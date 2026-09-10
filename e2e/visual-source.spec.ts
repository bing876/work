import { test } from '@playwright/test';

const output = '../../../visual-review/workbench-vnext-visual-source-of-truth-v0.1/phase03-screenshots';

async function capture(page: import('@playwright/test').Page, name: string) {
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${output}/${name}.png` });
}

test('captures the frozen Visual Source of Truth states', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await capture(page, '01-empty-first-screen');

  await page.getByRole('button', { name: /^陈默/ }).click();
  await capture(page, '02-contact-selected');

  await page.getByLabel('输入消息').fill('请总结当前工作台状态');
  await page.getByRole('button', { name: '发送消息' }).click();
  await capture(page, '03-conversation');

  await page.getByLabel('输入消息').fill('正在输入的消息');
  await capture(page, '04-composer-input');

  await page.getByRole('button', { name: '添加附件' }).click();
  await capture(page, '05-tool-menu');

  await page.getByRole('button', { name: '选择模型' }).click();
  await capture(page, '06-model-selector');
  await page.getByRole('button', { name: '选择模型' }).click();

  await page.getByRole('button', { name: '工作区设置' }).click();
  await capture(page, '08-settings');
  await page.getByRole('button', { name: '关闭设置' }).click();

  await page.getByRole('button', { name: '收起侧边栏' }).click();
  await capture(page, '09-sidebar-collapse');
});
