"use client";

import { useEffect, useState } from "react";
import {
  Archive,
  Brain,
  Check,
  ClipboardCheck,
  Download,
  EyeOff,
  FileText,
  Gauge,
  HelpCircle,
  Link2,
  Lock,
  Save,
  Send,
  Sparkles,
  Trash2,
  Upload,
  X
} from "lucide-react";
import type {
  AIRequestPreview,
  CardCandidate,
  CheckInFocusState,
  ConceptRelationType,
  ExplanationAttempt,
  LearningTemplateId,
  MistakeReason,
  ProductArea,
  ReviewOutcome,
  SourceDocument,
  SourceInputType
} from "@metalearn/core";
import { learningTemplates } from "@metalearn/core";
import { buildCalibrationBuckets } from "@metalearn/learning-science";
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
import { viewMeta } from "./workspace-selectors";

type Workspace = ReturnType<typeof useMetaLearnWorkspace>;

export function MetaLearnOSPage({ view }: { view: ProductArea }) {
  const workspace = useMetaLearnWorkspace();
  const meta = viewMeta[view];
  const { derived, state } = workspace;

  useEffect(() => {
    if (view !== "review") return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      if (["1", "2", "3", "4", "5"].includes(event.key)) {
        workspace.chooseConfidence(Number(event.key) as 1 | 2 | 3 | 4 | 5);
      }
      const outcomeMap: Record<string, ReviewOutcome> = { a: "again", p: "partial", c: "correct", e: "easy" };
      const outcome = outcomeMap[event.key.toLowerCase()];
      if (outcome && workspace.reviewStage === "answer") void workspace.completeReview(outcome);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [view, workspace]);

  const actions = (
    <>
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
        {workspace.error ? <InlineError message={workspace.error} /> : null}
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
        {workspace.aiPreview ? <AIRequestPreviewPanel preview={workspace.aiPreview} onConfirm={workspace.confirmCandidateGeneration} onCancel={workspace.cancelAIRequestPreview} /> : null}
        {view === "home" ? <HomeView workspace={workspace} /> : null}
        {view === "library" ? <LibraryView workspace={workspace} /> : null}
        {view === "review" ? <ReviewView workspace={workspace} /> : null}
        {view === "explain" ? <ExplainView workspace={workspace} /> : null}
        {view === "compass" ? <CompassView workspace={workspace} /> : null}
        {view === "insights" ? <InsightsView workspace={workspace} /> : null}
        {view === "settings" ? <SettingsView workspace={workspace} /> : null}
      </div>
    </ProductShell>
  );
}

function AIRequestPreviewPanel({ preview, onConfirm, onCancel }: { preview: AIRequestPreview; onConfirm: () => Promise<unknown>; onCancel: () => Promise<unknown> }) {
  return (
    <Panel className="border-emerald-200 bg-emerald-50/80">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>上传前预览</Badge>
            <Badge>{preview.providerMode === "local_mock" ? "本地 mock" : preview.providerName}</Badge>
            <Badge>{preview.chunkCount} 个片段</Badge>
          </div>
          <h3 className="mt-3 text-2xl font-semibold tracking-[-0.02em]">将发送哪些内容</h3>
          <p className="mt-2 max-w-[78ch] text-sm leading-6 text-emerald-950">{preview.payloadSummary}</p>
          <p className="mt-2 text-xs text-emerald-800">确认前不会调用 AI。所有输出仍是候选内容，需要你审核。</p>
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
        <div className="flex items-center justify-between gap-3">
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

function LibraryView({ workspace }: { workspace: Workspace }) {
  const { derived, state } = workspace;
  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_430px]">
      <Panel>
        <h3 className="text-2xl font-semibold tracking-[-0.02em]">导入材料</h3>
        <p className="mt-1 text-sm text-zinc-600">支持纯文本、Markdown 和 PDF 文本层粘贴。只有确认 AI 预览后，片段才会进入生成边界。</p>
        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_180px_180px]">
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
        <div className="mt-4">
          <Field label="文本 / Markdown / PDF 提取文本" hint="MVP 不做 OCR；PDF 先粘贴文本层。">
            <TextArea value={workspace.sourceText} onChange={(event) => workspace.setSourceText(event.target.value)} className="min-h-56" />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => void workspace.importSource()}>
            <Upload size={16} /> 保存到资料库
          </Button>
          <SecondaryButton onClick={() => void workspace.prepareCandidateGeneration(state.sources[0])}>
            <Sparkles size={16} /> 为最近材料生成候选题
          </SecondaryButton>
        </div>
        <MaterialStatusFlow sources={state.sources} />
      </Panel>
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
      <Panel className="xl:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-2xl font-semibold tracking-[-0.02em]">候选题审核台</h3>
            <p className="mt-1 text-sm text-zinc-600">候选题必须可编辑、可拒绝、可追溯来源；不会自动进队列。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>{derived.pendingCandidates.length} 待审核</Badge>
            <SecondaryButton onClick={() => void workspace.approveAllCandidates()}>
              <Check size={16} /> 批量批准
            </SecondaryButton>
          </div>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {derived.pendingCandidates.length === 0 ? <EmptyState title="没有候选题" detail="先为一份材料生成候选题。无来源片段的问题会被挡在队列外。" /> : null}
          {derived.pendingCandidates.slice(0, 8).map((candidate: CardCandidate) => (
            <article key={candidate.id} className="rounded-[1.25rem] bg-white/75 p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Badge>{candidate.cardType}</Badge>
                <span className="text-xs text-zinc-500">难度 {candidate.difficulty}</span>
              </div>
              <div className="mt-3 grid gap-3">
                <TextInput value={candidate.question} onChange={(event) => void workspace.updateCandidate(candidate, { question: event.target.value })} />
                <TextArea value={candidate.expectedAnswer} onChange={(event) => void workspace.updateCandidate(candidate, { expectedAnswer: event.target.value })} />
                <EvidenceCard quote={candidate.sourceQuote} />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void workspace.approveCandidate(candidate)}>
                    <Check size={16} /> 批准进入复习
                  </Button>
                  <SecondaryButton onClick={() => void workspace.rejectCandidate(candidate)}>
                    <X size={16} /> 拒绝
                  </SecondaryButton>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function ReviewView({ workspace }: { workspace: Workspace }) {
  const { derived } = workspace;
  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
      {derived.activeCard ? (
        <ReviewCard
          title={derived.activeCard.question}
          sourceQuote={workspace.revealedSourceQuote || derived.activeCard.sourceQuote}
          sourceVisible={workspace.reviewStage === "feedback"}
          meta={`${derived.activeCard.cardType} · ${derived.activeCard.tags.join(" / ")}`}
        >
          <div className="grid gap-4">
            <Field label="先评信心">
              <ConfidenceSelector value={workspace.confidence} onChange={workspace.chooseConfidence} />
            </Field>
            <Field label="主动回答">
              <TextArea value={workspace.answerText} onChange={(event) => workspace.setAnswerText(event.target.value)} placeholder="先回想，再看来源。不要直接复制。" />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="努力程度">
                <ConfidenceSelector value={workspace.effort} onChange={workspace.setEffort} />
              </Field>
              <Field label="错因记录">
                <MistakeReasonSelect value={workspace.mistakeReason} onChange={workspace.setMistakeReason} />
              </Field>
            </div>
            <label className="flex items-center gap-2 rounded-2xl bg-zinc-50 p-3 text-sm text-zinc-700">
              <input type="checkbox" checked={workspace.sourceVisibleBeforeAnswer} onChange={(event) => workspace.setSourceVisibleBeforeAnswer(event.target.checked)} />
              回答前已经看过来源。系统会把这次标记为较弱提取证据。
            </label>
            <div className="grid gap-2 md:grid-cols-4">
              <SecondaryButton disabled={workspace.reviewStage === "confidence"} onClick={() => void workspace.completeReview("again")}>错 A</SecondaryButton>
              <SecondaryButton disabled={workspace.reviewStage === "confidence"} onClick={() => void workspace.completeReview("partial")}>部分对 P</SecondaryButton>
              <Button disabled={workspace.reviewStage === "confidence"} onClick={() => void workspace.completeReview("correct")}>对 C</Button>
              <Button disabled={workspace.reviewStage === "confidence"} onClick={() => void workspace.completeReview("easy")}>轻松 E</Button>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-medium text-emerald-950">{workspace.reviewFeedback}</div>
            {workspace.reviewStage === "feedback" ? <SecondaryButton onClick={workspace.startNextReview}>进入下一张</SecondaryButton> : null}
          </div>
        </ReviewCard>
      ) : (
        <EmptyState title="没有可复习卡片" detail="先在资料库生成并批准候选题，复习队列会自动出现。" action={<TextLink href="/library">去资料库</TextLink>} />
      )}
      <Panel>
        <h3 className="text-2xl font-semibold tracking-[-0.02em]">队列与错误</h3>
        <div className="mt-4 grid gap-3">
          {derived.reviewQueue.slice(0, 6).map((item) => (
            <DocumentCard key={item.card.id} title={item.card.question} detail={`${item.source?.title ?? "解释版本或未知来源"} · ${item.reason}`} meta={item.card.dueAt.slice(0, 10)} status={item.urgency} href="/review" />
          ))}
          <p className="mt-2 text-sm font-semibold text-zinc-950">高信心错误工作流</p>
          {derived.highConfidenceErrors.length === 0 ? <p className="text-sm text-zinc-500">暂无高信心错误。</p> : null}
          {derived.highConfidenceErrors.slice(0, 4).map(({ log, card }) => (
            <div key={log.id} className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-950">
              <p className="font-semibold">{card?.question}</p>
              <p className="mt-1">信心 {log.confidence}，结果 {log.outcome}，错因 {log.mistakeReason ?? "未标记"}，证据 {log.evidenceStrength ?? "unknown"}</p>
              <Button className="mt-3" onClick={() => { workspace.setConcept(card?.tags[0] ?? "高信心错误"); window.location.href = "/explain"; }}>
                <HelpCircle size={16} /> 用费曼复盘
              </Button>
            </div>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function ExplainView({ workspace }: { workspace: Workspace }) {
  const [fromConcept, setFromConcept] = useState("间隔效应");
  const [toConcept, setToConcept] = useState("主动提取");
  const [relation, setRelation] = useState<ConceptRelationType>("causal");
  const [edgeEvidence, setEdgeEvidence] = useState("用一句话说明这条连接的证据。");
  const { state, derived } = workspace;
  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_410px]">
      <Panel>
        <h3 className="text-2xl font-semibold tracking-[-0.02em]">解释工作台</h3>
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
