import { expect, test } from "@playwright/test";

function escapePdfText(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function createTextPdfBuffer(text: string) {
  const lines = text.match(/.{1,76}(?:\s|$)/g)?.map((line) => line.trim()).filter(Boolean) ?? [text];
  const textCommands = lines
    .map((line, index) => `${index === 0 ? "72 720 Td" : "0 -18 Td"} (${escapePdfText(line)}) Tj`)
    .join("\n");
  const stream = `BT /F1 12 Tf ${textCommands} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(body, "latin1");
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(body, "latin1");
}

test("MetaLearn OS completes the unified learning loop", async ({ page }) => {
  test.setTimeout(75_000);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "今天该做什么" })).toBeVisible();
  await expect(page.getByText("北极星指标")).toBeVisible();
  await expect(page.getByRole("heading", { name: "继续学习视图" })).toBeVisible();

  await page.goto("/library");
  await expect(page.getByRole("heading", { name: "资料库" })).toBeVisible();
  await page.getByRole("button", { name: "仅保存到资料库", exact: true }).click();
  await expect(page.getByText(/已导入并分成/)).toBeVisible();
  await expect(page.getByRole("link", { name: "我的学习材料" })).toBeVisible();
  await page.getByRole("button", { name: "为最近材料生成候选题", exact: true }).click();
  await expect(page.getByText("将发送哪些内容")).toBeVisible();
  await expect(page.getByText("本地 mock")).toBeVisible();
  await page.getByRole("button", { name: /确认发送并生成候选题/ }).click();
  await expect(page.getByRole("button", { name: /批准进入复习/ }).first()).toBeVisible();
  await page.getByRole("button", { name: /批准进入复习/ }).first().click();

  await page.goto("/review?tag=course");
  await expect(page.getByRole("heading", { name: "校准记忆" })).toBeVisible();
  await expect(page.getByText("复习筛选：tag course")).toBeVisible();
  await expect(page.getByText("来源已隐藏。先主动提取，再在自评后查看证据。")).toBeVisible();
  await page.locator("button").filter({ hasText: /^5$/ }).first().click();
  await page.getByPlaceholder("先回想，再看来源。不要直接复制。").fill("我把熟悉感当成了掌握，但没能说清机制。");
  await page.getByRole("button", { name: "错 A", exact: true }).click();
  await expect(page.getByText(/校准差距/)).toBeVisible();
  await expect(page.getByText(/信心 非常确定/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "今日复习进度" })).toBeVisible();
  await expect(page.getByText("今日 1/5")).toBeVisible();
  await expect(page.getByText(/高信心错误 1 个/)).toBeVisible();

  await page.goto("/explain");
  await expect(page.getByRole("heading", { name: "费曼解释" })).toBeVisible();
  await page.getByLabel("你的解释").fill("间隔效应的机制是多次隔开的主动提取让记忆在不同时间点重新被检索。比如今天学完先自测，明天再自测，三天后再自测；如果每次只是重读材料，熟悉感会变强，但不一定能独立回答。它的边界是任务太简单或没有反馈时，间隔本身不能修正错误。");
  await page.getByRole("button", { name: /生成 3 个追问/ }).click();
  await expect(page.getByText("Q1")).toBeVisible();
  await page.getByRole("button", { name: /保存解释版本/ }).click();
  await expect(page.getByRole("heading", { name: "解释版本证据" })).toBeVisible();
  await expect(page.getByText("首个版本，暂无对比。").first()).toBeVisible();
  await page.getByRole("button", { name: /从漏洞生成卡片/ }).click();

  await page.goto("/insights");
  await expect(page.getByRole("heading", { name: "洞察报告" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "校准报告" })).toBeVisible();
  await expect(page.getByText("校准证据质量", { exact: true })).toBeVisible();
  await expect(page.getByText("信心可靠性曲线", { exact: true })).toBeVisible();
  await expect(page.getByText("Brier 趋势", { exact: true })).toBeVisible();
  await expect(page.getByText("证据下钻", { exact: true })).toBeVisible();
  await expect(page.getByText("材料证据", { exact: true })).toBeVisible();
  await expect(page.getByText("tag 证据", { exact: true })).toBeVisible();
  await expect(page.getByText("概念证据", { exact: true })).toBeVisible();
  await expect(page.getByText("下一步行动", { exact: true })).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByText("未点击 AI 操作前不上传材料。")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("保证变聪明");
});

test("MetaLearn OS exposes a study mode launcher and command palette", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "现在想怎么学" })).toBeVisible();
  await expect(page.getByRole("link", { name: /校准复习/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "命令" })).toBeVisible();
  await page.getByRole("button", { name: "固定" }).first().click();
  await expect(page.getByText("已固定到首页学习视图。")).toBeVisible();
  await expect(page.getByText("固定视图", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "取消固定" }).first()).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "固定学习视图" })).toBeVisible();
  await page.getByLabel("视图标题 1").fill("我的校准修复视图");
  await page.getByLabel("视图说明 1").fill("优先处理今天最值得继续的学习范围");
  await page.getByLabel("优先级 1").selectOption("high");
  await page.getByRole("button", { name: "保存视图" }).click();
  await expect(page.getByText("固定学习视图已更新。")).toBeVisible();
  await page.goto("/");
  await expect(page.getByText("我的校准修复视图")).toBeVisible();
  await expect(page.getByRole("button", { name: "进入视图" }).first()).toBeVisible();

  await page.keyboard.press("Control+K");
  await expect(page.getByRole("dialog", { name: "命令中心" })).toBeVisible();
  await page.getByPlaceholder("搜索命令、页面或学习动作").fill("高信心");
  await page.getByRole("button", { name: /查看高信心错误/ }).click();
  await expect(page).toHaveURL(/\/review\/mistakes/);
  await expect(page.getByRole("heading", { name: "高信心错误", exact: true })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("MetaLearn OS imports a selectable text-layer PDF locally", async ({ page }) => {
  const pdfText = "MetaLearn PDF import fixture. Active retrieval requires learners to answer before seeing source evidence. Confidence calibration detects high confidence errors.";

  await page.goto("/library");
  await page.getByLabel("学习材料文件").setInputFiles({
    name: "retrieval-fixture.pdf",
    mimeType: "application/pdf",
    buffer: createTextPdfBuffer(pdfText)
  });
  await expect(page.getByText(/已从 PDF 提取 1 页/).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel("材料标题")).toHaveValue("retrieval-fixture");
  await expect(page.getByLabel("输入类型")).toHaveValue("pdf_text");
  await expect(page.getByLabel("文本 / Markdown / PDF 提取文本")).toHaveValue(/Active retrieval requires learners/);

  await page.getByRole("button", { name: "仅保存到资料库", exact: true }).click();
  await expect(page.getByText(/已导入并分成/)).toBeVisible();
  await page.getByRole("link", { name: "retrieval-fixture" }).click();
  await expect(page.getByRole("heading", { name: "retrieval-fixture" })).toBeVisible();
  await expect(page.getByRole("article").getByText("Active retrieval requires learners", { exact: false })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("MetaLearn OS blocks candidate generation when a selected file has not been saved", async ({ page }) => {
  const text = "Unsaved file fixture. The app must not treat a selected local file as an imported source until the user saves it into the local library.";

  await page.goto("/library");
  await page.getByLabel("学习材料文件").setInputFiles({
    name: "unsaved-fixture.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(text)
  });
  await expect(page.getByText("文本已读取，未入库").first()).toBeVisible();
  await page.getByRole("button", { name: "为最近材料生成候选题", exact: true }).click();
  await expect(page.getByText("文件已读取到编辑框，但还没有保存为材料。").first()).toBeVisible();
  await expect(page.getByText("将发送哪些内容")).not.toBeVisible();
});

test("MetaLearn OS rejects PDFs without enough readable text layer", async ({ page }) => {
  await page.goto("/library");
  await page.getByLabel("学习材料文件").setInputFiles({
    name: "scanned-empty.pdf",
    mimeType: "application/pdf",
    buffer: createTextPdfBuffer("")
  });

  await expect(page.getByText("这个 PDF 没有足够的可读取文本层。当前版本不做扫描件 OCR，请换成可复制文本的 PDF，或手工粘贴文本。").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("link", { name: "scanned-empty" })).not.toBeVisible();
  await expect(page.getByText("将发送哪些内容")).not.toBeVisible();
});

test("MetaLearn OS imports a Markdown material file locally", async ({ page }) => {
  const markdownText = [
    "# Retrieval strategy notes",
    "",
    "Active recall should happen before checking source evidence.",
    "A learner should predict confidence first, answer from memory, then compare with the source quote.",
    "This fixture verifies that Markdown files can be selected directly instead of pasted."
  ].join("\n");

  await page.goto("/library");
  await expect(page.getByText("选择 PDF / TXT / Markdown")).toBeVisible();
  await page.getByLabel("学习材料文件").setInputFiles({
    name: "retrieval-notes.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(markdownText)
  });
  await expect(page.getByText(/已读取 Markdown 文件/).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByLabel("材料标题")).toHaveValue("retrieval-notes");
  await expect(page.getByLabel("输入类型")).toHaveValue("markdown");
  await expect(page.getByLabel("文本 / Markdown / PDF 提取文本")).toHaveValue(/Markdown files can be selected directly/);

  await page.getByRole("button", { name: "仅保存到资料库", exact: true }).click();
  await expect(page.getByText(/已导入并分成/)).toBeVisible();
  await page.getByRole("link", { name: "retrieval-notes" }).click();
  await expect(page.getByRole("heading", { name: "retrieval-notes" })).toBeVisible();
  await expect(page.getByText("Markdown files can be selected directly", { exact: false }).first()).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("MetaLearn OS saves a selected material file and opens candidate generation preview", async ({ page }) => {
  const text = [
    "Candidate generation shortcut fixture.",
    "Learners should not mistake choosing a local file for completing the material import.",
    "The save and generate action should create source chunks first, then show the AI upload preview before any candidate cards are generated.",
    "This preserves the privacy boundary while making the next action clear."
  ].join(" ");

  await page.goto("/library");
  await page.getByLabel("学习材料文件").setInputFiles({
    name: "candidate-shortcut.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(text)
  });
  await expect(page.getByText(/当前只是读取到编辑框，还没有入库/).first()).toBeVisible();
  await page.getByRole("button", { name: "保存并生成候选题", exact: true }).click();
  await expect(page.getByText("将发送哪些内容")).toBeVisible();
  await expect(page.getByText("本地 mock")).toBeVisible();
  await expect(page.getByText("确认前不会调用 AI")).toBeVisible();
  await page.getByRole("button", { name: /确认发送并生成候选题/ }).click();
  await expect(page.getByText("已生成 8 张候选题，仍需在下方“候选题审核台”人工审核。")).toBeVisible();
  await expect(page.getByRole("button", { name: /批准进入复习/ }).first()).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("MetaLearn OS applies tag scope to library candidate review", async ({ page }) => {
  await page.goto("/library");
  await page.getByRole("button", { name: "仅保存到资料库", exact: true }).click();
  await expect(page.getByText(/已导入并分成/)).toBeVisible();
  await page.getByRole("button", { name: "为最近材料生成候选题", exact: true }).click();
  await expect(page.getByText("将发送哪些内容")).toBeVisible();
  await page.getByRole("button", { name: /确认发送并生成候选题/ }).click();
  await expect(page.getByRole("button", { name: /批准进入复习/ }).first()).toBeVisible();

  await page.goto("/library?tag=course#candidate-review");
  await expect(page.getByLabel("搜索材料、卡片、解释")).toHaveValue("course");
  await expect(page.getByText("当前筛选：course")).toBeVisible();
  await expect(page.getByText("当前显示")).toBeVisible();
  await expect(page.getByRole("button", { name: /批准进入复习/ }).first()).toBeVisible();
});

test("MetaLearn OS keeps the material and exposes manual fallback when candidate generation fails", async ({ page }) => {
  await page.route("**/api/ai/cards", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Mock AI provider failed." })
    });
  });
  const text = [
    "AI failure fixture.",
    "The material should still be saved locally when candidate generation fails.",
    "The user should see a direct manual-card fallback instead of a silent empty candidate review bench.",
    "This verifies that failure is recoverable without calling the provider again."
  ].join(" ");

  await page.goto("/library");
  await page.getByLabel("学习材料文件").setInputFiles({
    name: "candidate-failure.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(text)
  });
  await page.getByRole("button", { name: "保存并生成候选题", exact: true }).click();
  await expect(page.getByText("将发送哪些内容")).toBeVisible();
  await page.getByRole("button", { name: /确认发送并生成候选题/ }).click();
  await expect(page.getByText("Mock AI provider failed.").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /改为手工建卡/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "candidate-failure" })).toBeVisible();
});

test("MetaLearn OS creates a review card manually from material evidence", async ({ page }) => {
  let aiCardCalls = 0;
  await page.route("**/api/ai/cards", async (route) => {
    aiCardCalls += 1;
    await route.continue();
  });

  await page.goto("/library");
  await page.getByRole("button", { name: "仅保存到资料库", exact: true }).click();
  await expect(page.getByText(/已导入并分成/)).toBeVisible();
  const materialLink = page.getByRole("link", { name: "我的学习材料" });
  await expect(materialLink).toBeVisible();
  await materialLink.click();
  await expect(page).toHaveURL(/\/library\/source_/);
  const materialUrl = page.url();

  await expect(page.getByRole("heading", { name: "我的学习材料" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "阅读工作台" })).toBeVisible();
  await expect(page.getByText("主动阅读轨", { exact: true })).toBeVisible();
  await expect(page.getByText("读后立即自测", { exact: true })).toBeVisible();
  await expect(page.getByText(/不看原文/).first()).toBeVisible();
  await expect(page.getByText("证据覆盖", { exact: true })).toBeVisible();
  await expect(page.getByText("聚焦片段", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "复习证据" })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "复习证据" })).toBeVisible();
  await expect(page.getByText(/信心 5/)).toBeVisible();
  await expect(page.getByText("来源缺失，需要修复")).not.toBeVisible();
  expect(aiCardCalls).toBe(0);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("MetaLearn OS opens a Feynman draft from focused source evidence", async ({ page }) => {
  await page.goto("/library");
  await page.getByRole("button", { name: "仅保存到资料库", exact: true }).click();
  await expect(page.getByText(/已导入并分成/)).toBeVisible();
  await page.getByRole("link", { name: "我的学习材料" }).click();

  await expect(page.getByRole("heading", { name: "阅读工作台" })).toBeVisible();
  await expect(page.getByText("主动阅读轨", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "查看建议片段" }).click();
  await expect(page.getByText("读后立即自测", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /用当前片段解释/ }).click();
  await expect(page).toHaveURL(/\/explain/);
  await expect(page.getByRole("heading", { name: "费曼解释" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "概念", exact: true })).toHaveValue("我的学习材料");
  await expect(page.getByRole("textbox", { name: "可选来源片段", exact: true })).toHaveValue(/间隔效应说明/);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("MetaLearn OS restores a usable workspace from exported JSON", async ({ page }) => {
  await page.goto("/library");
  await page.getByRole("button", { name: "仅保存到资料库", exact: true }).click();
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
  await page.getByLabel("选择 JSON 导出包").setInputFiles(exportPath!);
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

test("MetaLearn OS creates and resolves high-confidence repair tasks", async ({ page }) => {
  await page.goto("/library");
  await page.getByRole("button", { name: "仅保存到资料库", exact: true }).click();
  await expect(page.getByText(/已导入并分成/)).toBeVisible();
  const materialLink = page.getByRole("link", { name: "我的学习材料" });
  await expect(materialLink).toBeVisible();
  await materialLink.click();
  await page.getByRole("button", { name: /用此片段建卡/ }).first().click();
  await page.getByLabel("问题").fill("为什么高信心错误特别值得优先复盘？");
  await page.getByLabel("预期答案").fill("因为它暴露了熟悉感和真实掌握之间的差距。");
  await page.getByRole("button", { name: /保存候选题/ }).click();
  await page.getByRole("button", { name: /批准进入复习/ }).first().click();

  await page.goto("/review");
  await expect(page.getByRole("button", { name: "错 A", exact: true })).toBeDisabled();
  await page.locator("button").filter({ hasText: /^5$/ }).first().click();
  await expect(page.getByRole("button", { name: "错 A", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: /我需要先看来源/ }).click();
  await expect(page.getByText("本轮已经提前查看来源，完成后会记录为弱提取证据。")).toBeVisible();
  await page.getByPlaceholder("先回想，再看来源。不要直接复制。").fill("我以为会，但其实说不清机制。");
  await page.getByRole("button", { name: "错 A", exact: true }).click();
  await expect(page.getByText(/创建高信心错误修复任务/)).toBeVisible();
  await expect(page.getByText(/证据强度 weak/)).toBeVisible();

  await page.goto("/review/mistakes?tag=course");
  await expect(page.getByRole("heading", { name: "高信心错误", exact: true })).toBeVisible();
  await expect(page.getByLabel("tag 筛选")).toHaveValue("course");
  await expect(page.getByText("为什么高信心错误特别值得优先复盘？")).toBeVisible();
  await page.getByRole("link", { name: /用费曼复盘/ }).click();
  await expect(page).toHaveURL(/\/explain\?repairTaskId=/);
  await expect(page.getByText("当前正在处理高信心错误修复任务")).toBeVisible();
  await page.getByLabel("你的解释").fill("高信心错误值得复盘，因为它说明我把熟悉感误判成掌握。真正掌握要能主动说出机制、边界和例子。比如只觉得材料眼熟不算掌握，必须能解释为什么这个错因会出现，以及下一次如何避免。");
  await page.getByRole("button", { name: /保存解释版本/ }).click();
  await expect(page.getByText(/已保存/)).toBeVisible();

  await page.goto("/review/mistakes");
  await expect(page.getByText("in_progress")).toBeVisible();
  await page.getByRole("button", { name: /生成补救卡/ }).click();
  await expect(page.getByText("已生成补救候选题")).toBeVisible();
  await page.getByRole("button", { name: /标记已解决/ }).click();
  await expect(page.getByText("修复任务已标记为已完成")).toBeVisible();

  await page.goto("/insights");
  await expect(page.getByText("未解决高信心错误任务：0")).toBeVisible();
  await expect(page.getByText("校准证据质量", { exact: true })).toBeVisible();
  await expect(page.getByText("信心可靠性曲线", { exact: true })).toBeVisible();
  await expect(page.getByText("Brier 趋势", { exact: true })).toBeVisible();
  await expect(page.getByText("证据下钻", { exact: true })).toBeVisible();
  await expect(page.getByText("下一步行动", { exact: true })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("MetaLearn OS rejects invalid JSON imports before writing data", async ({ page }) => {
  await page.goto("/library");
  await page.getByLabel("选择 JSON 导出包").setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("{")
  });

  await expect(page.getByText("文件不是有效 JSON。", { exact: true })).toBeVisible();
  await expect(page.getByText("阻断问题 · 1")).toBeVisible();
  await expect(page.getByRole("button", { name: /确认导入/ })).toBeDisabled();
  await expect(page.getByText("导入完成")).not.toBeVisible();
});
