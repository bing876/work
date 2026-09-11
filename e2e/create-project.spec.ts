import { expect, test } from "@playwright/test";

test("creates a project through the injected mock workbench flow", async ({ page }) => {
  const output =
    "../../../visual-review/workbench-vnext-visual-source-of-truth-v0.1/phase06-experience-simulation";
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("region", { name: "项目执行状态" })).toContainText("新品发布工作流");
  await page.screenshot({ path: `${output}/01-preloaded-workflow.png` });
  await page.getByRole("button", { name: "进入 Agent Switcher" }).click();
  await page.locator(".rail").getByRole("button", { name: "创建项目" }).click();
  await expect(page.getByRole("dialog", { name: "创建项目" })).toBeVisible();
  await page.getByLabel("项目名称").fill("品牌发布");
  await page.getByLabel("项目需求").fill("为新品发布准备完整方案");
  await page
    .getByRole("dialog", { name: "创建项目" })
    .getByRole("button", { name: "创建项目", exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: "创建项目" })).toBeHidden();
  await expect(page.locator(".rail").getByRole("button", { name: "品牌发布" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "退出 Agent Switcher" }).click();
  await expect(page.locator(".sidebar").getByRole("button", { name: /品牌发布/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByRole("region", { name: "对话" }).getByText("为新品发布准备完整方案"),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "项目执行状态" })).toContainText("执行中");
  await page.screenshot({ path: `${output}/02-created-executing.png` });
  await page.getByLabel("输入消息").fill("继续执行");
  await page.getByRole("button", { name: "发送消息" }).click();
  await expect(
    page.getByRole("region", { name: "对话" }).getByText(/已完成模拟执行/),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "项目执行状态" })).toContainText("已就绪");
  await page.screenshot({ path: `${output}/03-workflow-complete.png` });
});

test("captures Phase 0.5 create-project visual states", async ({ page }) => {
  const output =
    "../../../visual-review/workbench-vnext-visual-source-of-truth-v0.1/phase053-sidebar-visual-rebalance";
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.locator(".sidebar").screenshot({ path: `${output}/00-sidebar-280.png` });
  await page.locator(".sidebar").getByRole("button", { name: "创建项目" }).click();
  const [frame, rail, sidebar, main, card, search, contact, composer] = await Promise.all([
    page.locator(".frame").boundingBox(),
    page.locator(".rail").boundingBox(),
    page.locator(".sidebar").boundingBox(),
    page.locator(".main-area").boundingBox(),
    page.locator(".create-project-card").boundingBox(),
    page.locator(".search-pill").boundingBox(),
    page.locator(".contact-item").first().boundingBox(),
    page.locator(".composer").boundingBox(),
  ]);
  expect(rail?.width).toBe(60);
  expect(frame?.height).toBe(770);
  expect(sidebar?.width).toBe(250);
  expect(search?.width).toBe(202);
  expect(contact?.width).toBe(242);
  expect(frame).not.toBeNull();
  expect(main).not.toBeNull();
  expect(card).not.toBeNull();
  expect(composer).not.toBeNull();
  expect(Math.abs(main!.x - (frame!.x + 310))).toBeLessThan(1);
  expect(Math.abs(card!.x + card!.width / 2 - (frame!.x + frame!.width / 2))).toBeLessThan(1);
  expect(composer!.x).toBeGreaterThanOrEqual(main!.x);
  expect(composer!.x + composer!.width).toBeLessThanOrEqual(main!.x + main!.width);
  await page.screenshot({ path: `${output}/01-default.png` });
  await page.getByLabel("项目名称").fill("品牌发布");
  await page.getByLabel("项目需求").fill("为新品发布准备完整方案");
  await page.screenshot({ path: `${output}/02-input.png` });
  await page.getByLabel("工作文件夹输入").evaluate((input) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(["brief"], "strategy", { type: "text/markdown" }));
    Object.defineProperty(input, "files", { configurable: true, value: transfer.files });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.screenshot({ path: `${output}/03-working-folder.png` });
  await page.getByLabel("项目需求").evaluate((textarea) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(["mock"], "launch-plan.pdf", { type: "application/pdf" }));
    textarea.parentElement?.dispatchEvent(
      new DragEvent("drop", { bubbles: true, dataTransfer: transfer }),
    );
  });
  await page.getByLabel("项目需求").fill("为新品发布准备完整方案");
  await page.screenshot({ path: `${output}/04-attachment.png` });
  await page.getByRole("button", { name: "切换行业数据" }).click();
  await page.screenshot({ path: `${output}/05-industry-toggle.png` });
  await page
    .getByRole("dialog", { name: "创建项目" })
    .getByRole("button", { name: "创建项目", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "对话" }).getByText("为新品发布准备完整方案"),
  ).toBeVisible();
  await page.screenshot({ path: `${output}/06-created-workbench.png` });
});
