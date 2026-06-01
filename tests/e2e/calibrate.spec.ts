import { expect, test } from "@playwright/test";

test("MetaLearn OS completes the unified learning loop", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "今天该做什么" })).toBeVisible();
  await expect(page.getByText("北极星指标")).toBeVisible();

  await page.goto("/library");
  await expect(page.getByRole("heading", { name: "资料库" })).toBeVisible();
  await page.getByRole("button", { name: /保存到资料库/ }).click();
  await expect(page.getByText(/已导入并分成/)).toBeVisible();
  await expect(page.getByRole("link", { name: "我的学习材料" })).toBeVisible();
  await page.getByRole("button", { name: /生成候选题/ }).click();
  await expect(page.getByText("将发送哪些内容")).toBeVisible();
  await expect(page.getByText("本地 mock")).toBeVisible();
  await page.getByRole("button", { name: /确认发送并生成候选题/ }).click();
  await expect(page.getByRole("button", { name: /批准进入复习/ }).first()).toBeVisible();
  await page.getByRole("button", { name: /批准进入复习/ }).first().click();

  await page.goto("/review");
  await expect(page.getByRole("heading", { name: "校准记忆" })).toBeVisible();
  await expect(page.getByText("来源已隐藏。先主动提取，再在自评后查看证据。")).toBeVisible();
  await page.locator("button").filter({ hasText: /^5$/ }).first().click();
  await page.getByPlaceholder("先回想，再看来源。不要直接复制。").fill("我把熟悉感当成了掌握，但没能说清机制。");
  await page.getByRole("button", { name: "错 A", exact: true }).click();
  await expect(page.getByText(/校准差距/)).toBeVisible();
  await expect(page.getByText(/信心 非常确定/)).toBeVisible();

  await page.goto("/explain");
  await expect(page.getByRole("heading", { name: "费曼解释" })).toBeVisible();
  await page.getByLabel("你的解释").fill("间隔效应的机制是多次隔开的主动提取让记忆在不同时间点重新被检索。比如今天学完先自测，明天再自测，三天后再自测；如果每次只是重读材料，熟悉感会变强，但不一定能独立回答。它的边界是任务太简单或没有反馈时，间隔本身不能修正错误。");
  await page.getByRole("button", { name: /生成 3 个追问/ }).click();
  await expect(page.getByText("Q1")).toBeVisible();
  await page.getByRole("button", { name: /保存解释版本/ }).click();
  await expect(page.getByText(/间隔效应 · v1/)).toBeVisible();
  await page.getByRole("button", { name: /从漏洞生成卡片/ }).click();

  await page.goto("/insights");
  await expect(page.getByRole("heading", { name: "洞察报告" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "校准报告" })).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByText("未点击 AI 操作前不上传材料。")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("保证变聪明");
});

test("MetaLearn OS creates a review card manually from material evidence", async ({ page }) => {
  let aiCardCalls = 0;
  await page.route("**/api/ai/cards", async (route) => {
    aiCardCalls += 1;
    await route.continue();
  });

  await page.goto("/library");
  await page.getByRole("button", { name: /保存到资料库/ }).click();
  await expect(page.getByText(/已导入并分成/)).toBeVisible();
  const materialLink = page.getByRole("link", { name: "我的学习材料" });
  await expect(materialLink).toBeVisible();
  await materialLink.click();
  await expect(page).toHaveURL(/\/library\/source_/);
  const materialUrl = page.url();

  await expect(page.getByRole("heading", { name: "我的学习材料" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "来源片段" })).toBeVisible();
  await expect(page.getByText("复习证据")).toBeVisible();
  await page.getByRole("button", { name: /用此片段建卡/ }).first().click();
  await expect(page.getByText("从来源证据建卡")).toBeVisible();
  await expect(page.getByText("将发送哪些内容")).not.toBeVisible();

  await page.getByLabel("问题").fill("为什么高信心错误特别值得优先复盘？");
  await page.getByLabel("预期答案").fill("因为它暴露了熟悉感和真实掌握之间的差距。");
  await page.getByRole("button", { name: /保存候选题/ }).click();
  await expect(page.getByText("已保存为候选题")).toBeVisible();
  await page.getByRole("button", { name: /批准进入复习/ }).first().click();
  await expect(page.getByText("已批准进入复习队列")).toBeVisible();

  await page.goto("/review");
  await expect(page.getByText("来源已隐藏。先主动提取，再在自评后查看证据。")).toBeVisible();
  await page.locator("button").filter({ hasText: /^5$/ }).first().click();
  await page.getByPlaceholder("先回想，再看来源。不要直接复制。").fill("我记得它能暴露熟悉感和掌握之间的差距。");
  await page.getByRole("button", { name: "对 C", exact: true }).click();
  await expect(page.getByText(/校准差距/)).toBeVisible();

  await page.goto(materialUrl);
  await expect(page.getByText("复习证据")).toBeVisible();
  await expect(page.getByText(/信心 5/)).toBeVisible();
  await expect(page.getByText("来源缺失，需要修复")).not.toBeVisible();
  expect(aiCardCalls).toBe(0);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("MetaLearn OS restores a usable workspace from exported JSON", async ({ page }) => {
  await page.goto("/library");
  await page.getByRole("button", { name: /保存到资料库/ }).click();
  await expect(page.getByText(/已导入并分成/)).toBeVisible();
  const materialLink = page.getByRole("link", { name: "我的学习材料" });
  await expect(materialLink).toBeVisible();
  await materialLink.click();
  await page.getByRole("button", { name: /用此片段建卡/ }).first().click();
  await page.getByLabel("问题").fill("为什么高信心错误特别值得优先复盘？");
  await page.getByLabel("预期答案").fill("因为它暴露了熟悉感和真实掌握之间的差距。");
  await page.getByRole("button", { name: /保存候选题/ }).click();
  await page.getByRole("button", { name: /批准进入复习/ }).first().click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出包" }).click();
  const download = await downloadPromise;
  const exportPath = await download.path();
  expect(exportPath).toBeTruthy();

  await page.goto("/settings");
  await page.getByRole("button", { name: /准备删除本地数据/ }).click();
  await page.getByRole("button", { name: /确认删除/ }).click();
  await expect(page.getByText("本地数据已清空")).toBeVisible();

  await page.goto("/library");
  await page.locator('input[type="file"]').setInputFiles(exportPath!);
  await expect(page.getByText("导入预览已生成")).toBeVisible();
  await expect(page.getByText("全量备份", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /确认导入/ }).click();
  await expect(page.getByText("导入完成", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: /查看导入材料/ }).click();
  await expect(page.getByRole("heading", { name: "我的学习材料" })).toBeVisible();
  await expect(page.getByText("为什么高信心错误特别值得优先复盘？")).toBeVisible();

  await page.goto("/review");
  await page.locator("button").filter({ hasText: /^4$/ }).first().click();
  await page.getByPlaceholder("先回想，再看来源。不要直接复制。").fill("它能暴露熟悉感和真实掌握之间的差距。");
  await page.getByRole("button", { name: "对 C", exact: true }).click();
  await expect(page.getByText(/校准差距/)).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("MetaLearn OS rejects invalid JSON imports before writing data", async ({ page }) => {
  await page.goto("/library");
  await page.locator('input[type="file"]').setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("{")
  });

  await expect(page.getByText("文件不是有效 JSON。", { exact: true })).toBeVisible();
  await expect(page.getByText("阻断问题")).toBeVisible();
  await expect(page.getByRole("button", { name: /确认导入/ })).toBeDisabled();
  await expect(page.getByText("导入完成")).not.toBeVisible();
});
