import type {
  AIProviderConfig,
  AIRequestPreview,
  Card,
  CardCandidate,
  CheckIn,
  ConceptEdge,
  ConceptNode,
  ExplanationAttempt,
  InsightSnapshot,
  LearningSession,
  ProductArea,
  Reflection,
  ReviewLog,
  SourceChunk,
  SourceDocument
} from "@metalearn/core";
import {
  buildDailyPlan,
  buildReviewQueue,
  calculateBrierScore,
  calculateHighConfidenceErrorRate,
  calculateMetacognitiveOverhead,
  calculateRubricImprovement,
  calculateTagOverconfidence,
  createInsightSnapshot,
  findHighConfidenceErrors,
  summarizeExplanationGaps
} from "@metalearn/learning-science";
import { buildStudyAssets } from "@metalearn/storage";
import type { ModuleNavItem } from "@metalearn/ui";

export interface WorkspaceState {
  sources: SourceDocument[];
  chunks: SourceChunk[];
  importJobs: import("@metalearn/core").ImportJob[];
  candidates: CardCandidate[];
  cards: Card[];
  logs: ReviewLog[];
  sessions: LearningSession[];
  checkIns: CheckIn[];
  reflections: Reflection[];
  explanations: ExplanationAttempt[];
  conceptNodes: ConceptNode[];
  conceptEdges: ConceptEdge[];
  insights: InsightSnapshot[];
  aiConfigs: AIProviderConfig[];
  aiRequestPreviews: AIRequestPreview[];
}

export const emptyWorkspaceState: WorkspaceState = {
  sources: [],
  chunks: [],
  importJobs: [],
  candidates: [],
  cards: [],
  logs: [],
  sessions: [],
  checkIns: [],
  reflections: [],
  explanations: [],
  conceptNodes: [],
  conceptEdges: [],
  insights: [],
  aiConfigs: [],
  aiRequestPreviews: []
};

export const sampleText =
  "间隔效应说明，分散复习通常比集中复习更有利于长期保持。提取练习要求学习者主动从记忆中取回答案，而不是只重读材料。信心校准关注学习者预测自己会不会答对，并把预测与实际结果比较。高信心错误尤其重要，因为它暴露了熟悉感和真实掌握之间的差距。";

export const viewMeta: Record<ProductArea, { path: string; title: string; subtitle: string }> = {
  home: { path: "/", title: "今天该做什么", subtitle: "一个入口处理资料、提取、解释和校准证据。先做最能改善掌握的一件事。" },
  library: { path: "/library", title: "资料库", subtitle: "所有材料、候选题、卡片和解释版本都从这里进入，不再拆成三个孤立工具。" },
  review: { path: "/review", title: "校准记忆", subtitle: "先预测信心，再主动回答；系统记录你以为会和真的会之间的差距。" },
  explain: { path: "/explain", title: "费曼解释", subtitle: "你负责解释，AI 只追问含糊、机制、例子、边界和区分，不替你给答案。" },
  compass: { path: "/compass", title: "学习罗盘", subtitle: "罗盘不是重型计划表，而是基于真实复习和解释记录的轻量诊断层。" },
  insights: { path: "/insights", title: "洞察报告", subtitle: "用 Brier、过度自信、高信心错误和主动学习比例追踪学习质量。" },
  settings: { path: "/settings", title: "设置与隐私", subtitle: "本地优先、上传前预览、可导出、可删除；AI provider 可逐步切换。" }
};

export function deriveWorkspace(input: { state: WorkspaceState; now: Date; nowMs: number; searchQuery: string }) {
  const { state, now, nowMs, searchQuery } = input;
  const pendingCandidates = state.candidates.filter((candidate) => candidate.status === "candidate");
  const dueCards = state.cards.filter((card) => new Date(card.dueAt).getTime() <= nowMs);
  const activeCard = dueCards[0] ?? state.cards[0];
  const reviewQueue = buildReviewQueue(state.cards, state.sources, now, state.chunks);
  const dailyPlan = buildDailyPlan({
    cards: state.cards,
    candidates: state.candidates,
    logs: state.logs,
    explanations: state.explanations,
    sessions: state.sessions,
    checkIns: state.checkIns,
    now
  });
  const insight = createInsightSnapshot({
    cards: state.cards,
    logs: state.logs,
    sessions: state.sessions,
    reflections: state.reflections,
    explanations: state.explanations,
    checkIns: state.checkIns,
    now
  });
  const highConfidenceErrors = findHighConfidenceErrors(state.cards, state.logs);
  const assets = buildStudyAssets({
    sources: state.sources,
    candidates: state.candidates,
    cards: state.cards,
    explanations: state.explanations
  }).filter((asset) => `${asset.title} ${asset.detail} ${asset.statusLabel}`.toLowerCase().includes(searchQuery.toLowerCase()));
  const tagOverconfidence = calculateTagOverconfidence(state.cards, state.logs);
  const explanationGapTags = summarizeExplanationGaps(state.explanations);
  const latestPreview = state.aiRequestPreviews[0];
  return {
    pendingCandidates,
    dueCards,
    activeCard,
    reviewQueue,
    dailyPlan,
    insight,
    highConfidenceErrors,
    assets,
    tagOverconfidence,
    explanationGapTags,
    latestPreview,
    modules: buildModules(dueCards.length, pendingCandidates.length, highConfidenceErrors.length),
    metrics: {
      brierScore: calculateBrierScore(state.logs),
      highConfidenceErrorRate: calculateHighConfidenceErrorRate(state.logs),
      metacognitiveOverhead: calculateMetacognitiveOverhead(state.checkIns.length + state.reflections.length * 2, Math.max(1, state.sessions.reduce((sum, session) => sum + (session.actualMinutes ?? 0), 0))),
      rubricImprovement: calculateRubricImprovement(state.explanations[1]?.rubricScores, state.explanations[0]?.rubricScores)
    }
  };
}

export type WorkspaceDerived = ReturnType<typeof deriveWorkspace>;

export function resolveSourceForCard(card: Card | undefined, chunks: SourceChunk[], sources: SourceDocument[]) {
  if (!card) return undefined;
  const chunk = chunks.find((item) => item.id === card.sourceChunkId);
  return chunk ? sources.find((source) => source.id === chunk.sourceId) : undefined;
}

export function buildModules(due: number, pending: number, errors: number): ModuleNavItem[] {
  return [
    { href: "/", label: "首页", description: "今天该做什么", badge: due ? String(due) : undefined },
    { href: "/library", label: "资料", description: "材料与证据", badge: pending ? String(pending) : undefined },
    { href: "/review", label: "复习", description: "校准提取", badge: due ? String(due) : undefined },
    { href: "/explain", label: "解释", description: "费曼追问", badge: errors ? String(errors) : undefined },
    { href: "/compass", label: "罗盘", description: "计划与反思" },
    { href: "/insights", label: "洞察", description: "校准报告" },
    { href: "/settings", label: "设置", description: "隐私与 AI" }
  ];
}
