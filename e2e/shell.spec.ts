import { expect, test } from "@playwright/test";

test("Phase 0 shell renders and opens the primary mock controls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^我的助手/ })).toBeVisible();
  await page.getByRole("button", { name: "添加附件" }).click();
  await expect(page.getByRole("menuitem", { name: /添加照片和文件/ })).toBeVisible();
  await page.getByRole("button", { name: "选择模型" }).click();
  await expect(page.getByRole("menuitemradio", { name: /ChatGPT GPT-5.6/ })).toBeVisible();
  await page.screenshot({ path: "test-results/phase03-shell-1440x900.png" });
});
