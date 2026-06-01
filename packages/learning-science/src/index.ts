import type {
  Card,
  CardCandidate,
  CheckIn,
  ConfidenceJudgment,
  DailyPlan,
  ExplanationAttempt,
  FSRSState,
  InsightSnapshot,
  LearningSession,
  Reflection,
  ReviewLog,
  ReviewOutcome,
  ReviewQueueItem,
  SourceChunk,
  SourceDocument
} from "@metalearn/core";

const confidenceMap: Record<1 | 2 | 3 | 4 | 5, ConfidenceJudgment> = {
  1: { value: 1, probability: 0.1, label: "几乎不会" },
  2: { value: 2, probability: 0.3, label: "不太确定" },
  3: { value: 3, probability: 0.5, label: "一半把握" },
  4: { value: 4, probability: 0.7, label: "比较有把握" },
  5: { value: 5, probability: 0.9, label: "非常确定" }
};

export function confidenceToJudgment(value: 1 | 2 | 3 | 4 | 5): ConfidenceJudgment {
  return confidenceMap[value];
}

export function outcomeToCorrectness(outcome: ReviewOutcome): boolean {
  return outcome === "correct" || outcome === "easy";
}

export function outcomeToQuality(outcome: ReviewOutcome): number {
  if (outcome === "again") return 1;
  if (outcome === "partial") return 2;
  if (outcome === "correct") return 3;
  return 4;
}

export function createInitialFsrsState(): FSRSState {
  return {
    stability: 1,
    difficulty: 5,
    retrievability: 0.9,
    scheduledDays: 0,
    lapses: 0,
    reps: 0
  };
}

export function scheduleReview(card: Card, outcome: ReviewOutcome, reviewedAt = new Date()): Card {
  const quality = outcomeToQuality(outcome);
  const isLapse = quality === 1;
  const previous = card.fsrs;
  const nextDifficulty = clamp(previous.difficulty + (quality <= 2 ? 0.7 : -0.35), 1, 10);
  const stabilityGain = quality === 4 ? 2.6 : quality === 3 ? 1.8 : quality === 2 ? 1.1 : 0.45;
  const nextStability = clamp(previous.stability * stabilityGain, 0.3, 365);
  const scheduledDays = quality === 1 ? 1 : Math.max(1, Math.round(nextStability * (quality === 4 ? 1.3 : 1)));
  const dueAt = new Date(reviewedAt);
  dueAt.setDate(dueAt.getDate() + scheduledDays);

  return {
    ...card,
    dueAt: dueAt.toISOString(),
    lastReviewedAt: reviewedAt.toISOString(),
    fsrs: {
      stability: round(nextStability),
      difficulty: round(nextDifficulty),
      retrievability: quality === 1 ? 0.35 : quality === 2 ? 0.6 : quality === 3 ? 0.82 : 0.92,
      scheduledDays,
      lapses: previous.lapses + (isLapse ? 1 : 0),
      reps: previous.reps + 1
    }
  };
}

export interface FsrsAdapter {
  createInitialState(): FSRSState;
  schedule(card: Card, outcome: ReviewOutcome, reviewedAt?: Date): Card;
}

export const simplifiedFsrsAdapter: FsrsAdapter = {
  createInitialState: createInitialFsrsState,
  schedule: scheduleReview
};

export function calculateBrierScore(logs: ReviewLog[]): number {
  if (logs.length === 0) return 0;
  const total = logs.reduce((sum, log) => {
    const actual = log.isCorrect ? 1 : 0;
    return sum + (log.confidenceProbability - actual) ** 2;
  }, 0);
  return round(total / logs.length);
}

export function calculateOverconfidenceIndex(logs: ReviewLog[]): number {
  if (logs.length === 0) return 0;
  const confidenceMean = logs.reduce((sum, log) => sum + log.confidenceProbability, 0) / logs.length;
  const correctnessMean = logs.filter((log) => log.isCorrect).length / logs.length;
  return round(confidenceMean - correctnessMean);
}

export function calculateHighConfidenceErrorRate(logs: ReviewLog[]): number {
  const high = logs.filter((log) => log.confidence >= 4);
  if (high.length === 0) return 0;
  return round(high.filter((log) => !log.isCorrect).length / high.length);
}

export function buildCalibrationBuckets(logs: ReviewLog[]) {
  return ([1, 2, 3, 4, 5] as const).map((confidence) => {
    const bucketLogs = logs.filter((log) => log.confidence === confidence);
    const expected = confidenceToJudgment(confidence).probability;
    const actual = bucketLogs.length === 0 ? 0 : bucketLogs.filter((log) => log.isCorrect).length / bucketLogs.length;
    return {
      confidence,
      expected,
      actual: round(actual),
      count: bucketLogs.length
    };
  });
}

export function findHighConfidenceErrors(cards: Card[], logs: ReviewLog[]) {
  const cardById = new Map(cards.map((card) => [card.id, card]));
  return logs
    .filter((log) => log.confidence >= 4 && !log.isCorrect)
    .slice(-10)
    .reverse()
    .map((log) => ({
      log,
      card: cardById.get(log.cardId)
    }))
    .filter((item) => item.card);
}

export function buildReviewQueue(cards: Card[], sources: SourceDocument[] = [], now = new Date(), chunks: SourceChunk[] = []): ReviewQueueItem[] {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const chunkById = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  return [...cards]
    .sort((left, right) => new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime())
    .map((card) => {
      const dueMs = new Date(card.dueAt).getTime();
      const diffDays = Math.floor((dueMs - now.getTime()) / 86_400_000);
      const urgency: ReviewQueueItem["urgency"] = diffDays < 0 ? "overdue" : diffDays === 0 ? "due" : diffDays <= 2 ? "soon" : "later";
      const chunk = chunkById.get(card.sourceChunkId);
      return {
        card,
        source: chunk ? sourceById.get(chunk.sourceId) : sourceById.get(card.sourceChunkId),
        chunk,
        urgency,
        reason:
          urgency === "overdue"
            ? "已经逾期，优先恢复记忆状态。"
            : urgency === "due"
              ? "今天到期，适合进行一次合意困难的提取。"
              : urgency === "soon"
                ? "未来两天到期，可作为预备复习。"
                : "暂时不急，先处理到期和高信心错误。"
      };
    });
}

export function calculateActiveLearningRatio(logs: ReviewLog[], sessions: LearningSession[], explanations: ExplanationAttempt[]): number {
  const activeMinutes = logs.length * 1.5 + explanations.length * 4;
  const sessionMinutes = sessions.reduce((sum, session) => sum + (session.actualMinutes ?? session.predictedMinutes), 0);
  if (sessionMinutes <= 0) return logs.length || explanations.length ? 1 : 0;
  return round(Math.min(1, activeMinutes / sessionMinutes));
}

export function calculatePassiveLearningRisk(logs: ReviewLog[], sessions: LearningSession[], checkIns: CheckIn[] = []): number {
  const passiveCheckIns = checkIns.filter((item) => item.focusState === "passive").length;
  const weakRetrievals = logs.filter((log) => log.evidenceStrength === "weak" || log.sourceVisibleBeforeAnswer).length;
  const activeSignals = logs.length + sessions.length + checkIns.length;
  if (activeSignals === 0) return 0;
  return round(Math.min(1, (passiveCheckIns + weakRetrievals) / activeSignals));
}

export function deriveReviewEvidenceStrength(log: Pick<ReviewLog, "answerText" | "durationMs" | "selfRatedEffort" | "sourceVisibleBeforeAnswer">) {
  if (log.sourceVisibleBeforeAnswer) return "weak";
  if (log.answerText.trim().length >= 24 && (log.selfRatedEffort ?? 3) >= 3 && log.durationMs >= 30_000) return "strong";
  if (log.answerText.trim().length >= 12) return "medium";
  return "weak";
}

export function findWeakTags(cards: Card[], logs: ReviewLog[], limit = 5): string[] {
  const misses = new Map<string, { wrong: number; total: number }>();
  for (const log of logs) {
    const card = cards.find((item) => item.id === log.cardId);
    if (!card) continue;
    for (const tag of card.tags) {
      const current = misses.get(tag) ?? { wrong: 0, total: 0 };
      current.total += 1;
      if (!log.isCorrect) current.wrong += 1;
      misses.set(tag, current);
    }
  }
  return [...misses.entries()]
    .filter(([, value]) => value.total > 0)
    .sort(([, left], [, right]) => right.wrong / right.total - left.wrong / left.total)
    .slice(0, limit)
    .map(([tag]) => tag);
}

export function calculatePredictionBiasFromSessions(sessions: LearningSession[]): number {
  const finished = sessions.filter((session) => typeof session.actualMinutes === "number");
  if (finished.length === 0) return 0;
  const total = finished.reduce((sum, session) => sum + calculatePredictionBias(session.predictedMinutes, session.actualMinutes ?? session.predictedMinutes), 0);
  return round(total / finished.length);
}

export function calculateTagOverconfidence(cards: Card[], logs: ReviewLog[], limit = 5) {
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const tagStats = new Map<string, { confidence: number; correct: number; count: number }>();
  for (const log of logs) {
    const card = cardById.get(log.cardId);
    if (!card) continue;
    for (const tag of card.tags) {
      const current = tagStats.get(tag) ?? { confidence: 0, correct: 0, count: 0 };
      current.confidence += log.confidenceProbability;
      current.correct += log.isCorrect ? 1 : 0;
      current.count += 1;
      tagStats.set(tag, current);
    }
  }
  return [...tagStats.entries()]
    .map(([tag, value]) => ({
      tag,
      overconfidence: round(value.confidence / value.count - value.correct / value.count),
      count: value.count
    }))
    .sort((left, right) => right.overconfidence - left.overconfidence)
    .slice(0, limit);
}

export function summarizeExplanationGaps(explanations: ExplanationAttempt[], limit = 5): string[] {
  const counts = new Map<string, number>();
  for (const attempt of explanations) {
    for (const tag of attempt.gapTags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort(([, left], [, right]) => right - left).slice(0, limit).map(([tag]) => tag);
}

export function calculateRubricImprovement(previous?: ExplanationAttempt["rubricScores"], next?: ExplanationAttempt["rubricScores"]): number {
  if (!previous || !next) return 0;
  return round(scoreAverage(next) - scoreAverage(previous));
}

export function createInsightSnapshot(input: {
  cards: Card[];
  logs: ReviewLog[];
  sessions: LearningSession[];
  reflections: Reflection[];
  explanations: ExplanationAttempt[];
  checkIns?: CheckIn[];
  metaMinutes?: number;
  now?: Date;
}): InsightSnapshot {
  const now = input.now ?? new Date();
  const actualMinutes = input.sessions.reduce((sum, session) => sum + (session.actualMinutes ?? 0), 0);
  const metaMinutes = input.metaMinutes ?? input.reflections.length * 2 + input.sessions.length;
  const weeklyCutoff = now.getTime() - 7 * 86_400_000;
  const weeklyLogs = input.logs.filter((log) => new Date(log.createdAt).getTime() >= weeklyCutoff);
  return {
    id: `insight_${now.getTime().toString(36)}`,
    brierScore: calculateBrierScore(input.logs),
    overconfidenceIndex: calculateOverconfidenceIndex(input.logs),
    highConfidenceErrorRate: calculateHighConfidenceErrorRate(input.logs),
    activeLearningRatio: calculateActiveLearningRatio(input.logs, input.sessions, input.explanations),
    metacognitiveOverheadRatio: calculateMetacognitiveOverhead(metaMinutes, actualMinutes || Math.max(1, input.logs.length * 2)),
    predictionBias: calculatePredictionBiasFromSessions(input.sessions),
    passiveLearningRisk: calculatePassiveLearningRisk(input.logs, input.sessions, input.checkIns),
    weakTags: findWeakTags(input.cards, input.logs),
    explanationGapTags: summarizeExplanationGaps(input.explanations),
    weeklyCalibratedRetrievals: weeklyLogs.length,
    recommendation: buildWeeklyAdvice(input.logs),
    createdAt: now.toISOString()
  };
}

export function buildDailyPlan(input: {
  cards: Card[];
  candidates: CardCandidate[];
  logs: ReviewLog[];
  explanations: ExplanationAttempt[];
  sessions?: LearningSession[];
  checkIns?: CheckIn[];
  now?: Date;
}): DailyPlan {
  const now = input.now ?? new Date();
  const dueReviewCount = input.cards.filter((card) => new Date(card.dueAt).getTime() <= now.getTime()).length;
  const highConfidenceErrorCount = input.logs.filter((log) => log.confidence >= 4 && !log.isCorrect).length;
  const pendingCandidateCount = input.candidates.filter((candidate) => candidate.status === "candidate").length;
  const unfinishedExplanationCount = input.explanations.filter((attempt) => (attempt.questions?.length ?? 0) > 0 && (attempt.linkedCardIds?.length ?? 0) === 0).length;
  const overhead = calculateMetacognitiveOverhead((input.checkIns?.length ?? 0) + (input.sessions?.length ?? 0), Math.max(1, (input.sessions ?? []).reduce((sum, session) => sum + (session.actualMinutes ?? 0), 0)));
  let suggestedArea: DailyPlan["suggestedArea"] = "library";
  let nextBestAction = "先导入一份真实材料，生成可审核的提取题。";
  if (dueReviewCount > 0) {
    suggestedArea = "review";
    nextBestAction = `先完成 ${dueReviewCount} 张到期复习卡，保留今天的校准证据。`;
  } else if (highConfidenceErrorCount > 0) {
    suggestedArea = "review";
    nextBestAction = `复盘 ${highConfidenceErrorCount} 个高信心错误，把错因转成解释任务。`;
  } else if (pendingCandidateCount > 0) {
    suggestedArea = "library";
    nextBestAction = `审核 ${pendingCandidateCount} 张候选题，只批准有来源证据的问题。`;
  } else if (unfinishedExplanationCount > 0) {
    suggestedArea = "explain";
    nextBestAction = `继续修订 ${unfinishedExplanationCount} 个解释版本，并生成针对性卡片。`;
  }
  return {
    id: `daily_${now.getTime().toString(36)}`,
    title: "今日学习路线",
    dueReviewCount,
    highConfidenceErrorCount,
    pendingCandidateCount,
    unfinishedExplanationCount,
    metacognitiveOverheadWarning: overhead > 0.1 ? "元认知记录开销偏高，今天优先做复习或解释，减少额外记录。" : undefined,
    suggestedArea,
    nextBestAction,
    generatedAt: now.toISOString()
  };
}

export function calculateMetacognitiveOverhead(metaMinutes: number, actualLearningMinutes: number): number {
  if (actualLearningMinutes <= 0) return 0;
  return round(metaMinutes / actualLearningMinutes);
}

export function calculatePredictionBias(predictedMinutes: number, actualMinutes: number): number {
  if (predictedMinutes <= 0) return 0;
  return round((actualMinutes - predictedMinutes) / predictedMinutes);
}

export function buildWeeklyAdvice(logs: ReviewLog[]): string {
  if (logs.length === 0) return "先完成 5 次校准提取，系统才有足够证据给出建议。";
  const overconfidence = calculateOverconfidenceIndex(logs);
  const highConfidenceErrors = calculateHighConfidenceErrorRate(logs);
  if (highConfidenceErrors > 0.25) return "本周优先复盘高信心错误：这些题最能暴露“以为会”和“真的会”的差距。";
  if (overconfidence > 0.15) return "你的平均信心高于实际正确率，下次先降低预测，再用主动提取验证。";
  if (calculateBrierScore(logs) < 0.16) return "校准状态稳定，可以增加交错练习，避免只在熟悉主题里获得流畅感。";
  return "继续保持信心预测，再把每次错误绑定到来源片段。";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function scoreAverage(scores: ExplanationAttempt["rubricScores"]): number {
  const values = Object.values(scores);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
