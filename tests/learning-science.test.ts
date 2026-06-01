import { describe, expect, it } from "vitest";
import type { Card, CardCandidate, CheckIn, ExplanationAttempt, LearningSession, Reflection, ReviewLog, SourceChunk, SourceDocument } from "@metalearn/core";
import {
  buildCalibrationBuckets,
  buildDailyPlan,
  buildReviewQueue,
  calculateBrierScore,
  calculateHighConfidenceErrorRate,
  calculateMetacognitiveOverhead,
  calculateOverconfidenceIndex,
  calculatePassiveLearningRisk,
  calculatePredictionBiasFromSessions,
  calculateTagOverconfidence,
  deriveReviewEvidenceStrength,
  createInsightSnapshot,
  confidenceToJudgment,
  createInitialFsrsState,
  findWeakTags,
  scheduleReview
} from "@metalearn/learning-science";

const logs: ReviewLog[] = [
  {
    id: "r1",
    cardId: "c1",
    sourceId: "s1",
    confidence: 5,
    confidenceProbability: 0.9,
    answerText: "a",
    outcome: "again",
    isCorrect: false,
    durationMs: 1000,
    createdAt: "2026-05-31T00:00:00.000Z"
  },
  {
    id: "r2",
    cardId: "c2",
    sourceId: "s1",
    confidence: 4,
    confidenceProbability: 0.7,
    answerText: "b",
    outcome: "correct",
    isCorrect: true,
    durationMs: 1000,
    createdAt: "2026-05-31T00:01:00.000Z"
  }
];

const card: Card = {
  id: "card_1",
  question: "What is retrieval practice?",
  expectedAnswer: "Active recall.",
  sourceQuote: "Retrieval practice requires active recall.",
  cardType: "definition",
  difficulty: 2,
  tags: ["course", "retrieval"],
  sourceChunkId: "chunk_1",
  status: "approved",
  createdAt: "2026-05-31T00:00:00.000Z",
  dueAt: "2026-05-31T00:00:00.000Z",
  fsrs: createInitialFsrsState()
};

describe("learning science calculations", () => {
  it("maps five confidence levels to stable probabilities", () => {
    expect(confidenceToJudgment(1).probability).toBe(0.1);
    expect(confidenceToJudgment(5).probability).toBe(0.9);
  });

  it("calculates calibration metrics from review logs", () => {
    expect(calculateBrierScore(logs)).toBeCloseTo(0.45, 3);
    expect(calculateOverconfidenceIndex(logs)).toBeCloseTo(0.3, 3);
    expect(calculateHighConfidenceErrorRate(logs)).toBeCloseTo(0.5, 3);
    expect(buildCalibrationBuckets(logs).find((bucket) => bucket.confidence === 5)?.actual).toBe(0);
  });

  it("keeps metacognitive overhead explicit", () => {
    expect(calculateMetacognitiveOverhead(3, 30)).toBe(0.1);
  });

  it("schedules later reviews after successful retrieval", () => {
    const reviewed = scheduleReview(card, "easy", new Date("2026-05-31T00:00:00.000Z"));
    expect(reviewed.fsrs.reps).toBe(1);
    expect(reviewed.fsrs.scheduledDays).toBeGreaterThanOrEqual(1);
    expect(new Date(reviewed.dueAt).getTime()).toBeGreaterThan(new Date(card.dueAt).getTime());
  });

  it("builds an urgency-ranked review queue", () => {
    const source: SourceDocument = {
      id: "source_1",
      title: "Retrieval notes",
      templateId: "course",
      rawText: "Retrieval practice requires active recall.",
      status: "reviewing",
      createdAt: "2026-05-31T00:00:00.000Z",
      updatedAt: "2026-05-31T00:00:00.000Z"
    };
    const chunk: SourceChunk = { id: "chunk_1", sourceId: "source_1", index: 0, text: "Retrieval practice requires active recall." };
    const queue = buildReviewQueue(
      [
        { ...card, id: "later", dueAt: "2026-06-03T00:00:00.000Z" },
        { ...card, id: "overdue", dueAt: "2026-05-30T00:00:00.000Z" }
      ],
      [source],
      new Date("2026-05-31T12:00:00.000Z"),
      [chunk]
    );

    expect(queue[0].card.id).toBe("overdue");
    expect(queue[0].urgency).toBe("overdue");
    expect(queue[0].source?.id).toBe("source_1");
    expect(queue[0].chunk?.id).toBe("chunk_1");
    expect(queue[1].urgency).toBe("soon");
  });

  it("distinguishes strong extraction from weak source-visible review evidence", () => {
    expect(
      deriveReviewEvidenceStrength({
        answerText: "I explained the mechanism, boundary, and a concrete example from memory.",
        durationMs: 45_000,
        selfRatedEffort: 4,
        sourceVisibleBeforeAnswer: false
      })
    ).toBe("strong");

    expect(
      deriveReviewEvidenceStrength({
        answerText: "I looked first.",
        durationMs: 45_000,
        selfRatedEffort: 4,
        sourceVisibleBeforeAnswer: true
      })
    ).toBe("weak");
  });

  it("turns review, candidate, and explanation evidence into a daily plan", () => {
    const candidate: CardCandidate = {
      id: "cand_1",
      question: "Why does spacing help long-term retention?",
      expectedAnswer: "It creates effortful retrieval over time.",
      sourceQuote: "Spacing supports long-term retention.",
      cardType: "mechanism",
      difficulty: 3,
      tags: ["course", "spacing"],
      sourceChunkId: "chunk_1",
      status: "candidate",
      createdAt: "2026-05-31T00:00:00.000Z"
    };
    const plan = buildDailyPlan({
      cards: [card],
      candidates: [candidate],
      logs,
      explanations: [],
      now: new Date("2026-05-31T12:00:00.000Z")
    });

    expect(plan.dueReviewCount).toBe(1);
    expect(plan.pendingCandidateCount).toBe(1);
    expect(plan.suggestedArea).toBe("review");
    expect(plan.nextBestAction).toContain("到期复习卡");
  });

  it("creates insight snapshots without hiding weak tags or overhead", () => {
    const session: LearningSession = {
      id: "session_1",
      title: "session",
      templateId: "course",
      goal: "practice",
      strategy: "retrieve",
      predictedMinutes: 30,
      actualMinutes: 30,
      completionRating: 4,
      startedAt: "2026-05-31T00:00:00.000Z",
      endedAt: "2026-05-31T00:30:00.000Z"
    };
    const reflection: Reflection = {
      id: "reflection_1",
      sessionId: "session_1",
      worked: "retrieval",
      stuck: "boundary",
      nextChange: "explain the boundary",
      createdAt: "2026-05-31T00:31:00.000Z"
    };
    const explanation: ExplanationAttempt = {
      id: "explain_1",
      concept: "retrieval",
      templateId: "course",
      explanation: "Active recall checks whether memory can produce the answer.",
      rubricScores: { clarity: 4, mechanism: 3, example: 2, boundary: 2, contrast: 2 },
      questions: ["Why?", "Example?", "Boundary?"],
      versionIndex: 1,
      linkedCardIds: [],
      gapTags: ["boundary"],
      createdAt: "2026-05-31T00:32:00.000Z"
    };
    const passiveCheckIn: CheckIn = {
      id: "check_1",
      sessionId: "session_1",
      focusState: "passive",
      understanding: 2,
      createdAt: "2026-05-31T00:15:00.000Z"
    };

    const snapshot = createInsightSnapshot({
      cards: [card, { ...card, id: "card_2", tags: ["spacing"] }],
      logs,
      sessions: [session],
      reflections: [reflection],
      explanations: [explanation],
      checkIns: [passiveCheckIn],
      now: new Date("2026-05-31T12:00:00.000Z")
    });

    expect(snapshot.weeklyCalibratedRetrievals).toBe(2);
    expect(snapshot.metacognitiveOverheadRatio).toBeCloseTo(0.1, 3);
    expect(snapshot.predictionBias).toBe(0);
    expect(snapshot.passiveLearningRisk).toBeGreaterThan(0);
    expect(snapshot.explanationGapTags).toContain("boundary");
    expect(findWeakTags([{ ...card, id: "c1" }], logs)).toContain("retrieval");
    expect(calculatePassiveLearningRisk([{ ...logs[0], evidenceStrength: "weak" }], [session], [passiveCheckIn])).toBeGreaterThan(0);
    expect(calculatePredictionBiasFromSessions([{ ...session, actualMinutes: 45 }])).toBe(0.5);
    expect(calculateTagOverconfidence([card], [{ ...logs[0], cardId: "card_1" }])[0]?.tag).toBe("course");
  });
});
