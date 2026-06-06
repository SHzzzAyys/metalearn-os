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
  RepairTask,
  ReviewLog,
  SourceChunk,
  SourceDocument
} from "@metalearn/core";
import {
  buildDailyPlan,
  buildCalibrationBuckets,
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
import { buildStudyAssets, validateCardCandidateEvidence } from "@metalearn/storage";
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
  repairTasks: RepairTask[];
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
  aiRequestPreviews: [],
  repairTasks: []
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
  const repairTaskSummary = buildRepairTaskSummary(state.repairTasks);
  const assets = buildStudyAssets({
    sources: state.sources,
    chunks: state.chunks,
    candidates: state.candidates,
    cards: state.cards,
    explanations: state.explanations
  }).filter((asset) => `${asset.title} ${asset.detail} ${asset.statusLabel}`.toLowerCase().includes(searchQuery.toLowerCase()));
  const tagOverconfidence = calculateTagOverconfidence(state.cards, state.logs);
  const explanationGapTags = summarizeExplanationGaps(state.explanations);
  const explanationThreads = deriveExplanationThreads(state.explanations);
  const insightActions = deriveInsightActions({
    dueCards,
    pendingCandidates,
    repairTaskSummary,
    explanationThreads,
    sources: state.sources
  });
  const calibrationTrend = deriveCalibrationTrend(state.logs);
  const reliabilityEvidence = deriveReliabilityEvidence(state.logs);
  const insightEvidenceThresholds = deriveInsightEvidenceThresholds(state.logs, calibrationTrend, reliabilityEvidence);
  const scopedInsights = deriveScopedInsights(state, explanationThreads);
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
    explanationThreads,
    insightActions,
    calibrationTrend,
    reliabilityEvidence,
    insightEvidenceThresholds,
    scopedInsights,
    latestPreview,
    repairTaskSummary,
    modules: buildModules(dueCards.length, pendingCandidates.length, repairTaskSummary.openCount),
    metrics: {
      brierScore: calculateBrierScore(state.logs),
      highConfidenceErrorRate: calculateHighConfidenceErrorRate(state.logs),
      metacognitiveOverhead: calculateMetacognitiveOverhead(state.checkIns.length + state.reflections.length * 2, Math.max(1, state.sessions.reduce((sum, session) => sum + (session.actualMinutes ?? 0), 0))),
      rubricImprovement: calculateRubricImprovement(state.explanations[1]?.rubricScores, state.explanations[0]?.rubricScores)
    }
  };
}

export type WorkspaceDerived = ReturnType<typeof deriveWorkspace>;

export type ChunkEvidenceStatus = "uncovered" | "candidate" | "carded" | "reviewed";

export interface ChunkEvidenceSummary {
  chunkId: string;
  candidateCount: number;
  approvedCardCount: number;
  reviewCount: number;
  status: ChunkEvidenceStatus;
}

export interface ActiveReadingStep {
  chunk: SourceChunk;
  evidence: ChunkEvidenceSummary;
  priority: "create" | "review_candidate" | "review_card" | "verify";
  actionLabel: string;
  rationale: string;
  prompts: string[];
}

export interface ActiveReadingTrack {
  totalChunks: number;
  coveredCount: number;
  coverageRatio: number;
  uncoveredCount: number;
  candidateOnlyCount: number;
  cardedNotReviewedCount: number;
  reviewedCount: number;
  nextStep?: ActiveReadingStep;
}

export interface ExplanationVersionDelta {
  attempt: ExplanationAttempt;
  previous?: ExplanationAttempt;
  averageScore: number;
  previousAverageScore?: number;
  scoreDelta?: number;
  improvedRubricKeys: string[];
  declinedRubricKeys: string[];
  resolvedGapTags: string[];
  newGapTags: string[];
  textDelta: {
    currentLength: number;
    previousLength?: number;
    lengthDelta?: number;
    addedSignals: string[];
  };
}

export interface ExplanationConceptThread {
  concept: string;
  versions: ExplanationVersionDelta[];
  latest: ExplanationVersionDelta;
}

export interface InsightAction {
  id: string;
  title: string;
  detail: string;
  href: string;
  priority: "high" | "medium" | "low";
  evidenceLabel: string;
}

export type CalibrationEvidenceStatus = "empty" | "thin" | "enough";

export interface CalibrationTrendPoint {
  date: string;
  reviewCount: number;
  brierScore: number;
  highConfidenceErrorRate: number;
  accuracy: number;
  averageConfidence: number;
}

export interface ReliabilityBucketEvidence {
  confidence: 1 | 2 | 3 | 4 | 5;
  expected: number;
  actual: number;
  count: number;
  gap: number;
  status: CalibrationEvidenceStatus;
}

export interface InsightEvidenceThresholds {
  reviewCount: number;
  trendPointCount: number;
  trendMinimumReviews: number;
  trendMinimumDays: number;
  reliabilityMinimumPerBucket: number;
  reliabilityEnoughBucketCount: number;
  reliabilityMinimumEnoughBuckets: number;
  enoughForTrend: boolean;
  enoughForReliability: boolean;
  message: string;
}

export type ScopedInsightKind = "material" | "tag" | "concept";

export interface ScopedInsight {
  id: string;
  kind: ScopedInsightKind;
  label: string;
  status: CalibrationEvidenceStatus;
  evidenceCount: number;
  evidenceLabel: string;
  summary: string;
  metricLabel: string;
  detailChips: string[];
  href: string;
  actionLabel: string;
  brierScore?: number;
  accuracy?: number;
  overconfidence?: number;
  highConfidenceErrorCount?: number;
}

export interface ScopedInsightGroups {
  materials: ScopedInsight[];
  tags: ScopedInsight[];
  concepts: ScopedInsight[];
}

export function deriveCalibrationTrend(logs: ReviewLog[], maxPoints = 7): CalibrationTrendPoint[] {
  const grouped = new Map<string, ReviewLog[]>();
  for (const log of logs) {
    const dateKey = normalizeLogDate(log.createdAt);
    grouped.set(dateKey, [...(grouped.get(dateKey) ?? []), log]);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-maxPoints)
    .map(([date, dateLogs]) => {
      const correctCount = dateLogs.filter((log) => log.isCorrect).length;
      const averageConfidence = dateLogs.reduce((sum, log) => sum + log.confidenceProbability, 0) / dateLogs.length;
      return {
        date,
        reviewCount: dateLogs.length,
        brierScore: calculateBrierScore(dateLogs),
        highConfidenceErrorRate: calculateHighConfidenceErrorRate(dateLogs),
        accuracy: roundThree(correctCount / dateLogs.length),
        averageConfidence: roundThree(averageConfidence)
      };
    });
}

export function deriveReliabilityEvidence(logs: ReviewLog[]): ReliabilityBucketEvidence[] {
  return buildCalibrationBuckets(logs).map((bucket) => ({
    ...bucket,
    gap: roundThree(bucket.actual - bucket.expected),
    status: bucket.count === 0 ? "empty" : bucket.count < 3 ? "thin" : "enough"
  }));
}

export function deriveInsightEvidenceThresholds(
  logs: ReviewLog[],
  trend = deriveCalibrationTrend(logs),
  reliability = deriveReliabilityEvidence(logs)
): InsightEvidenceThresholds {
  const trendMinimumReviews = 5;
  const trendMinimumDays = 2;
  const reliabilityMinimumPerBucket = 3;
  const reliabilityMinimumEnoughBuckets = 2;
  const reliabilityEnoughBucketCount = reliability.filter((bucket) => bucket.status === "enough").length;
  const enoughForTrend = logs.length >= trendMinimumReviews && trend.length >= trendMinimumDays;
  const enoughForReliability = logs.length >= 8 && reliabilityEnoughBucketCount >= reliabilityMinimumEnoughBuckets;

  let message = "已有初步校准证据，可以观察趋势；仍应继续积累不同材料和不同信心档的复习记录。";
  if (logs.length === 0) {
    message = "还没有复习证据。先完成至少 5 次带信心预测的主动提取，再生成趋势判断。";
  } else if (!enoughForTrend && !enoughForReliability) {
    message = `证据不足：目前 ${logs.length} 次复习。趋势至少需要 ${trendMinimumReviews} 次且覆盖 ${trendMinimumDays} 天；可靠性曲线至少需要 ${reliabilityMinimumEnoughBuckets} 个信心档各 ${reliabilityMinimumPerBucket} 次。`;
  } else if (!enoughForReliability) {
    message = `趋势可以初步观察，但可靠性曲线仍偏薄：目前只有 ${reliabilityEnoughBucketCount} 个信心档达到 ${reliabilityMinimumPerBucket} 次样本。`;
  }

  return {
    reviewCount: logs.length,
    trendPointCount: trend.length,
    trendMinimumReviews,
    trendMinimumDays,
    reliabilityMinimumPerBucket,
    reliabilityEnoughBucketCount,
    reliabilityMinimumEnoughBuckets,
    enoughForTrend,
    enoughForReliability,
    message
  };
}

export function deriveScopedInsights(state: WorkspaceState, explanationThreads: ExplanationConceptThread[] = deriveExplanationThreads(state.explanations)): ScopedInsightGroups {
  const unresolvedTasks = state.repairTasks.filter((task) => task.status === "open" || task.status === "in_progress");

  const materials = state.sources
    .filter((source) => source.status !== "archived")
    .map((source): ScopedInsight => {
      const sourceChunkIds = new Set(state.chunks.filter((chunk) => chunk.sourceId === source.id).map((chunk) => chunk.id));
      const cards = state.cards.filter((card) => sourceChunkIds.has(card.sourceChunkId));
      const cardIds = new Set(cards.map((card) => card.id));
      const logs = state.logs.filter((log) => log.sourceId === source.id || cardIds.has(log.cardId));
      const candidates = state.candidates.filter((candidate) => sourceChunkIds.has(candidate.sourceChunkId) && candidate.status === "candidate");
      const tasks = unresolvedTasks.filter((task) => task.sourceId === source.id);
      const stats = buildScopedReviewStats(logs);
      const action =
        tasks.length > 0
          ? { href: `/review/mistakes?sourceId=${encodeScopedParam(source.id)}`, label: "修复材料错误" }
          : candidates.length > 0
            ? { href: `/library/${source.id}#candidate-review`, label: "审核候选题" }
            : cards.length > 0
              ? { href: `/review?sourceId=${encodeScopedParam(source.id)}`, label: "复习材料卡" }
              : { href: `/library/${source.id}`, label: "补来源卡" };
      return {
        id: `material-${source.id}`,
        kind: "material",
        label: source.title,
        status: reviewCountToEvidenceStatus(stats.reviewCount),
        evidenceCount: stats.reviewCount,
        evidenceLabel: `${stats.reviewCount} 次复习`,
        summary: buildScopedReviewSummary(stats, "这份材料"),
        metricLabel: buildScopedMetricLabel(stats),
        detailChips: [`${sourceChunkIds.size} 片段`, `${cards.length} 卡`, `${candidates.length} 候选`, `${tasks.length} 修复`],
        href: action.href,
        actionLabel: action.label,
        ...stats
      };
    })
    .sort(compareScopedInsights)
    .slice(0, 4);

  const allTags = new Set<string>();
  for (const card of state.cards) card.tags.forEach((tag) => allTags.add(tag));
  for (const candidate of state.candidates) candidate.tags.forEach((tag) => allTags.add(tag));
  for (const task of unresolvedTasks) task.tagSnapshot.forEach((tag) => allTags.add(tag));
  const tags = [...allTags]
    .filter(Boolean)
    .map((tag): ScopedInsight => {
      const cards = state.cards.filter((card) => card.tags.includes(tag));
      const cardIds = new Set(cards.map((card) => card.id));
      const logs = state.logs.filter((log) => cardIds.has(log.cardId));
      const candidates = state.candidates.filter((candidate) => candidate.status === "candidate" && candidate.tags.includes(tag));
      const tasks = unresolvedTasks.filter((task) => task.tagSnapshot.includes(tag));
      const stats = buildScopedReviewStats(logs);
      const action =
        tasks.length > 0
          ? { href: `/review/mistakes?tag=${encodeScopedParam(tag)}`, label: "修复这个 tag" }
          : candidates.length > 0
            ? { href: `/library?tag=${encodeScopedParam(tag)}#candidate-review`, label: "审核 tag 候选" }
            : cards.length > 0
              ? { href: `/review?tag=${encodeScopedParam(tag)}`, label: "复习这个 tag" }
              : { href: `/library?tag=${encodeScopedParam(tag)}`, label: "补 tag 证据" };
      return {
        id: `tag-${tag}`,
        kind: "tag",
        label: tag,
        status: reviewCountToEvidenceStatus(stats.reviewCount),
        evidenceCount: stats.reviewCount,
        evidenceLabel: `${stats.reviewCount} 次复习`,
        summary: buildScopedReviewSummary(stats, `tag「${tag}」`),
        metricLabel: buildScopedMetricLabel(stats),
        detailChips: [`${cards.length} 卡`, `${candidates.length} 候选`, `${tasks.length} 修复`],
        href: action.href,
        actionLabel: action.label,
        ...stats
      };
    })
    .sort(compareScopedInsights)
    .slice(0, 5);

  const concepts = explanationThreads
    .map((thread): ScopedInsight => {
      const latest = thread.latest;
      const linkedCardIds = new Set(thread.versions.flatMap((version) => version.attempt.linkedCardIds ?? []));
      const logs = state.logs.filter((log) => linkedCardIds.has(log.cardId));
      const stats = buildScopedReviewStats(logs);
      const versionCount = thread.versions.length;
      const gapCount = latest.attempt.gapTags?.length ?? 0;
      const status: CalibrationEvidenceStatus = versionCount >= 2 ? "enough" : "thin";
      const href = `/explain?concept=${encodeScopedParam(thread.concept)}`;
      return {
        id: `concept-${thread.concept}`,
        kind: "concept",
        label: thread.concept,
        status,
        evidenceCount: versionCount,
        evidenceLabel: `${versionCount} 个版本`,
        summary:
          versionCount < 2
            ? "只有一个解释版本。先根据追问写 v2，再比较漏洞是否被补上。"
            : gapCount > 0
              ? `最新解释仍有 ${gapCount} 类漏洞，适合继续补机制、例子或边界。`
              : "已有多个解释版本，当前没有显式 gap；仍可用复习卡验证能否主动提取。",
        metricLabel: `rubric ${latest.averageScore.toFixed(1)} · v${latest.attempt.versionIndex ?? versionCount}`,
        detailChips: [`${versionCount} 版本`, `${gapCount} gap`, `${linkedCardIds.size} 关联卡`, `${stats.reviewCount} 复习`],
        href,
        actionLabel: gapCount > 0 || versionCount < 2 ? "修订解释" : "验证概念",
        ...stats
      };
    })
    .sort((left, right) => {
      const statusDiff = evidenceStatusRank(left.status) - evidenceStatusRank(right.status);
      if (statusDiff !== 0) return statusDiff;
      return right.evidenceCount - left.evidenceCount;
    })
    .slice(0, 4);

  return { materials, tags, concepts };
}

export function deriveMaterialDetail(state: WorkspaceState, sourceId: string) {
  const source = state.sources.find((item) => item.id === sourceId);
  const chunks = state.chunks.filter((chunk) => chunk.sourceId === sourceId).sort((left, right) => left.index - right.index);
  const chunkIds = new Set(chunks.map((chunk) => chunk.id));
  const pendingCandidates = state.candidates.filter((candidate) => candidate.status === "candidate" && chunkIds.has(candidate.sourceChunkId));
  const rejectedCandidates = state.candidates.filter((candidate) => candidate.status === "rejected" && chunkIds.has(candidate.sourceChunkId));
  const approvedCards = state.cards.filter((card) => chunkIds.has(card.sourceChunkId));
  const approvedCardIds = new Set(approvedCards.map((card) => card.id));
  const reviewLogs = state.logs.filter((log) => approvedCardIds.has(log.cardId) || log.sourceId === sourceId);
  const explanations = state.explanations.filter((attempt) => chunks.some((chunk) => attempt.sourceQuote && chunk.text.includes(attempt.sourceQuote)));
  const danglingCandidates = state.candidates.filter((candidate) => {
    const validation = validateCardCandidateEvidence(candidate, state.chunks);
    return !validation.ok && (!candidate.sourceChunkId || candidate.sourceChunkId.startsWith("chunk_"));
  });
  const danglingCards = state.cards.filter((card) => !state.chunks.some((chunk) => chunk.id === card.sourceChunkId));
  const correctCount = reviewLogs.filter((log) => log.isCorrect).length;
  const averageConfidence =
    reviewLogs.length === 0 ? 0 : reviewLogs.reduce((sum, log) => sum + log.confidenceProbability, 0) / reviewLogs.length;

  return {
    source,
    chunks,
    pendingCandidates,
    rejectedCandidates,
    approvedCards,
    reviewLogs,
    explanations,
    danglingCandidates,
    danglingCards,
    recentPerformance: {
      reviewCount: reviewLogs.length,
      brierScore: calculateBrierScore(reviewLogs),
      averageConfidence,
      accuracy: reviewLogs.length === 0 ? 0 : correctCount / reviewLogs.length,
      highConfidenceErrorRate: calculateHighConfidenceErrorRate(reviewLogs),
      highConfidenceErrorCount: reviewLogs.filter((log) => log.confidence >= 4 && !log.isCorrect).length
    },
    statusCounts: {
      chunks: chunks.length,
      pendingCandidates: pendingCandidates.length,
      rejectedCandidates: rejectedCandidates.length,
      approvedCards: approvedCards.length,
      reviewLogs: reviewLogs.length,
      explanations: explanations.length
    }
  };
}

export function deriveExplanationThreads(explanations: ExplanationAttempt[]): ExplanationConceptThread[] {
  const grouped = new Map<string, ExplanationAttempt[]>();
  for (const attempt of explanations) {
    const concept = attempt.concept.trim() || "未命名概念";
    grouped.set(concept, [...(grouped.get(concept) ?? []), attempt]);
  }

  return [...grouped.entries()]
    .map(([concept, attempts]) => {
      const sorted = [...attempts].sort((left, right) => {
        const versionDiff = (left.versionIndex ?? 1) - (right.versionIndex ?? 1);
        if (versionDiff !== 0) return versionDiff;
        return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      });
      const versions = sorted.map((attempt, index) => buildExplanationVersionDelta(attempt, sorted[index - 1]));
      return {
        concept,
        versions,
        latest: versions[versions.length - 1]
      };
    })
    .sort((left, right) => new Date(right.latest.attempt.createdAt).getTime() - new Date(left.latest.attempt.createdAt).getTime());
}

export function buildExplanationVersionDelta(attempt: ExplanationAttempt, previous?: ExplanationAttempt): ExplanationVersionDelta {
  const rubricKeys = Object.keys(attempt.rubricScores) as Array<keyof ExplanationAttempt["rubricScores"]>;
  const improvedRubricKeys = previous
    ? rubricKeys.filter((key) => attempt.rubricScores[key] > previous.rubricScores[key])
    : [];
  const declinedRubricKeys = previous
    ? rubricKeys.filter((key) => attempt.rubricScores[key] < previous.rubricScores[key])
    : [];
  const currentGaps = new Set(attempt.gapTags ?? []);
  const previousGaps = new Set(previous?.gapTags ?? []);
  const normalizedCurrent = normalizeExplanationText(attempt.explanation);
  const normalizedPrevious = previous ? normalizeExplanationText(previous.explanation) : "";

  return {
    attempt,
    previous,
    averageScore: averageRubricScore(attempt.rubricScores),
    previousAverageScore: previous ? averageRubricScore(previous.rubricScores) : undefined,
    scoreDelta: previous ? roundOne(averageRubricScore(attempt.rubricScores) - averageRubricScore(previous.rubricScores)) : undefined,
    improvedRubricKeys: improvedRubricKeys.map(String),
    declinedRubricKeys: declinedRubricKeys.map(String),
    resolvedGapTags: [...previousGaps].filter((tag) => !currentGaps.has(tag)),
    newGapTags: [...currentGaps].filter((tag) => !previousGaps.has(tag)),
    textDelta: {
      currentLength: normalizedCurrent.length,
      previousLength: previous ? normalizedPrevious.length : undefined,
      lengthDelta: previous ? normalizedCurrent.length - normalizedPrevious.length : undefined,
      addedSignals: previous ? findAddedExplanationSignals(normalizedCurrent, normalizedPrevious) : []
    }
  };
}

export function deriveChunkEvidenceSummaries(chunks: SourceChunk[], candidates: CardCandidate[], cards: Card[], logs: ReviewLog[]) {
  const summaries = new Map<string, ChunkEvidenceSummary>();
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  for (const chunk of chunks) {
    summaries.set(chunk.id, {
      chunkId: chunk.id,
      candidateCount: 0,
      approvedCardCount: 0,
      reviewCount: 0,
      status: "uncovered"
    });
  }
  for (const candidate of candidates) {
    const summary = summaries.get(candidate.sourceChunkId);
    if (summary) summary.candidateCount += 1;
  }
  for (const card of cards) {
    const summary = summaries.get(card.sourceChunkId);
    if (summary) summary.approvedCardCount += 1;
  }
  for (const log of logs) {
    const card = cardsById.get(log.cardId);
    const summary = card ? summaries.get(card.sourceChunkId) : undefined;
    if (summary) summary.reviewCount += 1;
  }
  for (const summary of summaries.values()) {
    summary.status = summary.reviewCount > 0 ? "reviewed" : summary.approvedCardCount > 0 ? "carded" : summary.candidateCount > 0 ? "candidate" : "uncovered";
  }
  return summaries;
}

export function deriveActiveReadingTrack(chunks: SourceChunk[], evidenceByChunkId: Map<string, ChunkEvidenceSummary>): ActiveReadingTrack {
  const summaries = chunks.map((chunk) => evidenceByChunkId.get(chunk.id) ?? {
    chunkId: chunk.id,
    candidateCount: 0,
    approvedCardCount: 0,
    reviewCount: 0,
    status: "uncovered" as const
  });
  const uncoveredCount = summaries.filter((summary) => summary.status === "uncovered").length;
  const candidateOnlyCount = summaries.filter((summary) => summary.status === "candidate").length;
  const cardedNotReviewedCount = summaries.filter((summary) => summary.status === "carded").length;
  const reviewedCount = summaries.filter((summary) => summary.status === "reviewed").length;
  const coveredCount = chunks.length - uncoveredCount;
  const nextStepChunk =
    chunks.find((chunk) => evidenceByChunkId.get(chunk.id)?.status === "uncovered") ??
    chunks.find((chunk) => evidenceByChunkId.get(chunk.id)?.status === "candidate") ??
    chunks.find((chunk) => evidenceByChunkId.get(chunk.id)?.status === "carded") ??
    chunks.find((chunk) => evidenceByChunkId.get(chunk.id)?.status === "reviewed");
  const nextEvidence = nextStepChunk ? evidenceByChunkId.get(nextStepChunk.id) : undefined;

  return {
    totalChunks: chunks.length,
    coveredCount,
    coverageRatio: chunks.length === 0 ? 0 : coveredCount / chunks.length,
    uncoveredCount,
    candidateOnlyCount,
    cardedNotReviewedCount,
    reviewedCount,
    nextStep: nextStepChunk && nextEvidence ? buildActiveReadingStep(nextStepChunk, nextEvidence) : undefined
  };
}

function buildActiveReadingStep(chunk: SourceChunk, evidence: ChunkEvidenceSummary): ActiveReadingStep {
  if (evidence.status === "uncovered") {
    return {
      chunk,
      evidence,
      priority: "create",
      actionLabel: "先补一条证据",
      rationale: "这个片段还没有候选题、卡片或复习记录。先解释或建卡，避免只读不提取。",
      prompts: buildChunkRecallPrompts(chunk)
    };
  }
  if (evidence.status === "candidate") {
    return {
      chunk,
      evidence,
      priority: "review_candidate",
      actionLabel: "审核候选题",
      rationale: "这个片段已经有候选题，但还没有进入复习队列。下一步应人工审核，而不是继续生成。",
      prompts: buildChunkRecallPrompts(chunk)
    };
  }
  if (evidence.status === "carded") {
    return {
      chunk,
      evidence,
      priority: "review_card",
      actionLabel: "完成一次校准复习",
      rationale: "这个片段已经成卡，但还缺少真实提取证据。下一步应去复习并记录信心。",
      prompts: buildChunkRecallPrompts(chunk)
    };
  }
  return {
    chunk,
    evidence,
    priority: "verify",
    actionLabel: "检查复习证据",
    rationale: "这个片段已有复习记录。可以查看校准表现，或继续处理未覆盖片段。",
    prompts: buildChunkRecallPrompts(chunk)
  };
}

export function buildChunkRecallPrompts(chunk: SourceChunk): string[] {
  const normalized = chunk.text.replace(/\s+/g, " ").trim();
  const firstSentence = normalized.split(/[。.!?？]/).find((part) => part.trim().length >= 8)?.trim() ?? normalized.slice(0, 80);
  return [
    `不看原文，用一句话说明这段主要解决什么问题。`,
    `围绕“${firstSentence.slice(0, 42)}”提出一个为什么或如何问题。`,
    "写出一个边界条件、反例或容易混淆的概念。"
  ];
}

export function resolveSourceForCard(card: Card | undefined, chunks: SourceChunk[], sources: SourceDocument[]) {
  if (!card) return undefined;
  const chunk = chunks.find((item) => item.id === card.sourceChunkId);
  return chunk ? sources.find((source) => source.id === chunk.sourceId) : undefined;
}

export function buildRepairTaskSummary(tasks: RepairTask[]) {
  const unresolved = tasks.filter((task) => task.status === "open" || task.status === "in_progress");
  const byTag = new Map<string, number>();
  const byReason = new Map<string, number>();
  const bySource = new Map<string, number>();
  const now = Date.now();
  const weekAgo = now - 7 * 86_400_000;
  let createdThisWeek = 0;
  let resolvedThisWeek = 0;
  for (const task of tasks) {
    if (new Date(task.createdAt).getTime() >= weekAgo) createdThisWeek += 1;
    if (task.resolvedAt && new Date(task.resolvedAt).getTime() >= weekAgo) resolvedThisWeek += 1;
  }
  for (const task of unresolved) {
    byReason.set(task.reason, (byReason.get(task.reason) ?? 0) + 1);
    bySource.set(task.sourceId, (bySource.get(task.sourceId) ?? 0) + 1);
    for (const tag of task.tagSnapshot) {
      byTag.set(tag, (byTag.get(tag) ?? 0) + 1);
    }
  }
  const top = (map: Map<string, number>) => [...map.entries()].sort((left, right) => right[1] - left[1]).slice(0, 6).map(([label, count]) => ({ label, count }));
  return {
    openCount: unresolved.filter((task) => task.status === "open").length,
    inProgressCount: unresolved.filter((task) => task.status === "in_progress").length,
    unresolvedCount: unresolved.length,
    resolvedCount: tasks.filter((task) => task.status === "resolved").length,
    dismissedCount: tasks.filter((task) => task.status === "dismissed").length,
    createdThisWeek,
    resolvedThisWeek,
    byTag: top(byTag),
    byReason: top(byReason),
    bySource: top(bySource)
  };
}

export function deriveInsightActions(input: {
  dueCards: Card[];
  pendingCandidates: CardCandidate[];
  repairTaskSummary: ReturnType<typeof buildRepairTaskSummary>;
  explanationThreads: ExplanationConceptThread[];
  sources: SourceDocument[];
}): InsightAction[] {
  const actions: InsightAction[] = [];
  if (input.repairTaskSummary.unresolvedCount > 0) {
    actions.push({
      id: "repair-high-confidence-errors",
      title: "先处理高信心错误",
      detail: "这些记录最能暴露熟悉感和真实掌握之间的差距。",
      href: "/review/mistakes",
      priority: "high",
      evidenceLabel: `${input.repairTaskSummary.unresolvedCount} 个未解决`
    });
  }
  if (input.dueCards.length > 0) {
    actions.push({
      id: "review-due-cards",
      title: "完成到期校准复习",
      detail: "先预测信心，再主动回答，避免只看材料造成熟悉感。",
      href: "/review",
      priority: input.repairTaskSummary.unresolvedCount > 0 ? "medium" : "high",
      evidenceLabel: `${input.dueCards.length} 张到期`
    });
  }
  if (input.pendingCandidates.length > 0) {
    actions.push({
      id: "approve-candidates",
      title: "审核候选题",
      detail: "生成结果还不是学习证据，批准前必须检查问题、答案和来源摘录。",
      href: "/library#candidate-review",
      priority: "medium",
      evidenceLabel: `${input.pendingCandidates.length} 张待审`
    });
  }
  const weakThread = input.explanationThreads.find((thread) => thread.latest.newGapTags.length > 0 || thread.latest.averageScore < 3.5);
  if (weakThread) {
    actions.push({
      id: `revise-explanation-${weakThread.concept}`,
      title: `修订解释：${weakThread.concept}`,
      detail: weakThread.latest.newGapTags.length > 0
        ? `最新版本仍有 ${weakThread.latest.newGapTags.map(rubricInsightLabel).join("、")} 漏洞。`
        : "最新解释 rubric 仍偏低，适合再补机制、例子或边界。",
      href: "/explain",
      priority: input.repairTaskSummary.unresolvedCount > 0 || input.dueCards.length > 0 ? "medium" : "high",
      evidenceLabel: `v${weakThread.latest.attempt.versionIndex ?? weakThread.versions.length} · ${weakThread.latest.averageScore.toFixed(1)}`
    });
  }
  const activeSource = input.sources.find((source) => source.status !== "archived");
  if (actions.length < 4 && activeSource) {
    actions.push({
      id: `read-material-${activeSource.id}`,
      title: "回到材料主动阅读",
      detail: "优先处理未覆盖片段，把阅读转成解释、候选题或复习证据。",
      href: `/library/${activeSource.id}`,
      priority: "low",
      evidenceLabel: activeSource.title
    });
  }
  if (actions.length === 0) {
    actions.push({
      id: "import-first-material",
      title: "导入一份真实材料",
      detail: "没有足够本地证据时，洞察不会伪造结论。先导入材料并创建第一张来源卡。",
      href: "/library",
      priority: "medium",
      evidenceLabel: "证据不足"
    });
  }
  return actions.slice(0, 4);
}

function rubricInsightLabel(key: string): string {
  const labels: Record<string, string> = {
    clarity: "清晰度",
    mechanism: "机制",
    example: "例子",
    boundary: "边界",
    contrast: "区分"
  };
  return labels[key] ?? key;
}

function averageRubricScore(scores: ExplanationAttempt["rubricScores"]): number {
  const values = Object.values(scores);
  return roundOne(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundThree(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function buildScopedReviewStats(logs: ReviewLog[]) {
  const reviewCount = logs.length;
  const correctCount = logs.filter((log) => log.isCorrect).length;
  const averageConfidence = reviewCount === 0 ? 0 : logs.reduce((sum, log) => sum + log.confidenceProbability, 0) / reviewCount;
  const accuracy = reviewCount === 0 ? 0 : correctCount / reviewCount;
  return {
    reviewCount,
    brierScore: calculateBrierScore(logs),
    accuracy: roundThree(accuracy),
    overconfidence: roundThree(averageConfidence - accuracy),
    highConfidenceErrorCount: logs.filter((log) => log.confidence >= 4 && !log.isCorrect).length
  };
}

function reviewCountToEvidenceStatus(reviewCount: number): CalibrationEvidenceStatus {
  if (reviewCount === 0) return "empty";
  if (reviewCount < 3) return "thin";
  return "enough";
}

function evidenceStatusRank(status: CalibrationEvidenceStatus): number {
  if (status === "enough") return 0;
  if (status === "thin") return 1;
  return 2;
}

function compareScopedInsights(left: ScopedInsight, right: ScopedInsight): number {
  const leftRisk = (left.highConfidenceErrorCount ?? 0) * 4 + Math.max(0, left.overconfidence ?? 0) * 10;
  const rightRisk = (right.highConfidenceErrorCount ?? 0) * 4 + Math.max(0, right.overconfidence ?? 0) * 10;
  if (rightRisk !== leftRisk) return rightRisk - leftRisk;
  const statusDiff = evidenceStatusRank(left.status) - evidenceStatusRank(right.status);
  if (statusDiff !== 0) return statusDiff;
  return right.evidenceCount - left.evidenceCount;
}

function buildScopedReviewSummary(stats: ReturnType<typeof buildScopedReviewStats>, label: string): string {
  if (stats.reviewCount === 0) return `${label}还没有复习证据。先从来源片段建卡或审核候选题。`;
  if (stats.reviewCount < 3) return `${label}只有 ${stats.reviewCount} 次复习，样本偏薄；先继续提取，不做稳定判断。`;
  if (stats.highConfidenceErrorCount > 0) return `${label}有 ${stats.highConfidenceErrorCount} 次高信心错误，应优先复盘错因。`;
  if (stats.overconfidence > 0.15) return `${label}平均信心高于实际正确率，下一轮先降低预测并主动提取。`;
  return `${label}已有可读复习证据，可以继续观察趋势并补弱项。`;
}

function buildScopedMetricLabel(stats: ReturnType<typeof buildScopedReviewStats>): string {
  if (stats.reviewCount === 0) return "证据不足";
  return `Brier ${stats.brierScore.toFixed(3)} · 正确率 ${Math.round(stats.accuracy * 100)}%`;
}

function encodeScopedParam(value: string): string {
  return encodeURIComponent(value.trim());
}

function normalizeLogDate(value: string): string {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return value.slice(0, 10) || "unknown";
  return new Date(timestamp).toISOString().slice(0, 10);
}

function normalizeExplanationText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function findAddedExplanationSignals(current: string, previous: string): string[] {
  const signals = [
    { key: "机制", patterns: ["机制", "因为", "导致", "作用"] },
    { key: "例子", patterns: ["例如", "比如", "例子", "案例"] },
    { key: "边界", patterns: ["边界", "除非", "限制", "适用", "不适用"] },
    { key: "对比", patterns: ["不同", "相比", "区别", "混淆"] },
    { key: "反例", patterns: ["反例", "例外", "错误", "误区"] }
  ];
  return signals
    .filter((signal) => signal.patterns.some((pattern) => current.includes(pattern)) && !signal.patterns.some((pattern) => previous.includes(pattern)))
    .map((signal) => signal.key);
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
