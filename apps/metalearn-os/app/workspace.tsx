"use client";

import type { ChangeEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  AlertTriangle,
  Brain,
  Check,
  ClipboardCheck,
  Command as CommandIcon,
  Download,
  EyeOff,
  FileText,
  Gauge,
  HelpCircle,
  Link2,
  Lock,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Trash2,
  Upload,
  X
} from "lucide-react";
import type {
  AIRequestPreview,
  Card,
  CardCandidate,
  CardType,
  CheckInFocusState,
  ConceptRelationType,
  ExplanationAttempt,
  ImportConflictStrategy,
  ImportPreview,
  ImportProblem,
  LearningTemplateId,
  MistakeReason,
  ProductArea,
  RepairTask,
  ReviewOutcome,
  SourceChunk,
  SourceDocument,
  SourceInputType
} from "@metalearn/core";
import { learningTemplates } from "@metalearn/core";
import { buildCalibrationBuckets } from "@metalearn/learning-science";
import { validateCardCandidateEvidence } from "@metalearn/storage";
import type { StudyAsset } from "@metalearn/core";
import {
  Badge,
  Button,
  ConfidenceSelector,
  DocumentCard,
  EmptyState,
  EvidenceCard,
  Field,
  InlineError,
  Panel,
  ProductShell,
  ProgressRing,
  ReviewCard,
  SecondaryButton,
  SkeletonPanel,
  StatStrip,
  TaskRail,
  TextArea,
  TextInput,
  TextLink
} from "@metalearn/ui";
import { useMetaLearnWorkspace } from "./use-metalearn-workspace";
import type { CandidateGenerationDiagnostic, MaterialImportDraft, MaterialTextQuality } from "./material-import-state";
import {
  buildChunkRecallPrompts,
  deriveActiveReadingTrack,
  deriveChunkEvidenceSummaries,
  deriveMaterialDetail,
  viewMeta,
  type ActiveReadingTrack,
  type ChunkEvidenceSummary
} from "./workspace-selectors";

type Workspace = ReturnType<typeof useMetaLearnWorkspace>;

interface QuickCommand {
  id: string;
  section: string;
  title: string;
  detail: string;
  shortcut?: string;
  disabled?: boolean;
  run: () => void | Promise<unknown>;
}

export function MetaLearnOSPage({ view, sourceId, reviewMode = "main" }: { view: ProductArea; sourceId?: string; reviewMode?: "main" | "mistakes" }) {
  const workspace = useMetaLearnWorkspace();
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const meta =
    view === "review" && reviewMode === "mistakes"
      ? { path: "/review/mistakes", title: "高信心错误", subtitle: "把最危险的熟悉感错误变成可追踪、可修复、可关闭的任务。" }
      : viewMeta[view];
  const { derived, state } = workspace;
  const quickCommands = useMemo(() => buildQuickCommands(workspace, sourceId), [workspace, sourceId]);

  useEffect(() => {
    if (view !== "review") return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      if (["1", "2", "3", "4", "5"].includes(event.key)) {
        workspace.chooseConfidence(Number(event.key) as 1 | 2 | 3 | 4 | 5);
      }
      const outcomeMap: Record<string, ReviewOutcome> = { a: "again", p: "partial", c: "correct", e: "easy" };
      const outcome = outcomeMap[event.key.toLowerCase()];
      if (outcome && workspace.reviewStage === "self_rating") void workspace.completeReview(outcome);
      if (event.key.toLowerCase() === "n" && workspace.reviewStage === "feedback") workspace.startNextReview();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [view, workspace]);

  useEffect(() => {
    if (view !== "explain") return;
    const taskId = new URLSearchParams(window.location.search).get("repairTaskId");
    if (taskId && taskId !== workspace.activeRepairTaskId) void workspace.startRepairExplanation(taskId);
  }, [view, workspace]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandQuery("");
        setIsCommandOpen(true);
      }
      if (event.key === "?") {
        event.preventDefault();
        setCommandQuery("");
        setIsCommandOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (view !== "library" || workspace.materialImportDraft.stage !== "candidates_ready") return;
    const timeout = window.setTimeout(() => {
      document.getElementById("candidate-review")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(timeout);
  }, [view, workspace.materialImportDraft.stage, workspace.materialImportDraft.updatedAt]);

  const actions = (
    <>
      <SecondaryButton onClick={() => setIsCommandOpen(true)}>
        <CommandIcon size={16} /> 命令
      </SecondaryButton>
      <SecondaryButton onClick={workspace.exportJson}>
        <Archive size={16} /> 导出包
      </SecondaryButton>
      <SecondaryButton onClick={workspace.downloadCsv}>
        <Download size={16} /> CSV
      </SecondaryButton>
      <SecondaryButton onClick={workspace.downloadAnki}>
        <Download size={16} /> Anki
      </SecondaryButton>
    </>
  );

  return (
    <ProductShell currentPath={meta.path} title={meta.title} subtitle={meta.subtitle} actions={actions} modules={derived.modules}>
      <div className="grid gap-5">
        {workspace.error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{workspace.error}</span>
              {view === "library" && state.sources.length > 0 ? (
                <SecondaryButton className="!border-rose-200 !bg-white !text-rose-900 hover:!bg-rose-100" onClick={() => void workspace.startManualCard(sourceId ?? state.sources[0].id)}>
                  <FileText size={16} /> 改为手工建卡
                </SecondaryButton>
              ) : null}
            </div>
          </div>
        ) : null}
        {workspace.lastAction?.ok ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950">{workspace.lastAction.message}</div> : null}
        {workspace.isLoading ? <SkeletonPanel /> : null}
        <StatStrip
          items={[
            { label: "材料", value: String(state.sources.length), detail: "本地资料库" },
            { label: "今日复习", value: String(derived.dueCards.length), detail: "到期卡片", tone: derived.dueCards.length ? "warn" : "good" },
            { label: "Brier", value: derived.metrics.brierScore.toFixed(3), detail: "越低越校准" },
            { label: "高信心错误", value: `${Math.round(derived.metrics.highConfidenceErrorRate * 100)}%`, detail: "4-5 档错误率", tone: derived.highConfidenceErrors.length ? "danger" : "neutral" }
          ]}
        />
        {workspace.aiPreview ? <AIRequestPreviewPanel workspace={workspace} preview={workspace.aiPreview} onConfirm={workspace.confirmCandidateGeneration} onCancel={workspace.cancelAIRequestPreview} /> : null}
        {view === "home" ? <HomeView workspace={workspace} /> : null}
        {view === "library" ? sourceId ? <MaterialDetailView workspace={workspace} sourceId={sourceId} /> : <LibraryView workspace={workspace} /> : null}
        {view === "review" && reviewMode === "main" ? <ReviewView workspace={workspace} /> : null}
        {view === "review" && reviewMode === "mistakes" ? <MistakesView workspace={workspace} /> : null}
        {view === "explain" ? <ExplainView workspace={workspace} /> : null}
        {view === "compass" ? <CompassView workspace={workspace} /> : null}
        {view === "insights" ? <InsightsView workspace={workspace} /> : null}
        {view === "settings" ? <SettingsView workspace={workspace} /> : null}
      </div>
      {isCommandOpen ? (
        <QuickCommandPalette
          commands={quickCommands}
          query={commandQuery}
          onQueryChange={setCommandQuery}
          onClose={() => setIsCommandOpen(false)}
        />
      ) : null}
    </ProductShell>
  );
}

function buildQuickCommands(workspace: Workspace, sourceId?: string): QuickCommand[] {
  const currentSourceId = sourceId ?? workspace.candidateDiagnostic.sourceId ?? workspace.state.sources[0]?.id;
  const hasSource = Boolean(currentSourceId);
  const navigate = (href: string) => {
    window.location.href = href;
  };

  return [
    {
      id: "library-import",
      section: "资料",
      title: "导入材料",
      detail: "选择 PDF/TXT/Markdown，保存后再生成候选题。",
      shortcut: "G L",
      run: () => navigate("/library#material-import")
    },
    {
      id: "review-due",
      section: "复习",
      title: "开始校准复习",
      detail: `${workspace.derived.dueCards.length} 张到期卡片。先评信心，再主动回答。`,
      shortcut: "G R",
      run: () => navigate("/review")
    },
    {
      id: "mistakes",
      section: "修复",
      title: "查看高信心错误",
      detail: `${workspace.derived.repairTaskSummary.unresolvedCount} 个未解决修复任务。`,
      run: () => navigate("/review/mistakes")
    },
    {
      id: "explain",
      section: "解释",
      title: "费曼解释",
      detail: "解释一个概念，让 AI 只提追问，不给标准答案。",
      run: () => navigate("/explain")
    },
    {
      id: "manual-card",
      section: "资料",
      title: "从来源手工建卡",
      detail: hasSource ? "从当前或最近材料选择 chunk，保存为候选题。" : "先导入材料，再从来源片段建卡。",
      disabled: !hasSource,
      run: () => {
        if (currentSourceId) void workspace.startManualCard(currentSourceId);
      }
    },
    {
      id: "compass",
      section: "调控",
      title: "打开学习罗盘",
      detail: "60 秒计划、check-in 和 2 分钟反思。",
      run: () => navigate("/compass")
    },
    {
      id: "insights",
      section: "洞察",
      title: "查看洞察报告",
      detail: "Brier、过度自信、高信心错误和薄弱 tag。",
      run: () => navigate("/insights")
    },
    {
      id: "export",
      section: "隐私",
      title: "导出本地备份",
      detail: "下载 JSON 包；不会上传到服务器。",
      run: workspace.exportJson
    },
    {
      id: "settings",
      section: "隐私",
      title: "设置与隐私中心",
      detail: "AI provider、本地 mock、导出、删除和隐私边界。",
      run: () => navigate("/settings")
    }
  ];
}

function QuickCommandPalette({
  commands,
  query,
  onQueryChange,
  onClose
}: {
  commands: QuickCommand[];
  query: string;
  onQueryChange: (value: string) => void;
  onClose: () => void;
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const filteredCommands = commands.filter((command) => {
    if (!normalizedQuery) return true;
    return `${command.section} ${command.title} ${command.detail}`.toLowerCase().includes(normalizedQuery);
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function runCommand(command: QuickCommand) {
    if (command.disabled) return;
    onClose();
    await command.run();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-start bg-zinc-950/18 px-3 py-16 backdrop-blur-sm sm:px-6" role="presentation" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-label="命令中心"
        aria-modal="true"
        className="mx-auto grid w-full max-w-2xl overflow-hidden rounded-[1.25rem] border border-white/80 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.22)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="border-b border-zinc-100 p-4">
          <div className="flex items-center gap-3 rounded-2xl bg-zinc-50 px-3 py-2">
            <CommandIcon size={18} className="text-emerald-700" />
            <input
              autoFocus
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="搜索命令、页面或学习动作"
              className="min-h-10 flex-1 bg-transparent text-sm font-medium text-zinc-950 outline-none placeholder:text-zinc-400"
            />
            <span className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-semibold text-zinc-500">Esc</span>
          </div>
        </div>
        <div className="max-h-[62vh] overflow-auto p-2">
          {filteredCommands.length === 0 ? (
            <EmptyState title="没有匹配命令" detail="试试搜索“复习”“导入”“隐私”或“错误”。" />
          ) : (
            filteredCommands.map((command) => (
              <button
                key={command.id}
                disabled={command.disabled}
                onClick={() => void runCommand(command)}
                className="grid w-full min-w-0 grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-emerald-50/80 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <span className="text-xs font-semibold text-emerald-700">{command.section}</span>
                <span className="min-w-0">
                  <span className="block break-words text-sm font-semibold text-zinc-950">{command.title}</span>
                  <span className="mt-1 block break-words text-xs leading-5 text-zinc-500">{command.detail}</span>
                </span>
                {command.shortcut ? <span className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-semibold text-zinc-500">{command.shortcut}</span> : null}
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function AIRequestPreviewPanel({ workspace, preview, onConfirm, onCancel }: { workspace: Workspace; preview: AIRequestPreview; onConfirm: () => Promise<unknown>; onCancel: () => Promise<unknown> }) {
  const source = preview.sourceId ? workspace.state.sources.find((item) => item.id === preview.sourceId) : undefined;
  const previewChunks = workspace.state.chunks.filter((chunk) => preview.chunkIds.includes(chunk.id));
  return (
    <Panel className="border-emerald-200 bg-emerald-50/80">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>上传前预览</Badge>
            <Badge>{preview.providerMode === "local_mock" ? "本地 mock" : preview.providerName}</Badge>
            <Badge>{preview.chunkCount} 个片段</Badge>
            {source ? <Badge>{source.title}</Badge> : null}
          </div>
          <h3 className="mt-3 text-2xl font-semibold tracking-[-0.02em]">将发送哪些内容</h3>
          <p className="mt-2 max-w-[78ch] text-sm leading-6 text-emerald-950">{preview.payloadSummary}</p>
          <p className="mt-2 text-xs text-emerald-800">确认前不会调用 AI。所有输出仍是候选内容，需要你审核。</p>
          {previewChunks.length > 0 ? (
            <div className="mt-4 grid gap-2">
              {previewChunks.slice(0, 3).map((chunk) => (
                <div key={chunk.id} className="rounded-2xl border border-emerald-100 bg-white/70 px-3 py-2 text-xs leading-5 text-emerald-950">
                  <span className="font-semibold">片段 #{chunk.index + 1}</span> · {chunk.text.replace(/\s+/g, " ").slice(0, 180)}
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void onConfirm()}>
            <Sparkles size={16} /> 确认发送并生成候选题
          </Button>
          <SecondaryButton onClick={() => void onCancel()}>
            <X size={16} /> 取消
          </SecondaryButton>
        </div>
      </div>
    </Panel>
  );
}

function HomeView({ workspace }: { workspace: Workspace }) {
  const { derived, state } = workspace;
  return (
    <section className="grid gap-5 xl:grid-cols-[310px_1fr_360px]">
      <TaskRail title="今日路线">
        <div className="rounded-2xl bg-white/10 p-4">
          <p className="text-2xl font-semibold tracking-[-0.02em]">{derived.dailyPlan.nextBestAction}</p>
          <p className="mt-3 text-sm leading-6 text-emerald-50">北极星指标：每周完成的校准提取次数。</p>
        </div>
        <TaskPill label="到期复习" value={derived.dailyPlan.dueReviewCount} />
        <TaskPill label="高信心错误" value={derived.dailyPlan.highConfidenceErrorCount} />
        <TaskPill label="候选待审" value={derived.dailyPlan.pendingCandidateCount} />
        {derived.dailyPlan.metacognitiveOverheadWarning ? <p className="rounded-2xl bg-amber-100/20 p-3 text-sm text-amber-50">{derived.dailyPlan.metacognitiveOverheadWarning}</p> : null}
        <Button className="!bg-white !text-emerald-950 hover:!bg-emerald-50" onClick={() => (window.location.href = viewMeta[derived.dailyPlan.suggestedArea].path)}>
          开始下一步
        </Button>
      </TaskRail>
      <Panel>
        <StudyModeLauncher workspace={workspace} />
        <div className="mt-6 flex items-center justify-between gap-3 border-t border-zinc-100 pt-5">
          <div>
            <h3 className="text-2xl font-semibold tracking-[-0.02em]">当前学习资产</h3>
            <p className="mt-1 text-sm text-zinc-600">材料、候选题、卡片和解释版本统一管理。</p>
          </div>
          <TextLink href="/library">查看资料库</TextLink>
        </div>
        <div className="mt-5 grid gap-3">
          {state.sources.length === 0 ? <EmptyState title="先导入一份真实材料" detail="不要从空白开始。用课程笔记、论文段落、考试讲义或技术文档启动完整闭环。" action={<TextLink href="/library">进入资料库</TextLink>} /> : null}
          {derived.assets.slice(0, 5).map((asset: StudyAsset) => (
            <DocumentCard key={asset.id} title={asset.title} detail={asset.detail} meta={asset.kind} status={asset.statusLabel} href={asset.href} />
          ))}
        </div>
      </Panel>
      <Panel>
        <h3 className="text-2xl font-semibold tracking-[-0.02em]">校准侧栏</h3>
        <div className="mt-5 grid gap-4">
          <ProgressRing value={Math.max(0, 1 - derived.insight.brierScore)} label="校准质量" />
          <ProgressRing value={derived.insight.activeLearningRatio} label="主动学习比例" />
          <ProgressRing value={1 - derived.insight.passiveLearningRisk} label="被动学习风险" />
          <div className="rounded-2xl bg-zinc-50 p-4">
            <p className="text-sm font-semibold text-zinc-950">本周建议</p>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{derived.insight.recommendation}</p>
          </div>
          {derived.activeCard ? <EvidenceCard label="下一张卡片来源" quote={derived.activeCard.sourceQuote} /> : null}
          <p className="text-sm text-zinc-500">{derived.pendingCandidates.length} 张候选题待审核，{derived.highConfidenceErrors.length} 个高信心错误待复盘。</p>
        </div>
      </Panel>
    </section>
  );
}

function StudyModeLauncher({ workspace }: { workspace: Workspace }) {
  const { derived, state } = workspace;
  const modes = [
    {
      label: "导入资料",
      href: "/library#material-import",
      detail: state.sources.length ? `${state.sources.length} 份材料，继续生成候选题` : "从真实材料开始，不从空白题库开始",
      meta: "source-first"
    },
    {
      label: "校准复习",
      href: "/review",
      detail: `${derived.dueCards.length} 张到期卡片`,
      meta: "confidence first"
    },
    {
      label: "修复错误",
      href: "/review/mistakes",
      detail: `${derived.repairTaskSummary.unresolvedCount} 个高信心错误`,
      meta: "repair loop"
    },
    {
      label: "费曼解释",
      href: "/explain",
      detail: state.explanations.length ? `${state.explanations.length} 个解释版本` : "用追问找出理解漏洞",
      meta: "ask, not answer"
    },
    {
      label: "计划反思",
      href: "/compass",
      detail: state.sessions.length ? `${state.sessions.length} 次学习会话` : "60 秒计划，2 分钟反思",
      meta: "low overhead"
    }
  ];

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-2xl font-semibold tracking-[-0.02em]">现在想怎么学</h3>
          <p className="mt-1 text-sm leading-6 text-zinc-600">从资料、复习、修复、解释或计划进入；每条路径都保留来源证据。</p>
        </div>
        <span className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-600">Ctrl / Cmd + K</span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {modes.map((mode) => (
          <a key={mode.label} href={mode.href} className="group min-w-0 rounded-2xl bg-zinc-50 px-4 py-3 transition hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <span className="block text-xs font-semibold text-emerald-700">{mode.meta}</span>
            <span className="mt-2 block break-words text-base font-semibold text-zinc-950">{mode.label}</span>
            <span className="mt-1 block break-words text-xs leading-5 text-zinc-500">{mode.detail}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function LibraryView({ workspace }: { workspace: Workspace }) {
  const { derived, state } = workspace;
  const draft = workspace.materialImportDraft;
  const quality = workspace.materialTextQuality;
  const diagnostic = workspace.candidateDiagnostic;
  const currentSource = diagnostic.sourceId ? state.sources.find((source) => source.id === diagnostic.sourceId) : undefined;
  const currentChunkIds = new Set(state.chunks.filter((chunk) => chunk.sourceId === diagnostic.sourceId).map((chunk) => chunk.id));
  const currentMaterialCandidateCount = derived.pendingCandidates.filter((candidate) => currentChunkIds.has(candidate.sourceChunkId)).length;
  const recentCandidateIds = new Set(draft.candidateIds);
  async function handleMaterialFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    await workspace.prepareMaterialFileImport(file);
    input.value = "";
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_430px]">
      <Panel id="material-import">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-2xl font-semibold tracking-[-0.02em]">导入材料</h3>
            <p className="mt-1 max-w-[76ch] text-sm leading-6 text-zinc-600">选择文件只会读取到本地文本框，不等于入库。保存后才会生成 source chunks；AI 生成前还必须确认上传预览。</p>
          </div>
          <Badge>{stageLabel(draft.stage)}</Badge>
        </div>

        <div className="mt-5 grid gap-5">
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
            <SectionHeader title="文件与模板" detail="PDF 只支持可复制文本层；TXT 和 Markdown 会直接读取文本。JSON 备份包在右侧“导入与恢复”处理。" />
            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_180px_180px]">
              <Field label="材料标题">
                <TextInput value={workspace.title} onChange={(event) => workspace.setTitle(event.target.value)} />
              </Field>
              <Field label="学习模板">
                <TemplateSelect value={workspace.templateId} onChange={workspace.setTemplateId} />
              </Field>
              <Field label="输入类型">
                <InputTypeSelect value={workspace.sourceInputType} onChange={workspace.setSourceInputType} />
              </Field>
            </div>
            <div className="mt-4 grid gap-2">
              <p className="text-sm font-medium text-zinc-900">学习材料文件</p>
              <input
                id="material-file-input"
                className="sr-only"
                type="file"
                accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown"
                aria-label="学习材料文件"
                disabled={workspace.isReadingMaterialFile}
                onChange={(event) => void handleMaterialFile(event)}
              />
              <label
                htmlFor="material-file-input"
                className="inline-flex min-h-11 w-fit max-w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white/90 px-4 py-2 text-sm font-semibold text-zinc-900 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 focus-within:ring-2 focus-within:ring-emerald-500"
              >
                <Upload size={16} /> {workspace.isReadingMaterialFile ? "读取文件中" : "选择 PDF / TXT / Markdown"}
              </label>
              <span className="text-xs leading-5 text-zinc-500">当前文件：{draft.fileName ?? "未选择"}。选择后先进入文本预览，不会创建材料，也不会调用 AI。</span>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-100 bg-white/70 p-4">
            <SectionHeader title="文本预览" detail="保存前请确认这里有真实可读内容。扫描件 PDF 不会静默入库，会提示换可复制文本层或手动粘贴。" />
            <div className="mt-4">
              <Field label="文本 / Markdown / PDF 提取文本" hint={workspace.isReadingMaterialFile ? "正在本地读取文件文本..." : "也可以直接粘贴文本。PDF 必须有可复制文本层。"}>
                <TextArea value={workspace.sourceText} onChange={(event) => workspace.setSourceText(event.target.value)} className="min-h-56" />
              </Field>
            </div>
            <MaterialTextQualityPanel quality={quality} />
          </div>

          <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
            <SectionHeader title="下一步操作" detail="主路径是保存并生成候选题：先写入本地资料库，再创建上传预览，最后由你确认生成。" />
            <div className="mt-4 flex flex-wrap gap-2">
              <Button disabled={workspace.isReadingMaterialFile || Boolean(quality.blockingError)} onClick={() => void workspace.importSourceAndPrepareCandidates()}>
                <Sparkles size={16} /> 保存并生成候选题
              </Button>
              <SecondaryButton disabled={workspace.isReadingMaterialFile || Boolean(quality.blockingError)} onClick={() => void workspace.importSource()}>
                <Upload size={16} /> 仅保存到资料库
              </SecondaryButton>
              <SecondaryButton onClick={() => void workspace.prepareRecentCandidateGeneration()}>
                <Sparkles size={16} /> 为最近材料生成候选题
              </SecondaryButton>
              <SecondaryButton disabled={!currentSource} onClick={() => void workspace.startManualCard(currentSource?.id ?? state.sources[0]?.id)}>
                <FileText size={16} /> 改为手工建卡
              </SecondaryButton>
              {currentSource ? <TextLink href={`/library/${currentSource.id}`}>打开材料详情</TextLink> : null}
            </div>
          </div>

          <CandidateGenerationDiagnosticPanel diagnostic={diagnostic} draft={draft} />
        </div>
        <MaterialStatusFlow sources={state.sources} />
        {workspace.manualCardForm.isOpen ? <ManualCardPanel workspace={workspace} /> : null}
      </Panel>
      <ImportRestorePanel workspace={workspace} />
      <Panel>
        <h3 className="text-2xl font-semibold tracking-[-0.02em]">资产搜索</h3>
        <div className="mt-4">
          <Field label="搜索材料、卡片、解释">
            <TextInput value={workspace.searchQuery} onChange={(event) => workspace.setSearchQuery(event.target.value)} placeholder="输入 tag、标题、来源片段" />
          </Field>
        </div>
        <div className="mt-5 grid max-h-[520px] gap-3 overflow-auto pr-1">
          {derived.assets.length === 0 ? <EmptyState title="资料库还没有资产" detail="导入材料后，这里会显示材料、候选题、复习卡和解释版本。" /> : null}
          {derived.assets.slice(0, 12).map((asset: StudyAsset) => (
            <DocumentCard key={asset.id} title={asset.title} detail={asset.detail} meta={asset.kind} status={asset.statusLabel} href={asset.href} />
          ))}
        </div>
      </Panel>
      <Panel id="candidate-review" className="xl:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-2xl font-semibold tracking-[-0.02em]">候选题审核台</h3>
            <p className="mt-1 text-sm text-zinc-600">候选题必须可编辑、可拒绝、可追溯来源；不会自动进队列。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>{derived.pendingCandidates.length} 待审核</Badge>
            <Badge>当前材料 {currentMaterialCandidateCount}</Badge>
            <Badge>最近生成 {draft.candidateIds.length}</Badge>
            <SecondaryButton onClick={() => void workspace.approveAllCandidates()}>
              <Check size={16} /> 批量批准
            </SecondaryButton>
          </div>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {derived.pendingCandidates.length === 0 ? (
            <EmptyState title="没有候选题" detail={diagnostic.blockingReason ?? "先为一份材料生成候选题。无来源片段的问题会被挡在队列外。"} />
          ) : null}
          {derived.pendingCandidates.slice(0, 8).map((candidate: CardCandidate) => (
            <CandidateEditor key={candidate.id} candidate={candidate} workspace={workspace} highlighted={recentCandidateIds.has(candidate.id)} />
          ))}
        </div>
      </Panel>
    </section>
  );
}

function MaterialTextQualityPanel({ quality }: { quality: MaterialTextQuality }) {
  return (
    <div className="mt-4 grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MaterialStat label="字符" value={quality.charCount} />
        <MaterialStat label="预计 chunk" value={quality.chunkEstimate} />
        <MaterialStat label="行数" value={quality.lineCount} />
        <MaterialStat label="PDF 页数" value={quality.pageCount ?? 0} />
      </div>
      {quality.blockingError ? <InlineError message={quality.blockingError} /> : null}
      {quality.warnings.length > 0 ? (
        <div className="grid gap-2">
          {quality.warnings.map((warning) => (
            <div key={warning} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
              {warning}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-zinc-500">文本质量暂无阻断问题。生成前仍建议快速扫一眼来源是否可读。</p>
      )}
    </div>
  );
}

function CandidateGenerationDiagnosticPanel({ diagnostic, draft }: { diagnostic: CandidateGenerationDiagnostic; draft: MaterialImportDraft }) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
      <SectionHeader title="生成诊断" detail="这里说明候选题卡在哪一步，以及下一步应该做什么。" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <DiagnosticLine label="当前阶段" value={stageLabel(draft.stage)} />
        <DiagnosticLine label="当前材料" value={diagnostic.sourceTitle ?? "未入库"} />
        <DiagnosticLine label="chunk" value={String(diagnostic.chunkCount)} />
        <DiagnosticLine label="预览状态" value={diagnostic.lastPreviewStatus ?? "无"} />
        <DiagnosticLine label="候选题" value={String(diagnostic.pendingCandidateCount)} />
      </div>
      <div className="mt-4 flex flex-col gap-2 rounded-2xl bg-white/75 p-4 text-sm leading-6 text-zinc-700">
        <p>
          <span className="font-semibold text-zinc-950">下一步：</span>
          {nextActionLabel(diagnostic.nextAction)}
        </p>
        {diagnostic.blockingReason ? <p className="text-rose-800">{diagnostic.blockingReason}</p> : null}
        {draft.generatedCandidateCount ? <p className="text-emerald-800">最近生成 {draft.generatedCandidateCount} 张候选题，仍需人工审核。</p> : null}
      </div>
    </div>
  );
}

function MaterialGenerationDiagnosticPanel({ diagnostic }: { diagnostic: CandidateGenerationDiagnostic }) {
  return (
    <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/55 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-950">候选题生成诊断</p>
          <p className="mt-1 text-sm leading-6 text-emerald-900">{nextActionLabel(diagnostic.nextAction)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>chunk {diagnostic.chunkCount}</Badge>
          <Badge>待审 {diagnostic.pendingCandidateCount}</Badge>
          <Badge>{diagnostic.lastPreviewStatus ?? "无预览"}</Badge>
        </div>
      </div>
      {diagnostic.blockingReason ? <p className="mt-3 rounded-2xl bg-white/75 px-3 py-2 text-sm leading-6 text-rose-800">{diagnostic.blockingReason}</p> : null}
      {diagnostic.lastGeneratedAt ? <p className="mt-2 text-xs text-emerald-800">最近生成：{formatDate(diagnostic.lastGeneratedAt)}</p> : null}
    </div>
  );
}

function MaterialReaderWorkbench({
  source,
  chunks,
  filteredChunks,
  focusedChunk,
  chunkEvidence,
  activeReadingTrack,
  readerQuery,
  onReaderQueryChange,
  onFocusChunk,
  archived,
  workspace
}: {
  source: SourceDocument;
  chunks: SourceChunk[];
  filteredChunks: SourceChunk[];
  focusedChunk?: SourceChunk;
  chunkEvidence: Map<string, ChunkEvidenceSummary>;
  activeReadingTrack: ActiveReadingTrack;
  readerQuery: string;
  onReaderQueryChange: (value: string) => void;
  onFocusChunk: (chunkId: string) => void;
  archived: boolean;
  workspace: Workspace;
}) {
  const coveredCount = chunks.filter((chunk) => (chunkEvidence.get(chunk.id)?.status ?? "uncovered") !== "uncovered").length;
  const totalCards = chunks.reduce((sum, chunk) => sum + (chunkEvidence.get(chunk.id)?.approvedCardCount ?? 0), 0);
  const totalReviews = chunks.reduce((sum, chunk) => sum + (chunkEvidence.get(chunk.id)?.reviewCount ?? 0), 0);
  const totalCandidates = chunks.reduce((sum, chunk) => sum + (chunkEvidence.get(chunk.id)?.candidateCount ?? 0), 0);
  const focusedIndex = focusedChunk ? chunks.findIndex((chunk) => chunk.id === focusedChunk.id) : -1;
  const previousChunk = focusedIndex > 0 ? chunks[focusedIndex - 1] : undefined;
  const nextChunk = focusedIndex >= 0 && focusedIndex < chunks.length - 1 ? chunks[focusedIndex + 1] : undefined;

  return (
    <Panel>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <SectionHeader title="阅读工作台" detail="像读材料一样处理来源：定位 chunk、检查证据覆盖、从当前片段直接建卡或进入费曼解释。" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[460px]">
          <MaterialStat label="覆盖片段" value={coveredCount} />
          <MaterialStat label="待审候选" value={totalCandidates} />
          <MaterialStat label="卡片" value={totalCards} />
          <MaterialStat label="复习证据" value={totalReviews} />
        </div>
      </div>

      <ActiveReadingTrackPanel
        track={activeReadingTrack}
        source={source}
        archived={archived}
        workspace={workspace}
        onFocusChunk={onFocusChunk}
      />

      <div className="mt-5 rounded-2xl bg-zinc-50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-zinc-950">证据覆盖</p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">绿色越深，说明该片段越接近“已被提取并复习”。空白片段优先补卡或解释。</p>
          </div>
          <Badge>{chunks.length ? Math.round((coveredCount / chunks.length) * 100) : 0}% covered</Badge>
        </div>
        <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-10 lg:grid-cols-12">
          {chunks.map((chunk) => {
            const evidence = chunkEvidence.get(chunk.id);
            const status = evidence?.status ?? "uncovered";
            return (
              <button
                key={chunk.id}
                type="button"
                onClick={() => onFocusChunk(chunk.id)}
                aria-label={`片段 ${chunk.index + 1} ${chunkStatusLabel(status)}`}
                className={`h-9 rounded-xl border text-xs font-semibold transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${chunkCoverageClass(status, focusedChunk?.id === chunk.id)}`}
              >
                {chunk.index + 1}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 rounded-[1.25rem] border border-emerald-100 bg-emerald-50/45 p-5">
          {focusedChunk ? (
            <>
              <p className="mb-3 text-sm font-semibold text-emerald-950">聚焦片段</p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{source.title}</Badge>
                <Badge>片段 #{focusedChunk.index + 1}</Badge>
                <Badge>{chunkStatusLabel(chunkEvidence.get(focusedChunk.id)?.status ?? "uncovered")}</Badge>
              </div>
              <p className="mt-4 whitespace-pre-wrap break-words text-base leading-8 text-zinc-900">{focusedChunk.text}</p>
              <div className="mt-4 rounded-2xl bg-white/80 p-4">
                <p className="text-sm font-semibold text-zinc-950">读后立即自测</p>
                <div className="mt-3 grid gap-2">
                  {buildChunkRecallPrompts(focusedChunk).map((prompt) => (
                    <p key={prompt} className="rounded-xl bg-zinc-50 px-3 py-2 text-sm leading-6 text-zinc-700">{prompt}</p>
                  ))}
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <SecondaryButton disabled={!previousChunk} onClick={() => previousChunk ? onFocusChunk(previousChunk.id) : undefined}>
                  上一段
                </SecondaryButton>
                <SecondaryButton disabled={!nextChunk} onClick={() => nextChunk ? onFocusChunk(nextChunk.id) : undefined}>
                  下一段
                </SecondaryButton>
                <Button disabled={archived} onClick={() => void workspace.startManualCard(source.id, focusedChunk.id)}>
                  <FileText size={16} /> 用当前片段建卡
                </Button>
                <SecondaryButton disabled={archived} onClick={() => openChunkInExplain(source, focusedChunk)}>
                  <HelpCircle size={16} /> 用当前片段解释
                </SecondaryButton>
                <TextLink href="/review">复习相关卡片</TextLink>
              </div>
            </>
          ) : (
            <EmptyState title="没有可读片段" detail="这份材料没有可用 chunk。请重新导入可复制文本层材料。" />
          )}
        </div>

        <div className="min-w-0 rounded-[1.25rem] border border-zinc-100 bg-white/70 p-4">
          <Field label="搜索来源片段">
            <TextInput value={readerQuery} onChange={(event) => onReaderQueryChange(event.target.value)} placeholder="输入关键词定位 chunk" />
          </Field>
          <div className="mt-4 max-h-[560px] overflow-auto pr-1">
            <p className="text-sm font-semibold text-zinc-950">来源片段</p>
            <div className="mt-3 grid gap-2">
              {filteredChunks.length === 0 ? <EmptyState title="没有匹配片段" detail="换一个关键词，或清空搜索后查看全部来源。" /> : null}
              {filteredChunks.map((chunk) => (
                <ReaderChunkRow
                  key={chunk.id}
                  chunk={chunk}
                  evidence={chunkEvidence.get(chunk.id)}
                  active={focusedChunk?.id === chunk.id}
                  archived={archived}
                  onFocus={() => onFocusChunk(chunk.id)}
                  onManualCard={() => void workspace.startManualCard(source.id, chunk.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function ActiveReadingTrackPanel({
  track,
  source,
  archived,
  workspace,
  onFocusChunk
}: {
  track: ActiveReadingTrack;
  source: SourceDocument;
  archived: boolean;
  workspace: Workspace;
  onFocusChunk: (chunkId: string) => void;
}) {
  const step = track.nextStep;
  return (
    <div className="mt-5 rounded-[1.25rem] border border-emerald-100 bg-white/80 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-950">主动阅读轨</p>
          <p className="mt-1 max-w-[72ch] text-sm leading-6 text-zinc-600">
            按证据缺口排序处理材料：未覆盖片段先补提取证据，已有候选题先审核，已有卡片先复习。
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[460px]">
          <MaterialStat label="未覆盖" value={track.uncoveredCount} />
          <MaterialStat label="待审核" value={track.candidateOnlyCount} />
          <MaterialStat label="待复习" value={track.cardedNotReviewedCount} />
          <MaterialStat label="已复习" value={track.reviewedCount} />
        </div>
      </div>
      {step ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0 rounded-2xl bg-emerald-50/70 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{step.actionLabel}</Badge>
              <Badge>片段 #{step.chunk.index + 1}</Badge>
              <Badge>{chunkStatusLabel(step.evidence.status)}</Badge>
            </div>
            <p className="mt-3 break-words text-sm leading-6 text-emerald-950">{step.rationale}</p>
            <div className="mt-3 grid gap-2">
              {step.prompts.map((prompt) => (
                <p key={prompt} className="rounded-xl bg-white/85 px-3 py-2 text-sm leading-6 text-zinc-700">{prompt}</p>
              ))}
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <SecondaryButton onClick={() => onFocusChunk(step.chunk.id)}>
              查看建议片段
            </SecondaryButton>
            {step.priority === "create" ? (
              <>
                <Button disabled={archived} onClick={() => void workspace.startManualCard(source.id, step.chunk.id)}>
                  <FileText size={16} /> 从该片段建卡
                </Button>
                <SecondaryButton disabled={archived} onClick={() => openChunkInExplain(source, step.chunk)}>
                  <HelpCircle size={16} /> 先解释这段
                </SecondaryButton>
              </>
            ) : null}
            {step.priority === "review_candidate" ? <TextLink href="#material-candidates">审核候选题</TextLink> : null}
            {step.priority === "review_card" ? <TextLink href="/review">进入校准复习</TextLink> : null}
            {step.priority === "verify" ? <TextLink href="#material-review-evidence">查看复习证据</TextLink> : null}
          </div>
        </div>
      ) : (
        <EmptyState title="还没有可阅读片段" detail="导入可复制文本层材料后，这里会生成按证据缺口排序的阅读轨。" />
      )}
    </div>
  );
}

function ReaderChunkRow({
  chunk,
  evidence,
  active,
  archived,
  onFocus,
  onManualCard
}: {
  chunk: SourceChunk;
  evidence?: ChunkEvidenceSummary;
  active: boolean;
  archived: boolean;
  onFocus: () => void;
  onManualCard: () => void;
}) {
  const status = evidence?.status ?? "uncovered";
  return (
    <article className={`min-w-0 rounded-2xl p-3 ${active ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-zinc-50"}`}>
      <button type="button" onClick={onFocus} className="block w-full min-w-0 text-left focus:outline-none focus:ring-2 focus:ring-emerald-500">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>#{chunk.index + 1}</Badge>
          <span className="text-xs font-semibold text-zinc-500">{chunkStatusLabel(status)}</span>
          <span className="text-xs text-zinc-500">{evidence?.approvedCardCount ?? 0} 卡 · {evidence?.reviewCount ?? 0} 复习</span>
        </div>
        <p className="mt-2 break-words text-sm leading-6 text-zinc-700">{chunk.text.slice(0, 180)}{chunk.text.length > 180 ? "..." : ""}</p>
      </button>
      <div className="mt-3 flex flex-wrap gap-2">
        <SecondaryButton disabled={archived} onClick={onManualCard}>
          <FileText size={16} /> 用此片段建卡
        </SecondaryButton>
      </div>
    </article>
  );
}

function DiagnosticLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/75 p-3">
      <p className="text-xs font-semibold tracking-[0.08em] text-zinc-500">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

function ImportRestorePanel({ workspace }: { workspace: Workspace }) {
  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    await workspace.prepareJsonImport(await file.text());
    input.value = "";
  }

  return (
    <Panel>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-2xl font-semibold tracking-[-0.02em]">导入与恢复</h3>
          <p className="mt-1 text-sm leading-6 text-zinc-600">导入 MetaLearn OS JSON 包。文件只在本地浏览器解析，预检通过并确认后才写入 IndexedDB。</p>
        </div>
        <Badge>本地解析</Badge>
      </div>
      <div className="mt-5 grid gap-4">
        <div className="grid gap-2">
          <p className="text-sm font-medium text-zinc-900">JSON 导出包</p>
          <input
            id="json-import-file"
            className="sr-only"
            type="file"
            accept="application/json,.json"
            aria-label="选择 JSON 导出包"
            onChange={(event) => void handleImportFile(event)}
          />
          <label
            htmlFor="json-import-file"
            className="inline-flex min-h-11 w-fit cursor-pointer items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white/90 px-4 py-2 text-sm font-semibold text-zinc-900 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 focus-within:ring-2 focus-within:ring-emerald-500"
          >
            <Upload size={16} /> 选择 JSON 备份包
          </label>
          <span className="text-xs text-zinc-500">支持全量备份包和单材料包。不支持无来源 flashcard 导入。</span>
        </div>
        {workspace.importPreview ? <ImportPreviewBlock workspace={workspace} preview={workspace.importPreview} /> : null}
        {workspace.importReport ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
            <p className="font-semibold">导入完成</p>
            <p className="mt-1">
              新增 {workspace.importReport.materialCount} 份材料、{workspace.importReport.cardCount} 张卡片、{workspace.importReport.reviewCount} 条复习记录。
              修复 {workspace.importReport.repairedCount} 项，跳过 {workspace.importReport.skippedCount} 项。
            </p>
            {workspace.importReport.firstMaterialId ? <TextLink href={`/library/${workspace.importReport.firstMaterialId}`}>查看导入材料</TextLink> : null}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function ImportPreviewBlock({ workspace, preview }: { workspace: Workspace; preview: ImportPreview }) {
  return (
    <div className="rounded-[1.25rem] border border-zinc-200 bg-white/76 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{importKindLabel(preview.kind)}</Badge>
        <Badge>schema {preview.schemaVersion ?? "unknown"}</Badge>
        <Badge>{preview.canImport ? "可导入" : "不可导入"}</Badge>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-600">导出时间：{preview.exportedAt ? new Date(preview.exportedAt).toLocaleString("zh-CN") : "未提供"}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <ImportCount label="材料" value={preview.counts.materials} />
        <ImportCount label="片段" value={preview.counts.chunks} />
        <ImportCount label="候选" value={preview.counts.candidates} />
        <ImportCount label="卡片" value={preview.counts.cards} />
        <ImportCount label="复习" value={preview.counts.reviews} />
        <ImportCount label="解释" value={preview.counts.explanations} />
        <ImportCount label="会话" value={preview.counts.sessions} />
        <ImportCount label="洞察" value={preview.counts.insights} />
        <ImportCount label="AI 记录" value={preview.counts.aiRequestPreviews} />
      </div>
      <div className="mt-4 grid gap-3">
        <Field label="冲突策略">
          <ImportStrategySelect value={workspace.importStrategy} onChange={workspace.setImportStrategy} />
        </Field>
        <div className="grid gap-2 text-sm">
          {preview.conflicts.length > 0 ? <ImportProblemList title="冲突" problems={preview.conflicts} /> : null}
          {preview.repaired.length > 0 ? <ImportProblemList title="可修复" problems={preview.repaired} /> : null}
          {preview.warnings.length > 0 ? <ImportProblemList title="警告" problems={preview.warnings} /> : null}
          {preview.fatalProblems.length > 0 ? <ImportProblemList title="阻断问题" problems={preview.fatalProblems} danger /> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={!preview.canImport || workspace.isImporting} onClick={() => void workspace.confirmJsonImport()}>
            <Upload size={16} /> {workspace.isImporting ? "导入中" : "确认导入"}
          </Button>
          <SecondaryButton onClick={workspace.cancelJsonImport}>
            <X size={16} /> 取消
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
}

function ImportStrategySelect({ value, onChange }: { value: ImportConflictStrategy; onChange: (value: ImportConflictStrategy) => void }) {
  return (
    <select className="min-h-11 rounded-xl border border-zinc-200 bg-white/90 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" value={value} onChange={(event) => onChange(event.target.value as ImportConflictStrategy)}>
      <option value="keep_both">保留两份，冲突时重命名</option>
      <option value="skip_duplicates">跳过重复项</option>
    </select>
  );
}

function ImportCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-zinc-50 p-3">
      <p className="text-xs font-semibold text-zinc-500">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-zinc-950">{value}</p>
    </div>
  );
}

function ImportProblemList({ title, problems, danger = false }: { title: string; problems: ImportProblem[]; danger?: boolean }) {
  return (
    <div className={danger ? "rounded-2xl border border-rose-200 bg-rose-50 p-3 text-rose-950" : "rounded-2xl bg-zinc-50 p-3 text-zinc-700"}>
      <p className="font-semibold">{title} · {problems.length}</p>
      <ul className="mt-2 grid gap-1">
        {problems.slice(0, 4).map((item) => (
          <li key={`${item.code}-${item.table}-${item.id ?? item.message}`} className="break-words text-xs leading-5">
            {item.table}{item.id ? ` / ${item.id}` : ""}: {item.message}
          </li>
        ))}
      </ul>
      {problems.length > 4 ? <p className="mt-2 text-xs">另有 {problems.length - 4} 项未展开。</p> : null}
    </div>
  );
}

function MaterialDetailView({ workspace, sourceId }: { workspace: Workspace; sourceId: string }) {
  const [readerQuery, setReaderQuery] = useState("");
  const [focusedChunkId, setFocusedChunkId] = useState("");
  const detail = deriveMaterialDetail(workspace.state, sourceId);
  const source = detail.source;
  const chunkEvidence = deriveChunkEvidenceSummaries(detail.chunks, detail.pendingCandidates, detail.approvedCards, detail.reviewLogs);
  const activeReadingTrack = deriveActiveReadingTrack(detail.chunks, chunkEvidence);
  const filteredChunks = detail.chunks.filter((chunk) => {
    const normalizedQuery = readerQuery.trim().toLowerCase();
    if (!normalizedQuery) return true;
    return chunk.text.toLowerCase().includes(normalizedQuery);
  });
  const focusedChunk = detail.chunks.find((chunk) => chunk.id === focusedChunkId) ?? filteredChunks[0] ?? detail.chunks[0];
  if (workspace.isLoading) return <SkeletonPanel />;
  if (!source) {
    return (
      <EmptyState
        title="找不到这份材料"
        detail="这个材料 ID 不在本地资料库里。它可能已经被删除，或当前浏览器没有这份 IndexedDB 数据。"
        action={<TextLink href="/library">返回资料库</TextLink>}
      />
    );
  }

  const archived = source.status === "archived";
  const canWork = !archived && detail.chunks.length > 0;
  const diagnostic = workspace.getCandidateDiagnostic(source.id);
  return (
    <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid min-w-0 gap-5">
        <Panel>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                <Badge>{source.status ?? "new"}</Badge>
                <Badge>{source.templateId}</Badge>
                <Badge>{source.inputType ?? "plain_text"}</Badge>
              </div>
              <h3 className="mt-3 break-words text-3xl font-semibold tracking-[-0.03em] text-zinc-950">{source.title}</h3>
              <p className="mt-2 max-w-[78ch] break-words text-sm leading-6 text-zinc-600">{source.summary ?? source.rawText.slice(0, 220)}</p>
              <p className="mt-3 text-xs text-zinc-500">创建 {formatDate(source.createdAt)} · 最近工作 {formatDate(source.lastWorkedAt ?? source.updatedAt)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canWork ? (
                <>
                  <Button onClick={() => void workspace.prepareCandidateGeneration(source)}>
                    <Sparkles size={16} /> 生成候选题
                  </Button>
                  <SecondaryButton onClick={() => void workspace.startManualCard(source.id, detail.chunks[0]?.id)}>
                    <FileText size={16} /> 手工建卡
                  </SecondaryButton>
                </>
              ) : null}
              <SecondaryButton onClick={() => void workspace.exportMaterial(source.id)}>
                <Download size={16} /> 导出材料
              </SecondaryButton>
              {archived ? (
                <SecondaryButton onClick={() => void workspace.restoreSource(source.id)}>
                  <Archive size={16} /> 恢复
                </SecondaryButton>
              ) : (
                <SecondaryButton onClick={() => void workspace.archiveSource(source.id)}>
                  <Archive size={16} /> 归档
                </SecondaryButton>
              )}
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MaterialStat label="片段" value={detail.statusCounts.chunks} />
            <MaterialStat label="待审" value={detail.statusCounts.pendingCandidates} />
            <MaterialStat label="卡片" value={detail.statusCounts.approvedCards} />
            <MaterialStat label="复习" value={detail.statusCounts.reviewLogs} />
            <MaterialStat label="解释" value={detail.statusCounts.explanations} />
          </div>
          <MaterialGenerationDiagnosticPanel diagnostic={diagnostic} />
          {archived ? <InlineError message="这份材料已归档。证据仍可查看，但生成候选题和手工建卡已暂停。" /> : null}
          {!archived && detail.chunks.length === 0 ? <InlineError message="这份材料没有可用来源片段。请重新导入文本层材料。" /> : null}
          {!archived && diagnostic.blockingReason && diagnostic.nextAction === "manual_card" ? <InlineError message={diagnostic.blockingReason} /> : null}
          {workspace.manualCardForm.isOpen && workspace.manualCardForm.sourceId === source.id ? <ManualCardPanel workspace={workspace} /> : null}
        </Panel>

        <MaterialReaderWorkbench
          source={source}
          chunks={detail.chunks}
          filteredChunks={filteredChunks}
          focusedChunk={focusedChunk}
          chunkEvidence={chunkEvidence}
          activeReadingTrack={activeReadingTrack}
          readerQuery={readerQuery}
          onReaderQueryChange={setReaderQuery}
          onFocusChunk={setFocusedChunkId}
          archived={archived}
          workspace={workspace}
        />

        <Panel>
          <SectionHeader title="候选题审核" detail="这里只显示属于当前材料的候选题。无来源证据时不能批准。" />
          <div id="material-candidates" className="mt-5 grid scroll-mt-24 gap-4 lg:grid-cols-2">
            {detail.pendingCandidates.length === 0 ? <EmptyState title="当前材料没有待审候选题" detail="可以从来源片段手工建卡，也可以先生成 AI 候选题再审核。" /> : null}
            {detail.pendingCandidates.map((candidate) => (
              <CandidateEditor key={candidate.id} candidate={candidate} workspace={workspace} />
            ))}
          </div>
        </Panel>

        <Panel>
          <SectionHeader title="已批准卡片" detail="这些卡片已经进入复习队列，仍保留来源片段和摘录。" />
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {detail.approvedCards.length === 0 ? <EmptyState title="还没有批准卡片" detail="候选题批准后会出现在这里，并进入校准复习。" /> : null}
            {detail.approvedCards.map((card) => (
              <ApprovedCardEvidence key={card.id} card={card} chunks={workspace.state.chunks} />
            ))}
          </div>
        </Panel>
      </div>

      <aside className="grid gap-5 xl:sticky xl:top-5 xl:self-start">
        <Panel>
          <SectionHeader title="复习证据" detail="数据不足时不生成虚假洞察。" />
          <div id="material-review-evidence" className="mt-5 grid scroll-mt-24 gap-4">
            {detail.recentPerformance.reviewCount === 0 ? (
              <EmptyState title="证据不足" detail="完成至少一次复习后，这里才会显示校准指标。" />
            ) : (
              <>
                <ProgressRing value={Math.max(0, 1 - detail.recentPerformance.brierScore)} label={`Brier ${detail.recentPerformance.brierScore.toFixed(3)}`} />
                <ProgressRing value={detail.recentPerformance.accuracy} label={`正确率 ${Math.round(detail.recentPerformance.accuracy * 100)}%`} />
                <ProgressRing value={1 - detail.recentPerformance.highConfidenceErrorRate} label={`高信心错误 ${detail.recentPerformance.highConfidenceErrorCount}`} />
              </>
            )}
            <div className="grid gap-2">
              {detail.reviewLogs.slice(-5).reverse().map((log) => (
                <div key={log.id} className="rounded-2xl bg-white/70 p-3 text-sm leading-6 text-zinc-700">
                  <p className="font-semibold text-zinc-950">信心 {log.confidence} · {log.outcome}</p>
                  <p>证据 {log.evidenceStrength ?? "unknown"} · {formatDate(log.createdAt)}</p>
                </div>
              ))}
            </div>
          </div>
        </Panel>
        <Panel>
          <SectionHeader title="证据健康" detail="发现悬空引用时，应优先修复来源。" />
          <div className="mt-4 grid gap-3 text-sm text-zinc-700">
            <EvidenceHealthLine label="当前材料 chunk" value={detail.chunks.length} />
            <EvidenceHealthLine label="全局悬空候选" value={detail.danglingCandidates.length} tone={detail.danglingCandidates.length ? "danger" : "neutral"} />
            <EvidenceHealthLine label="全局悬空卡片" value={detail.danglingCards.length} tone={detail.danglingCards.length ? "danger" : "neutral"} />
          </div>
        </Panel>
      </aside>
    </section>
  );
}

function ReviewView({ workspace }: { workspace: Workspace }) {
  const { derived } = workspace;
  const canAnswer = workspace.reviewStage === "answering" || workspace.reviewStage === "self_rating";
  const canSelfRate = workspace.reviewStage === "self_rating";
  const sourceVisible = workspace.reviewStage === "feedback" || workspace.sourceVisibleBeforeAnswer;
  const activeCard = workspace.activeReviewCard ?? derived.activeCard;
  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
      {activeCard ? (
        <ReviewCard
          title={activeCard.question}
          sourceQuote={workspace.revealedSourceQuote || activeCard.sourceQuote}
          sourceVisible={sourceVisible}
          meta={`${activeCard.cardType} · ${activeCard.tags.join(" / ")}`}
        >
          <div className="grid gap-4">
            <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-zinc-600">
              <ReviewStep label="1 信心" active={workspace.reviewStage === "confidence"} done={workspace.reviewStage !== "confidence" && workspace.reviewStage !== "idle"} />
              <ReviewStep label="2 回答" active={workspace.reviewStage === "answering"} done={workspace.reviewStage === "self_rating" || workspace.reviewStage === "feedback"} />
              <ReviewStep label="3 自评" active={workspace.reviewStage === "self_rating"} done={workspace.reviewStage === "feedback"} />
              <ReviewStep label="4 反馈" active={workspace.reviewStage === "feedback"} done={false} />
            </div>
            <Field label="先评信心">
              <ConfidenceSelector value={workspace.confidence} onChange={workspace.chooseConfidence} />
            </Field>
            <Field label="主动回答">
              <TextArea disabled={!canAnswer} value={workspace.answerText} onChange={(event) => workspace.setAnswerText(event.target.value)} placeholder="先回想，再看来源。不要直接复制。" />
            </Field>
            {workspace.reviewStage !== "feedback" && !workspace.sourceVisibleBeforeAnswer ? (
              <SecondaryButton onClick={workspace.markSourceSeenBeforeAnswer}>
                <EyeOff size={16} /> 我需要先看来源
              </SecondaryButton>
            ) : null}
            {workspace.sourceVisibleBeforeAnswer && workspace.reviewStage !== "feedback" ? (
              <InlineError message="本轮已经提前查看来源，完成后会记录为弱提取证据。" />
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="努力程度">
                <ConfidenceSelector value={workspace.effort} onChange={workspace.setEffort} />
              </Field>
              <Field label="错因记录">
                <MistakeReasonSelect value={workspace.mistakeReason} onChange={workspace.setMistakeReason} />
              </Field>
            </div>
            <div className="grid gap-2 md:grid-cols-4">
              <SecondaryButton disabled={!canSelfRate} onClick={() => void workspace.completeReview("again")}>错 A</SecondaryButton>
              <SecondaryButton disabled={!canSelfRate} onClick={() => void workspace.completeReview("partial")}>部分对 P</SecondaryButton>
              <Button disabled={!canSelfRate} onClick={() => void workspace.completeReview("correct")}>对 C</Button>
              <Button disabled={!canSelfRate} onClick={() => void workspace.completeReview("easy")}>轻松 E</Button>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-medium text-emerald-950">{workspace.reviewFeedback}</div>
            {workspace.reviewStage === "feedback" ? <SecondaryButton onClick={workspace.startNextReview}>进入下一张 N</SecondaryButton> : null}
          </div>
        </ReviewCard>
      ) : (
        <EmptyState title="没有可复习卡片" detail="先在资料库生成并批准候选题，复习队列会自动出现。" action={<TextLink href="/library">去资料库</TextLink>} />
      )}
      <Panel>
        <h3 className="text-2xl font-semibold tracking-[-0.02em]">队列与错误</h3>
        <div className="mt-4 grid gap-3">
          {derived.reviewQueue.slice(0, 6).map((item) => (
            <DocumentCard key={item.card.id} title={item.card.question} detail={`${item.source?.title ?? "来源缺失，需要修复"} · ${item.reason}`} meta={item.card.dueAt.slice(0, 10)} status={item.urgency} href={item.source ? `/library/${item.source.id}` : "/review"} />
          ))}
          <div className="rounded-2xl bg-rose-50 p-4 text-sm leading-6 text-rose-950">
            <p className="font-semibold">高信心错误修复</p>
            <p className="mt-1">未解决 {derived.repairTaskSummary.unresolvedCount} 个，进行中 {derived.repairTaskSummary.inProgressCount} 个。</p>
            <TextLink href="/review/mistakes">进入修复任务</TextLink>
          </div>
        </div>
      </Panel>
    </section>
  );
}

function ReviewStep({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <div className={active ? "rounded-xl bg-emerald-950 px-3 py-2 text-white" : done ? "rounded-xl bg-emerald-50 px-3 py-2 text-emerald-800" : "rounded-xl bg-zinc-50 px-3 py-2 text-zinc-500"}>
      {label}
    </div>
  );
}

function MistakesView({ workspace }: { workspace: Workspace }) {
  const [statusFilter, setStatusFilter] = useState<RepairTask["status"] | "all">("all");
  const [reasonFilter, setReasonFilter] = useState<MistakeReason | "all">("all");
  const { state, derived } = workspace;
  const cardById = new Map(state.cards.map((card) => [card.id, card]));
  const sourceById = new Map(state.sources.map((source) => [source.id, source]));
  const logById = new Map(state.logs.map((log) => [log.id, log]));
  const tasks = state.repairTasks
    .filter((task) => statusFilter === "all" || task.status === statusFilter)
    .filter((task) => reasonFilter === "all" || task.reason === reasonFilter)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <div className="grid gap-5">
        <StatStrip
          items={[
            { label: "未解决", value: String(derived.repairTaskSummary.unresolvedCount), detail: "open + in progress", tone: derived.repairTaskSummary.unresolvedCount ? "danger" : "good" },
            { label: "进行中", value: String(derived.repairTaskSummary.inProgressCount), detail: "已进入修复", tone: "warn" },
            { label: "本周新增", value: String(derived.repairTaskSummary.createdThisWeek), detail: "高信心错误任务" },
            { label: "本周关闭", value: String(derived.repairTaskSummary.resolvedThisWeek), detail: "已解决或忽略", tone: "good" }
          ]}
        />
        <Panel>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-2xl font-semibold tracking-[-0.02em]">修复任务</h3>
              <p className="mt-1 text-sm leading-6 text-zinc-600">这些任务来自信心 4-5 但结果为错或部分对的复习记录。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select className="rounded-xl border border-zinc-200 bg-white/90 px-3 py-2 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as RepairTask["status"] | "all")}>
                <option value="open">open</option>
                <option value="in_progress">in progress</option>
                <option value="resolved">resolved</option>
                <option value="dismissed">dismissed</option>
                <option value="all">all</option>
              </select>
              <select className="rounded-xl border border-zinc-200 bg-white/90 px-3 py-2 text-sm" value={reasonFilter} onChange={(event) => setReasonFilter(event.target.value as MistakeReason | "all")}>
                <option value="all">全部错因</option>
                <option value="unknown">unknown</option>
                <option value="not_retrieved">not retrieved</option>
                <option value="confused_concepts">confused concepts</option>
                <option value="weak_mechanism">weak mechanism</option>
                <option value="missed_boundary">missed boundary</option>
                <option value="bad_card">bad card</option>
                <option value="source_gap">source gap</option>
              </select>
            </div>
          </div>
          <div className="mt-5 grid gap-3">
            {tasks.length === 0 ? <EmptyState title="没有匹配的修复任务" detail="完成一次高信心答错或部分对的复习后，这里会出现可追踪任务。" /> : null}
            {tasks.map((task) => {
              const card = cardById.get(task.cardId);
              const source = sourceById.get(task.sourceId);
              const log = logById.get(task.reviewLogId);
              return (
                <article key={task.id} className="rounded-[1.25rem] border border-white/70 bg-white/78 p-4 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <Badge className={task.status === "open" ? "border-rose-200 bg-rose-50 text-rose-800" : undefined}>{task.status}</Badge>
                        <Badge>信心 {task.confidence}</Badge>
                        <Badge>{task.reason}</Badge>
                      </div>
                      <h4 className="mt-3 break-words text-lg font-semibold tracking-[-0.01em] text-zinc-950">{card?.question ?? "卡片缺失"}</h4>
                      <p className="mt-1 text-sm text-zinc-600">{source?.title ?? "来源缺失，需要修复"} · {task.createdAt.slice(0, 10)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <TextLink href={`/library/${task.sourceId}`}>查看来源</TextLink>
                      <TextLink href={`/explain?repairTaskId=${task.id}`}>用费曼复盘</TextLink>
                    </div>
                  </div>
                  <EvidenceCard quote={card?.sourceQuote ?? "来源片段缺失。"} className="mt-4" />
                  <p className="mt-3 text-sm leading-6 text-zinc-600">结果 {task.outcome}，证据 {log?.evidenceStrength ?? "unknown"}。修复动作完成不等于已经掌握，只表示你处理过这个盲区。</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <SecondaryButton onClick={() => void workspace.createRemedialCandidateForTask(task.id)}>
                      <RefreshCw size={16} /> 生成补救卡
                    </SecondaryButton>
                    <Button onClick={() => void workspace.updateRepairTask(task.id, "resolved", "explained")}>
                      <Check size={16} /> 标记已解决
                    </Button>
                    <SecondaryButton onClick={() => void workspace.updateRepairTask(task.id, "dismissed", "dismissed_not_actionable")}>
                      <X size={16} /> 忽略
                    </SecondaryButton>
                  </div>
                </article>
              );
            })}
          </div>
        </Panel>
      </div>
      <aside className="grid gap-5 content-start">
        <Panel>
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-rose-600" />
            <h3 className="text-xl font-semibold tracking-[-0.02em]">错因分布</h3>
          </div>
          <div className="mt-4 grid gap-2">
            {derived.repairTaskSummary.byReason.length === 0 ? <p className="text-sm text-zinc-500">证据不足。</p> : null}
            {derived.repairTaskSummary.byReason.map((item) => <RepairSummaryLine key={item.label} label={item.label} count={item.count} />)}
          </div>
        </Panel>
        <Panel>
          <h3 className="text-xl font-semibold tracking-[-0.02em]">薄弱 tag</h3>
          <div className="mt-4 grid gap-2">
            {derived.repairTaskSummary.byTag.length === 0 ? <p className="text-sm text-zinc-500">证据不足。</p> : null}
            {derived.repairTaskSummary.byTag.map((item) => <RepairSummaryLine key={item.label} label={item.label} count={item.count} />)}
          </div>
        </Panel>
      </aside>
    </section>
  );
}

function RepairSummaryLine({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
      <span className="break-words">{label}</span>
      <span className="font-mono font-semibold tabular-nums">{count}</span>
    </div>
  );
}

function ExplainView({ workspace }: { workspace: Workspace }) {
  const [fromConcept, setFromConcept] = useState("间隔效应");
  const [toConcept, setToConcept] = useState("主动提取");
  const [relation, setRelation] = useState<ConceptRelationType>("causal");
  const [edgeEvidence, setEdgeEvidence] = useState("用一句话说明这条连接的证据。");
  const { state, derived } = workspace;

  useEffect(() => {
    const rawDraft = window.sessionStorage.getItem("metalearn-explain-draft");
    if (!rawDraft) return;
    try {
      const draft = JSON.parse(rawDraft) as { concept?: string; quote?: string; explanation?: string };
      if (draft.concept) workspace.setConcept(draft.concept);
      if (draft.quote) workspace.setExplainQuote(draft.quote);
      if (draft.explanation) workspace.setExplanation(draft.explanation);
    } finally {
      window.sessionStorage.removeItem("metalearn-explain-draft");
    }
  }, [workspace]);

  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_410px]">
      <Panel>
        <h3 className="text-2xl font-semibold tracking-[-0.02em]">解释工作台</h3>
        {workspace.activeRepairTaskId ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
            当前正在处理高信心错误修复任务。保存解释或生成候选卡会写回任务记录。
          </div>
        ) : null}
        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_220px]">
          <Field label="概念">
            <TextInput value={workspace.concept} onChange={(event) => workspace.setConcept(event.target.value)} />
          </Field>
          <Field label="模板">
            <TemplateSelect value={workspace.templateId} onChange={workspace.setTemplateId} />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="你的解释">
            <TextArea className="min-h-52" value={workspace.explanation} onChange={(event) => workspace.setExplanation(event.target.value)} />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="可选来源片段">
            <TextArea value={workspace.explainQuote} onChange={(event) => workspace.setExplainQuote(event.target.value)} />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => void workspace.askSocraticQuestions()}>
            <HelpCircle size={16} /> 生成 3 个追问
          </Button>
          <SecondaryButton onClick={() => void workspace.saveExplanation()}>
            <Save size={16} /> 保存解释版本
          </SecondaryButton>
          <SecondaryButton onClick={() => void workspace.handoffExplanation()}>
            <Send size={16} /> 从漏洞生成卡片
          </SecondaryButton>
        </div>
      </Panel>
      <Panel>
        <h3 className="text-2xl font-semibold tracking-[-0.02em]">追问与 rubric</h3>
        <div className="mt-4 grid gap-3">
          {workspace.questions.length === 0 ? <EmptyState title="还没有追问" detail="AI 只提出问题，不给标准答案。你需要自己补上机制、例子和边界。" /> : null}
          {workspace.questions.map((question, index) => (
            <div key={question} className="rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
              <span className="font-mono text-xs font-semibold text-emerald-700">Q{index + 1}</span> {question}
            </div>
          ))}
          {workspace.rubricScores ? Object.entries(workspace.rubricScores).map(([key, value]) => <ProgressRing key={key} value={value / 5} label={rubricLabel(key)} />) : null}
          {derived.metrics.rubricImprovement ? <Badge>追问后补全率 +{derived.metrics.rubricImprovement.toFixed(1)}</Badge> : null}
        </div>
      </Panel>
      <Panel>
        <h3 className="text-2xl font-semibold tracking-[-0.02em]">解释版本</h3>
        <div className="mt-4 grid gap-3">
          {state.explanations.length === 0 ? <EmptyState title="还没有解释版本" detail="保存 v1 后，再根据追问修订 v2。版本变化本身就是理解证据。" /> : null}
          {state.explanations.slice(0, 6).map((attempt: ExplanationAttempt) => (
            <DocumentCard key={attempt.id} title={`${attempt.concept} · v${attempt.versionIndex ?? 1}`} detail={attempt.explanation} meta={attempt.gapTags?.join(" / ") || "rubric"} status={String(scoreAverage(attempt.rubricScores).toFixed(1))} href="/explain" />
          ))}
        </div>
      </Panel>
      <Panel>
        <h3 className="text-2xl font-semibold tracking-[-0.02em]">最小概念图</h3>
        <div className="mt-4 grid gap-3">
          <div className="flex flex-wrap gap-2">
            {state.conceptNodes.slice(0, 10).map((node) => <Badge key={node.id}>{node.label}</Badge>)}
            {state.conceptNodes.length === 0 ? <span className="text-sm text-zinc-500">保存材料或解释后会出现概念节点。</span> : null}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <TextInput value={fromConcept} onChange={(event) => setFromConcept(event.target.value)} />
            <TextInput value={toConcept} onChange={(event) => setToConcept(event.target.value)} />
          </div>
          <select className="min-h-11 rounded-xl border border-zinc-200 bg-white/90 px-3 py-2 text-sm" value={relation} onChange={(event) => setRelation(event.target.value as ConceptRelationType)}>
            <option value="related">关联</option>
            <option value="contrast">对比</option>
            <option value="causal">因果</option>
            <option value="exception">例外</option>
          </select>
          <TextArea value={edgeEvidence} onChange={(event) => setEdgeEvidence(event.target.value)} />
          <Button onClick={() => void workspace.addConceptEdge(fromConcept, toConcept, relation, edgeEvidence)}>
            <Link2 size={16} /> 确认连接
          </Button>
          {state.conceptEdges.slice(0, 4).map((edge) => (
            <div key={edge.id} className="rounded-2xl bg-white/70 p-3 text-sm text-zinc-700">{edge.relation} · {edge.evidence}</div>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function CompassView({ workspace }: { workspace: Workspace }) {
  const { derived, state } = workspace;
  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
      <Panel>
        <h3 className="text-2xl font-semibold tracking-[-0.02em]">60 秒计划与 2 分钟反思</h3>
        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_180px_180px]">
          <Field label="会话标题">
            <TextInput value={workspace.sessionTitle} onChange={(event) => workspace.setSessionTitle(event.target.value)} />
          </Field>
          <Field label="模板">
            <TemplateSelect value={workspace.templateId} onChange={workspace.setTemplateId} />
          </Field>
          <Field label="check-in 频率">
            <CheckInIntervalSelect value={workspace.checkInIntervalMinutes} onChange={workspace.setCheckInIntervalMinutes} />
          </Field>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="目标">
            <TextArea value={workspace.goal} onChange={(event) => workspace.setGoal(event.target.value)} />
          </Field>
          <Field label="策略">
            <TextArea value={workspace.strategy} onChange={(event) => workspace.setStrategy(event.target.value)} />
          </Field>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-[180px_1fr]">
          <Field label="预测分钟">
            <TextInput type="number" value={workspace.predictedMinutes} onChange={(event) => workspace.setPredictedMinutes(Number(event.target.value))} />
          </Field>
          <div className="rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">{derived.dailyPlan.nextBestAction}</div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="顺利">
            <TextArea value={workspace.reflectionWorked} onChange={(event) => workspace.setReflectionWorked(event.target.value)} />
          </Field>
          <Field label="卡壳">
            <TextArea value={workspace.reflectionStuck} onChange={(event) => workspace.setReflectionStuck(event.target.value)} />
          </Field>
          <Field label="下次调整">
            <TextArea value={workspace.reflectionNext} onChange={(event) => workspace.setReflectionNext(event.target.value)} />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => void workspace.saveSession()}>
            <ClipboardCheck size={16} /> 保存计划与反思
          </Button>
        </div>
      </Panel>
      <Panel>
        <h3 className="text-2xl font-semibold tracking-[-0.02em]">轻量 check-in</h3>
        <div className="mt-4 grid gap-3">
          <Field label="当前状态">
            <FocusStateSelect value={workspace.checkInFocusState} onChange={workspace.setCheckInFocusState} />
          </Field>
          <Field label="理解程度">
            <ConfidenceSelector value={workspace.checkInUnderstanding} onChange={workspace.setCheckInUnderstanding} />
          </Field>
          <Button onClick={() => void workspace.recordCheckIn()}>记录 check-in</Button>
          <p className="text-sm text-zinc-500">默认关闭或低频，避免元认知工具反过来打断学习。</p>
          <p className="text-sm font-semibold text-zinc-950">最近反思</p>
          {state.reflections.length === 0 ? <EmptyState title="还没有反思" detail="反思只保留一个具体调整，避免元认知开销过高。" /> : null}
          {state.reflections.slice(0, 4).map((reflection) => (
            <div key={reflection.id} className="rounded-2xl bg-white/70 p-4 text-sm leading-6 text-zinc-700">
              <p className="font-semibold text-zinc-950">{reflection.nextChange}</p>
              <p className="mt-2">卡壳：{reflection.stuck}</p>
            </div>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function InsightsView({ workspace }: { workspace: Workspace }) {
  const { derived, state } = workspace;
  const buckets = buildCalibrationBuckets(state.logs);
  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_390px]">
      <Panel>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-2xl font-semibold tracking-[-0.02em]">校准报告</h3>
            <p className="mt-1 text-sm text-zinc-600">指标衡量过程，不承诺智力提升。证据不足时会明确显示。</p>
          </div>
          <Button onClick={() => void workspace.saveInsight()}>
            <Gauge size={16} /> 保存快照
          </Button>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <ProgressRing value={Math.max(0, 1 - derived.insight.brierScore)} label={`Brier ${derived.insight.brierScore.toFixed(3)}`} />
          <ProgressRing value={1 - Math.max(0, derived.insight.overconfidenceIndex)} label={`过度自信 ${Math.round(derived.insight.overconfidenceIndex * 100)}%`} />
          <ProgressRing value={1 - derived.insight.highConfidenceErrorRate} label={`高信心错误 ${Math.round(derived.insight.highConfidenceErrorRate * 100)}%`} />
          <ProgressRing value={1 - derived.insight.passiveLearningRisk} label={`被动学习风险 ${Math.round(derived.insight.passiveLearningRisk * 100)}%`} />
        </div>
        <div className="mt-6 rounded-2xl border border-rose-100 bg-rose-50/70 p-4 text-sm leading-6 text-rose-950">
          <p className="font-semibold">未解决高信心错误任务：{derived.repairTaskSummary.unresolvedCount}</p>
          <p className="mt-1">任务关闭只表示修复动作完成，不表示系统判定你已经掌握。</p>
          {derived.repairTaskSummary.unresolvedCount > 0 ? <TextLink href="/review/mistakes">查看修复任务</TextLink> : <span className="text-rose-800">当前没有待修复任务。</span>}
        </div>
        <div className="mt-6 grid gap-3">
          {buckets.map((bucket) => (
            <div key={bucket.confidence}>
              <div className="flex justify-between text-xs text-zinc-500">
                <span>信心 {bucket.confidence}</span>
                <span>期望 {Math.round(bucket.expected * 100)}% / 实际 {Math.round(bucket.actual * 100)}% / {bucket.count} 次</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-zinc-200">
                <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${Math.max(4, bucket.actual * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel>
        <h3 className="text-2xl font-semibold tracking-[-0.02em]">周报草稿</h3>
        <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">{derived.insight.recommendation}</div>
        <div className="mt-5 grid gap-3">
          <p className="text-sm font-semibold text-zinc-950">预测 vs 实际偏差</p>
          <Badge>{Math.round(derived.insight.predictionBias * 100)}%</Badge>
          <p className="text-sm font-semibold text-zinc-950">薄弱标签</p>
          <div className="flex flex-wrap gap-2">
            {derived.insight.weakTags.length === 0 ? <span className="text-sm text-zinc-500">证据不足</span> : null}
            {derived.insight.weakTags.map((tag) => <Badge key={tag}>{tag}</Badge>)}
          </div>
          <p className="text-sm font-semibold text-zinc-950">tag 级过度自信</p>
          {derived.tagOverconfidence.length === 0 ? <span className="text-sm text-zinc-500">证据不足</span> : null}
          {derived.tagOverconfidence.map((item) => <div key={item.tag} className="rounded-2xl bg-white/70 p-3 text-sm text-zinc-700">{item.tag}: {Math.round(item.overconfidence * 100)}% · {item.count} 次</div>)}
          <p className="text-sm font-semibold text-zinc-950">解释漏洞类型</p>
          <div className="flex flex-wrap gap-2">
            {derived.explanationGapTags.length === 0 ? <span className="text-sm text-zinc-500">证据不足</span> : null}
            {derived.explanationGapTags.map((tag) => <Badge key={tag}>{rubricLabel(tag)}</Badge>)}
          </div>
          <p className="text-sm font-semibold text-zinc-950">高信心错误错因</p>
          {derived.repairTaskSummary.byReason.length === 0 ? <span className="text-sm text-zinc-500">证据不足</span> : null}
          {derived.repairTaskSummary.byReason.map((item) => <div key={item.label} className="rounded-2xl bg-white/70 p-3 text-sm text-zinc-700">{item.label}: {item.count} 个未解决</div>)}
        </div>
      </Panel>
    </section>
  );
}

function SettingsView({ workspace }: { workspace: Workspace }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
      <Panel>
        <h3 className="text-2xl font-semibold tracking-[-0.02em]">AI provider</h3>
        <p className="mt-1 text-sm text-zinc-600">第一版仍使用 local mock。真实 provider 接入时，上传前必须预览将发送的 chunk。</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Provider">
            <TextInput value={workspace.providerName} onChange={(event) => workspace.setProviderName(event.target.value)} />
          </Field>
          <Field label="Model">
            <TextInput value={workspace.modelName} onChange={(event) => workspace.setModelName(event.target.value)} />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => void workspace.saveAIConfig()}>
            <Save size={16} /> 保存设置
          </Button>
          <SecondaryButton onClick={workspace.exportJson}>
            <Download size={16} /> 导出全部数据
          </SecondaryButton>
        </div>
      </Panel>
      <Panel>
        <h3 className="text-2xl font-semibold tracking-[-0.02em]">隐私中心</h3>
        <div className="mt-4 grid gap-3 text-sm leading-6 text-zinc-700">
          <PrivacyLine icon={<Lock size={16} />} text="默认本地 IndexedDB 保存。" />
          <PrivacyLine icon={<EyeOff size={16} />} text="未点击 AI 操作前不上传材料。" />
          <PrivacyLine icon={<FileText size={16} />} text="所有候选题必须保留来源片段。" />
          <PrivacyLine icon={<Brain size={16} />} text={`当前模式：${workspace.state.aiConfigs[0]?.mode ?? "local_mock"}`} />
        </div>
        <div className="mt-5 grid gap-2">
          {!confirmDelete ? (
            <SecondaryButton onClick={() => setConfirmDelete(true)}>
              <Trash2 size={16} /> 准备删除本地数据
            </SecondaryButton>
          ) : (
            <Button className="!border-rose-900 !bg-rose-900" onClick={() => void workspace.resetLocalData()}>
              <Trash2 size={16} /> 确认删除
            </Button>
          )}
          <p className="text-xs text-zinc-500">删除后 IndexedDB 数据表会清空。建议先导出。</p>
        </div>
      </Panel>
    </section>
  );
}

function ManualCardPanel({ workspace }: { workspace: Workspace }) {
  const form = workspace.manualCardForm;
  const source = workspace.state.sources.find((item) => item.id === form.sourceId);
  const chunks = workspace.state.chunks.filter((chunk) => chunk.sourceId === form.sourceId).sort((left, right) => left.index - right.index);
  if (!form.isOpen || !source) return null;
  return (
    <div className="mt-5 rounded-[1.25rem] border border-emerald-200 bg-emerald-50/55 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Badge>手工候选题</Badge>
          <h4 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-zinc-950">从来源证据建卡</h4>
          <p className="mt-1 text-sm leading-6 text-zinc-600">不调用 AI。保存后先进入候选题审核台，批准后才会进入复习队列。</p>
        </div>
        <SecondaryButton onClick={workspace.resetManualCardForm}>
          <X size={16} /> 取消
        </SecondaryButton>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_170px_150px]">
        <Field label="来源片段">
          <select
            className="min-h-11 min-w-0 rounded-xl border border-zinc-200 bg-white/90 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            value={form.sourceChunkId}
            onChange={(event) => void workspace.selectManualCardChunk(event.target.value)}
          >
            {chunks.map((chunk) => (
              <option key={chunk.id} value={chunk.id}>片段 #{chunk.index + 1}</option>
            ))}
          </select>
        </Field>
        <Field label="题型">
          <CardTypeSelect value={form.cardType} onChange={(value) => workspace.updateManualCardForm({ cardType: value, tagsText: syncTagsText(form.tagsText, value) })} />
        </Field>
        <Field label="难度">
          <DifficultySelect value={form.difficulty} onChange={(difficulty) => workspace.updateManualCardForm({ difficulty })} />
        </Field>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="问题">
          <TextInput value={form.question} onChange={(event) => workspace.updateManualCardForm({ question: event.target.value })} placeholder="用自己的话提出一个可提取问题" />
        </Field>
        <Field label="标签">
          <TextInput value={form.tagsText} onChange={(event) => workspace.updateManualCardForm({ tagsText: event.target.value })} placeholder="course, mechanism" />
        </Field>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="预期答案">
          <TextArea value={form.expectedAnswer} onChange={(event) => workspace.updateManualCardForm({ expectedAnswer: event.target.value })} />
        </Field>
        <Field label="来源摘录" hint="可以缩短，但必须来自所选片段。">
          <TextArea value={form.sourceQuote} onChange={(event) => workspace.updateManualCardForm({ sourceQuote: event.target.value })} />
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => void workspace.saveManualCandidate()}>
          <Save size={16} /> 保存候选题
        </Button>
        <TextLink href={`/library/${source.id}`}>查看材料工作台</TextLink>
      </div>
    </div>
  );
}

function CandidateEditor({ candidate, workspace, highlighted = false }: { candidate: CardCandidate; workspace: Workspace; highlighted?: boolean }) {
  const validation = validateCardCandidateEvidence(candidate, workspace.state.chunks);
  const chunk = validation.chunk ?? workspace.state.chunks.find((item) => item.id === candidate.sourceChunkId);
  const source = chunk ? workspace.state.sources.find((item) => item.id === chunk.sourceId) : undefined;
  return (
    <article className={`min-w-0 rounded-[1.25rem] p-4 shadow-sm ${highlighted ? "border border-emerald-200 bg-emerald-50/80" : "bg-white/75"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{candidate.cardType}</Badge>
        {highlighted ? <Badge>最近生成</Badge> : null}
        <span className="text-xs text-zinc-500">难度 {candidate.difficulty}</span>
        <span className="text-xs text-zinc-500">{source ? `${source.title} · 片段 #${(chunk?.index ?? 0) + 1}` : "来源缺失，需要修复"}</span>
      </div>
      <div className="mt-3 grid gap-3">
        <TextInput value={candidate.question} onChange={(event) => void workspace.updateCandidate(candidate, { question: event.target.value })} />
        <TextArea value={candidate.expectedAnswer} onChange={(event) => void workspace.updateCandidate(candidate, { expectedAnswer: event.target.value })} />
        <TextArea value={candidate.sourceQuote} onChange={(event) => void workspace.updateCandidate(candidate, { sourceQuote: event.target.value })} />
        {validation.ok ? (
          <EvidenceCard label={`来源证据${chunk ? ` · 片段 #${chunk.index + 1}` : ""}`} quote={candidate.sourceQuote} />
        ) : (
          <InlineError message={validation.reason ?? "来源证据无效。"} />
        )}
        <div className="flex flex-wrap gap-2">
          <Button disabled={!validation.ok} onClick={() => void workspace.approveCandidate(candidate)}>
            <Check size={16} /> 批准进入复习
          </Button>
          <SecondaryButton onClick={() => void workspace.rejectCandidate(candidate)}>
            <X size={16} /> 拒绝
          </SecondaryButton>
          {source ? <TextLink href={`/library/${source.id}`}>回到材料</TextLink> : null}
        </div>
      </div>
    </article>
  );
}

function ApprovedCardEvidence({ card, chunks }: { card: Card; chunks: SourceChunk[] }) {
  const chunk = chunks.find((item) => item.id === card.sourceChunkId);
  return (
    <article className="min-w-0 rounded-[1.25rem] bg-white/75 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{card.cardType}</Badge>
        <span className="text-xs text-zinc-500">reps {card.fsrs.reps}</span>
        <span className="text-xs text-zinc-500">due {formatDate(card.dueAt)}</span>
      </div>
      <h4 className="mt-3 break-words text-base font-semibold text-zinc-950">{card.question}</h4>
      <p className="mt-2 break-words text-sm leading-6 text-zinc-600">{card.expectedAnswer}</p>
      <EvidenceCard className="mt-3" label={chunk ? `来源证据 · 片段 #${chunk.index + 1}` : "来源缺失，需要修复"} quote={card.sourceQuote} />
      <div className="mt-3 flex flex-wrap gap-2">
        {card.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}
      </div>
    </article>
  );
}

function MaterialStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-zinc-50 p-4">
      <p className="text-xs font-semibold tracking-[0.08em] text-zinc-500">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-zinc-950">{value}</p>
    </div>
  );
}

function SectionHeader({ title, detail }: { title: string; detail: string }) {
  return (
    <div>
      <h3 className="text-2xl font-semibold tracking-[-0.02em] text-zinc-950">{title}</h3>
      <p className="mt-1 max-w-[72ch] text-sm leading-6 text-zinc-600">{detail}</p>
    </div>
  );
}

function EvidenceHealthLine({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "danger" }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-50 p-3">
      <span>{label}</span>
      <span className={tone === "danger" ? "font-mono font-semibold text-rose-700" : "font-mono font-semibold text-zinc-950"}>{value}</span>
    </div>
  );
}

function MaterialStatusFlow({ sources }: { sources: SourceDocument[] }) {
  const latest = sources[0];
  const steps = ["new", "chunked", "candidates", "reviewing", "explaining", "archived"];
  const active = latest?.status ?? "new";
  return (
    <div className="mt-5 rounded-2xl bg-zinc-50 p-4">
      <p className="text-sm font-semibold text-zinc-950">材料状态流</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {steps.map((step) => <Badge key={step} className={step === active ? "border-emerald-700 bg-emerald-100 text-emerald-950" : "border-zinc-200 bg-white text-zinc-500"}>{step}</Badge>)}
      </div>
    </div>
  );
}

function stageLabel(stage: MaterialImportDraft["stage"]): string {
  const labels: Record<MaterialImportDraft["stage"], string> = {
    idle: "未开始",
    file_reading: "读取文件",
    text_ready: "文本已读取，未入库",
    saving_source: "保存材料中",
    source_saved: "材料已入库",
    preview_ready: "上传预览待确认",
    generating_candidates: "生成候选题中",
    candidates_ready: "候选题已生成",
    failed: "流程失败"
  };
  return labels[stage];
}

function chunkStatusLabel(status: ChunkEvidenceSummary["status"]) {
  const labels: Record<ChunkEvidenceSummary["status"], string> = {
    uncovered: "未覆盖",
    candidate: "有候选题",
    carded: "已成卡",
    reviewed: "已复习"
  };
  return labels[status];
}

function chunkCoverageClass(status: ChunkEvidenceSummary["status"], active: boolean) {
  const base = active ? "ring-2 ring-emerald-700 " : "";
  const classes: Record<ChunkEvidenceSummary["status"], string> = {
    uncovered: "border-zinc-200 bg-white text-zinc-500",
    candidate: "border-amber-200 bg-amber-100 text-amber-900",
    carded: "border-emerald-200 bg-emerald-100 text-emerald-900",
    reviewed: "border-emerald-700 bg-emerald-800 text-white"
  };
  return `${base}${classes[status]}`;
}

function openChunkInExplain(source: SourceDocument, chunk: SourceChunk) {
  window.sessionStorage.setItem(
    "metalearn-explain-draft",
    JSON.stringify({
      concept: source.title,
      quote: buildChunkSourceQuote(chunk),
      explanation: "请根据这个来源片段，用自己的话解释概念、机制、例子和边界。"
    })
  );
  window.location.href = "/explain";
}

function buildChunkSourceQuote(chunk: SourceChunk): string {
  return chunk.text.replace(/\s+/g, " ").trim().slice(0, 260);
}

function nextActionLabel(action: CandidateGenerationDiagnostic["nextAction"]): string {
  const labels: Record<CandidateGenerationDiagnostic["nextAction"], string> = {
    read_file: "选择 PDF / TXT / Markdown，或粘贴一段真实材料。",
    save_source: "点击“保存并生成候选题”或“仅保存到资料库”，先把文本写入本地资料库。",
    create_preview: "点击“生成候选题”，创建上传预览。",
    confirm_preview: "检查上传预览后点击“确认发送并生成候选题”。",
    review_candidates: "到下方候选题审核台编辑、拒绝或批准候选题。",
    manual_card: "改为从来源片段手工建卡，避免卡在 AI 生成步骤。"
  };
  return labels[action];
}

function TemplateSelect({ value, onChange }: { value: LearningTemplateId; onChange: (value: LearningTemplateId) => void }) {
  return (
    <select className="min-h-11 rounded-xl border border-zinc-200 bg-white/90 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" value={value} onChange={(event) => onChange(event.target.value as LearningTemplateId)}>
      {learningTemplates.map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}
    </select>
  );
}

function InputTypeSelect({ value, onChange }: { value: SourceInputType; onChange: (value: SourceInputType) => void }) {
  return (
    <select className="min-h-11 rounded-xl border border-zinc-200 bg-white/90 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" value={value} onChange={(event) => onChange(event.target.value as SourceInputType)}>
      <option value="plain_text">纯文本</option>
      <option value="markdown">Markdown</option>
      <option value="pdf_text">PDF 文本层</option>
    </select>
  );
}

function CardTypeSelect({ value, onChange }: { value: CardType; onChange: (value: CardType) => void }) {
  return (
    <select className="min-h-11 rounded-xl border border-zinc-200 bg-white/90 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" value={value} onChange={(event) => onChange(event.target.value as CardType)}>
      <option value="definition">定义</option>
      <option value="mechanism">机制</option>
      <option value="comparison">比较</option>
      <option value="application">应用</option>
      <option value="counterexample">反例</option>
      <option value="experiment">实验</option>
      <option value="cloze">填空</option>
    </select>
  );
}

function DifficultySelect({ value, onChange }: { value: 1 | 2 | 3 | 4 | 5; onChange: (value: 1 | 2 | 3 | 4 | 5) => void }) {
  return (
    <select className="min-h-11 rounded-xl border border-zinc-200 bg-white/90 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" value={value} onChange={(event) => onChange(Number(event.target.value) as 1 | 2 | 3 | 4 | 5)}>
      <option value={1}>1 · 很易</option>
      <option value={2}>2 · 较易</option>
      <option value={3}>3 · 中等</option>
      <option value={4}>4 · 较难</option>
      <option value={5}>5 · 很难</option>
    </select>
  );
}

function MistakeReasonSelect({ value, onChange }: { value: MistakeReason; onChange: (value: MistakeReason) => void }) {
  return (
    <select className="min-h-11 rounded-xl border border-zinc-200 bg-white/90 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" value={value} onChange={(event) => onChange(event.target.value as MistakeReason)}>
      <option value="unknown">暂不确定</option>
      <option value="not_retrieved">想不起来</option>
      <option value="confused_concepts">概念混淆</option>
      <option value="weak_mechanism">机制不清</option>
      <option value="missed_boundary">边界遗漏</option>
      <option value="bad_card">题目质量差</option>
      <option value="source_gap">来源没读懂</option>
    </select>
  );
}

function CheckInIntervalSelect({ value, onChange }: { value: 0 | 10 | 20 | 30; onChange: (value: 0 | 10 | 20 | 30) => void }) {
  return (
    <select className="min-h-11 rounded-xl border border-zinc-200 bg-white/90 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" value={value} onChange={(event) => onChange(Number(event.target.value) as 0 | 10 | 20 | 30)}>
      <option value={0}>关闭</option>
      <option value={10}>10 分钟</option>
      <option value={20}>20 分钟</option>
      <option value={30}>30 分钟</option>
    </select>
  );
}

function FocusStateSelect({ value, onChange }: { value: CheckInFocusState; onChange: (value: CheckInFocusState) => void }) {
  return (
    <select className="min-h-11 rounded-xl border border-zinc-200 bg-white/90 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" value={value} onChange={(event) => onChange(event.target.value as CheckInFocusState)}>
      <option value="focused">专注</option>
      <option value="wandering">走神</option>
      <option value="stuck">卡住</option>
      <option value="passive">被动重读</option>
    </select>
  );
}

function TaskPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3 text-sm">
      <span className="text-emerald-50">{label}</span>
      <span className="font-mono text-lg font-semibold">{value}</span>
    </div>
  );
}

function PrivacyLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-zinc-50 p-3">
      <span className="text-emerald-700">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function rubricLabel(key: string): string {
  const labels: Record<string, string> = {
    clarity: "清晰度",
    mechanism: "机制",
    example: "例子",
    boundary: "边界",
    contrast: "区分",
    needs_questions: "需要追问"
  };
  return labels[key] ?? key;
}

function scoreAverage(scores: ExplanationAttempt["rubricScores"]): number {
  const values = Object.values(scores);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatDate(value?: string): string {
  if (!value) return "暂无";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "暂无";
  return date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

function importKindLabel(kind: ImportPreview["kind"]): string {
  if (kind === "full_backup") return "全量备份";
  if (kind === "material_package") return "单材料包";
  return "无法识别";
}

function syncTagsText(current: string, cardType: CardType): string {
  const tags = current.split(/[,\n，]/).map((tag) => tag.trim()).filter(Boolean);
  if (tags.includes(cardType)) return tags.join(", ");
  return [...tags.filter((tag) => !["definition", "mechanism", "comparison", "application", "counterexample", "experiment", "cloze"].includes(tag)), cardType].join(", ");
}
