import { describe, expect, it } from "vitest";
import type { Card, CardCandidate, ExplanationAttempt, LearningEvent, RepairTask, ReviewLog, SourceChunk, SourceDocument } from "@metalearn/core";
import { createInitialFsrsState } from "@metalearn/learning-science";
import {
  buildChunkRecallPrompts,
  buildRepairTaskSummary,
  deriveActiveReadingTrack,
  deriveCalibrationTrend,
  deriveChunkEvidenceSummaries,
  deriveExplanationThreads,
  deriveGettingStartedChecklist,
  deriveInsightEvidenceThresholds,
  deriveInsightActions,
  deriveMaterialDetail,
  deriveReliabilityEvidence,
  deriveScopedInsights,
  deriveStudyViews,
  type WorkspaceState
} from "../apps/metalearn-os/app/workspace-selectors";

const sourceA: SourceDocument = {
  id: "source_a",
  title: "Spacing notes",
  templateId: "course",
  rawText: "Spacing supports long-term retention.",
  status: "reviewing",
  createdAt: "2026-05-31T00:00:00.000Z",
  updatedAt: "2026-05-31T00:00:00.000Z"
};

const sourceB: SourceDocument = {
  ...sourceA,
  id: "source_b",
  title: "Retrieval notes"
};

const chunkA: SourceChunk = {
  id: "chunk_a",
  sourceId: "source_a",
  index: 0,
  text: "Spacing supports long-term retention."
};

const chunkB: SourceChunk = {
  id: "chunk_b",
  sourceId: "source_b",
  index: 0,
  text: "Retrieval practice requires active recall."
};

const chunkC: SourceChunk = {
  id: "chunk_c",
  sourceId: "source_a",
  index: 1,
  text: "Calibration requires learners to predict confidence before feedback."
};

const candidateA: CardCandidate = {
  id: "candidate_a",
  question: "Why does spacing support retention?",
  expectedAnswer: "It creates effortful retrieval over time.",
  sourceQuote: "Spacing supports long-term retention.",
  cardType: "mechanism",
  difficulty: 3,
  tags: ["course", "spacing"],
  sourceChunkId: "chunk_a",
  status: "candidate",
  createdAt: "2026-05-31T00:00:00.000Z"
};

const candidateB: CardCandidate = {
  ...candidateA,
  id: "candidate_b",
  sourceChunkId: "chunk_b",
  sourceQuote: "Retrieval practice requires active recall.",
  tags: ["course", "retrieval"]
};

const cardA: Card = {
  ...candidateA,
  id: "card_a",
  status: "approved",
  dueAt: "2026-06-01T00:00:00.000Z",
  fsrs: createInitialFsrsState()
};

const reviewA: ReviewLog = {
  id: "review_a",
  cardId: "card_a",
  sourceId: "source_a",
  confidence: 5,
  confidenceProbability: 0.9,
  answerText: "wrong",
  outcome: "again",
  isCorrect: false,
  durationMs: 90_000,
  createdAt: "2026-06-01T00:00:00.000Z"
};

function workspaceState(overrides: Partial<WorkspaceState> = {}): WorkspaceState {
  return {
    sources: [sourceA, sourceB],
    chunks: [chunkA, chunkB],
    importJobs: [],
    candidates: [candidateA, candidateB],
    cards: [cardA],
    logs: [reviewA],
    sessions: [],
    checkIns: [],
    reflections: [],
    explanations: [],
    conceptNodes: [],
    conceptEdges: [],
    insights: [],
    aiConfigs: [],
    aiRequestPreviews: [],
    repairTasks: [],
    savedStudyViews: [],
    learningEvents: [],
    ...overrides
  };
}

describe("material detail selector", () => {
  it("scopes candidates, cards, and review evidence to one source", () => {
    const detail = deriveMaterialDetail(workspaceState(), "source_a");

    expect(detail.source?.id).toBe("source_a");
    expect(detail.chunks.map((chunk) => chunk.id)).toEqual(["chunk_a"]);
    expect(detail.pendingCandidates.map((candidate) => candidate.id)).toEqual(["candidate_a"]);
    expect(detail.approvedCards.map((card) => card.id)).toEqual(["card_a"]);
    expect(detail.reviewLogs.map((log) => log.id)).toEqual(["review_a"]);
    expect(detail.recentPerformance.reviewCount).toBe(1);
    expect(detail.recentPerformance.highConfidenceErrorCount).toBe(1);
  });

  it("does not invent a source when the material id is missing", () => {
    const detail = deriveMaterialDetail(workspaceState(), "missing");

    expect(detail.source).toBeUndefined();
    expect(detail.chunks).toHaveLength(0);
    expect(detail.pendingCandidates).toHaveLength(0);
    expect(detail.approvedCards).toHaveLength(0);
  });

  it("surfaces dangling candidates and cards for repair", () => {
    const detail = deriveMaterialDetail(
      workspaceState({
        candidates: [{ ...candidateA, id: "dangling_candidate", sourceChunkId: "chunk_missing" }],
        cards: [{ ...cardA, id: "dangling_card", sourceChunkId: "chunk_missing" }]
      }),
      "source_a"
    );

    expect(detail.danglingCandidates.map((candidate) => candidate.id)).toEqual(["dangling_candidate"]);
    expect(detail.danglingCards.map((card) => card.id)).toEqual(["dangling_card"]);
  });
});

describe("active reading track selector", () => {
  it("prioritizes uncovered chunks before candidate, carded, and reviewed chunks", () => {
    const evidence = deriveChunkEvidenceSummaries([chunkA, chunkC], [candidateA], [cardA], [reviewA]);
    const track = deriveActiveReadingTrack([chunkA, chunkC], evidence);

    expect(track.totalChunks).toBe(2);
    expect(track.coveredCount).toBe(1);
    expect(track.uncoveredCount).toBe(1);
    expect(track.reviewedCount).toBe(1);
    expect(track.nextStep?.chunk.id).toBe("chunk_c");
    expect(track.nextStep?.priority).toBe("create");
    expect(track.nextStep?.actionLabel).toBe("先补一条证据");
  });

  it("moves to candidate review when every chunk has at least a candidate", () => {
    const evidence = deriveChunkEvidenceSummaries([chunkA, chunkC], [candidateA, { ...candidateA, id: "candidate_c", sourceChunkId: "chunk_c", sourceQuote: chunkC.text }], [], []);
    const track = deriveActiveReadingTrack([chunkA, chunkC], evidence);

    expect(track.uncoveredCount).toBe(0);
    expect(track.candidateOnlyCount).toBe(2);
    expect(track.nextStep?.priority).toBe("review_candidate");
  });

  it("builds deterministic recall prompts from the source chunk text", () => {
    const prompts = buildChunkRecallPrompts(chunkC);

    expect(prompts).toHaveLength(3);
    expect(prompts[0]).toContain("不看原文");
    expect(prompts[1]).toContain("Calibration requires learners");
    expect(prompts[2]).toContain("边界条件");
  });
});

describe("explanation thread selector", () => {
  const v1: ExplanationAttempt = {
    id: "explain_1",
    concept: "retrieval",
    templateId: "course",
    explanation: "主动提取是从记忆里回答。",
    versionIndex: 1,
    linkedCardIds: [],
    gapTags: ["example", "boundary"],
    rubricScores: { clarity: 3, mechanism: 2, example: 1, boundary: 1, contrast: 2 },
    questions: ["给一个例子？"],
    createdAt: "2026-06-01T00:00:00.000Z"
  };
  const v2: ExplanationAttempt = {
    ...v1,
    id: "explain_2",
    explanation: "主动提取是先不看材料，从记忆里回答。比如学完概念后先写出机制，因为这样能暴露熟悉感和掌握之间的差距。边界是没有反馈时错误可能被重复。",
    versionIndex: 2,
    parentAttemptId: "explain_1",
    gapTags: ["contrast"],
    priorRubricScores: v1.rubricScores,
    rubricScores: { clarity: 4, mechanism: 4, example: 4, boundary: 3, contrast: 2 },
    questions: ["和重读有什么区别？"],
    createdAt: "2026-06-01T00:05:00.000Z"
  };

  it("builds concept threads with rubric, gap, and text deltas", () => {
    const threads = deriveExplanationThreads([v2, v1]);

    expect(threads).toHaveLength(1);
    expect(threads[0].concept).toBe("retrieval");
    expect(threads[0].versions).toHaveLength(2);
    expect(threads[0].latest.attempt.id).toBe("explain_2");
    expect(threads[0].latest.scoreDelta).toBeGreaterThan(1);
    expect(threads[0].latest.improvedRubricKeys).toEqual(["clarity", "mechanism", "example", "boundary"]);
    expect(threads[0].latest.resolvedGapTags).toEqual(["example", "boundary"]);
    expect(threads[0].latest.newGapTags).toEqual(["contrast"]);
    expect(threads[0].latest.textDelta.addedSignals).toContain("例子");
    expect(threads[0].latest.textDelta.addedSignals).toContain("边界");
  });
});

describe("calibration insight evidence selectors", () => {
  const logs: ReviewLog[] = [
    { ...reviewA, id: "review_1", confidence: 5, confidenceProbability: 0.9, isCorrect: false, outcome: "again", createdAt: "2026-06-01T09:00:00.000Z" },
    { ...reviewA, id: "review_2", confidence: 5, confidenceProbability: 0.9, isCorrect: true, outcome: "correct", createdAt: "2026-06-01T10:00:00.000Z" },
    { ...reviewA, id: "review_3", confidence: 5, confidenceProbability: 0.9, isCorrect: false, outcome: "again", createdAt: "2026-06-01T11:00:00.000Z" },
    { ...reviewA, id: "review_4", confidence: 3, confidenceProbability: 0.5, isCorrect: true, outcome: "correct", createdAt: "2026-06-02T09:00:00.000Z" },
    { ...reviewA, id: "review_5", confidence: 3, confidenceProbability: 0.5, isCorrect: false, outcome: "again", createdAt: "2026-06-02T10:00:00.000Z" },
    { ...reviewA, id: "review_6", confidence: 3, confidenceProbability: 0.5, isCorrect: true, outcome: "correct", createdAt: "2026-06-02T11:00:00.000Z" },
    { ...reviewA, id: "review_7", confidence: 4, confidenceProbability: 0.7, isCorrect: true, outcome: "correct", createdAt: "2026-06-03T09:00:00.000Z" },
    { ...reviewA, id: "review_8", confidence: 4, confidenceProbability: 0.7, isCorrect: true, outcome: "correct", createdAt: "2026-06-03T10:00:00.000Z" }
  ];

  it("groups Brier trend by review date", () => {
    const trend = deriveCalibrationTrend(logs);

    expect(trend.map((point) => point.date)).toEqual(["2026-06-01", "2026-06-02", "2026-06-03"]);
    expect(trend[0].reviewCount).toBe(3);
    expect(trend[0].highConfidenceErrorRate).toBeCloseTo(0.667, 3);
    expect(trend[1].accuracy).toBeCloseTo(0.667, 3);
  });

  it("marks reliability buckets as empty, thin, or enough", () => {
    const reliability = deriveReliabilityEvidence(logs);

    expect(reliability.find((bucket) => bucket.confidence === 5)?.status).toBe("enough");
    expect(reliability.find((bucket) => bucket.confidence === 4)?.status).toBe("thin");
    expect(reliability.find((bucket) => bucket.confidence === 2)?.status).toBe("empty");
    expect(reliability.find((bucket) => bucket.confidence === 5)?.gap).toBeLessThan(0);
  });

  it("requires enough evidence before treating trends and reliability as readable", () => {
    const thinThresholds = deriveInsightEvidenceThresholds([reviewA]);
    const enoughThresholds = deriveInsightEvidenceThresholds(logs);

    expect(thinThresholds.enoughForTrend).toBe(false);
    expect(thinThresholds.enoughForReliability).toBe(false);
    expect(thinThresholds.message).toContain("证据不足");
    expect(enoughThresholds.enoughForTrend).toBe(true);
    expect(enoughThresholds.enoughForReliability).toBe(true);
    expect(enoughThresholds.reliabilityEnoughBucketCount).toBe(2);
  });
});

describe("scoped insight selectors", () => {
  it("derives material, tag, and concept drilldowns with evidence status and action links", () => {
    const repairTask: RepairTask = {
      id: "repair_1",
      reviewLogId: "review_a",
      cardId: "card_a",
      sourceId: "source_a",
      sourceChunkId: "chunk_a",
      status: "open",
      reason: "not_retrieved",
      confidence: 5,
      outcome: "again",
      tagSnapshot: ["course", "spacing"],
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
      linkedRemedialCandidateIds: []
    };
    const v1: ExplanationAttempt = {
      id: "explain_1",
      concept: "spacing",
      templateId: "course",
      explanation: "Spacing means reviewing later.",
      versionIndex: 1,
      linkedCardIds: ["card_a"],
      gapTags: ["mechanism"],
      rubricScores: { clarity: 3, mechanism: 2, example: 2, boundary: 2, contrast: 2 },
      questions: [],
      createdAt: "2026-06-01T00:00:00.000Z"
    };
    const insights = deriveScopedInsights(workspaceState({ repairTasks: [repairTask], explanations: [v1] }));

    expect(insights.materials[0].label).toBe("Spacing notes");
    expect(insights.materials[0].status).toBe("thin");
    expect(insights.materials[0].href).toBe("/review/mistakes?sourceId=source_a");
    expect(insights.materials[0].summary).toContain("样本偏薄");

    const spacing = insights.tags.find((item) => item.label === "spacing");
    expect(spacing?.status).toBe("thin");
    expect(spacing?.href).toBe("/review/mistakes?tag=spacing");
    expect(spacing?.detailChips).toContain("1 修复");

    expect(insights.concepts[0].label).toBe("spacing");
    expect(insights.concepts[0].status).toBe("thin");
    expect(insights.concepts[0].href).toBe("/explain?concept=spacing");
    expect(insights.concepts[0].summary).toContain("v2");
  });

  it("builds study views from repair, review, candidate, and scoped evidence", () => {
    const repairTask: RepairTask = {
      id: "repair_1",
      reviewLogId: "review_a",
      cardId: "card_a",
      sourceId: "source_a",
      sourceChunkId: "chunk_a",
      status: "open",
      reason: "not_retrieved",
      confidence: 5,
      outcome: "again",
      tagSnapshot: ["course", "spacing"],
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
      linkedRemedialCandidateIds: []
    };
    const scopedInsights = deriveScopedInsights(workspaceState({ repairTasks: [repairTask] }));
    const views = deriveStudyViews({
      dueCards: [cardA],
      pendingCandidates: [candidateA],
      repairTaskSummary: buildRepairTaskSummary([repairTask]),
      scopedInsights,
      sources: [sourceA]
    });

    expect(views.map((view) => view.id)).toContain("repair-open");
    expect(views.map((view) => view.id)).toContain("review-due");
    expect(views.map((view) => view.id)).toContain("candidate-review");
    expect(views.some((view) => view.scopeLabel === "tag" && (view.href.includes("/review?tag=") || view.href.includes("/review/mistakes?tag=")))).toBe(true);
    expect(views[0].priority).toBe("high");
  });
});

describe("getting started checklist selector", () => {
  it("starts with material import when the workspace has no local evidence", () => {
    const checklist = deriveGettingStartedChecklist(
      workspaceState({
        sources: [],
        chunks: [],
        candidates: [],
        cards: [],
        logs: [],
        repairTasks: [],
        learningEvents: []
      }),
      buildRepairTaskSummary([])
    );

    expect(checklist.map((step) => step.id)).toEqual(["import_material", "create_source_cards", "first_review", "repair_mistakes", "backup_data"]);
    expect(checklist[0]).toMatchObject({ status: "active", href: "/library#material-import" });
    expect(checklist.find((step) => step.id === "create_source_cards")?.status).toBe("locked");
    expect(checklist.find((step) => step.id === "repair_mistakes")?.status).toBe("optional");
  });

  it("points users to candidate review before treating generated cards as learning evidence", () => {
    const checklist = deriveGettingStartedChecklist(
      workspaceState({
        sources: [sourceA],
        chunks: [chunkA],
        candidates: [candidateA],
        cards: [],
        logs: []
      }),
      buildRepairTaskSummary([])
    );

    expect(checklist.find((step) => step.id === "import_material")).toMatchObject({ status: "done", metric: "1 份材料" });
    expect(checklist.find((step) => step.id === "create_source_cards")).toMatchObject({
      status: "active",
      href: "/library#candidate-review",
      actionLabel: "审核候选题",
      metric: "1 张待审"
    });
    expect(checklist.find((step) => step.id === "first_review")?.status).toBe("locked");
  });

  it("marks review, repair, and backup progress from durable local records", () => {
    const exportEvent: LearningEvent = {
      id: "event_exported",
      appId: "metalearn-os",
      actionType: "data_exported",
      outcome: "exported",
      createdAt: "2026-06-03T00:00:00.000Z"
    };
    const repairTask: RepairTask = {
      id: "repair_open",
      reviewLogId: "review_a",
      cardId: "card_a",
      sourceId: "source_a",
      sourceChunkId: "chunk_a",
      status: "open",
      reason: "not_retrieved",
      confidence: 5,
      outcome: "again",
      tagSnapshot: ["course", "spacing"],
      createdAt: "2026-06-03T00:00:00.000Z",
      updatedAt: "2026-06-03T00:00:00.000Z",
      linkedRemedialCandidateIds: []
    };
    const checklist = deriveGettingStartedChecklist(
      workspaceState({
        sources: [sourceA],
        chunks: [chunkA],
        candidates: [],
        cards: [cardA],
        logs: [reviewA],
        repairTasks: [repairTask],
        learningEvents: [exportEvent]
      }),
      buildRepairTaskSummary([repairTask])
    );

    expect(checklist.find((step) => step.id === "create_source_cards")).toMatchObject({ status: "done", metric: "1 张卡片" });
    expect(checklist.find((step) => step.id === "first_review")).toMatchObject({ status: "done", metric: "1 次复习" });
    expect(checklist.find((step) => step.id === "repair_mistakes")).toMatchObject({ status: "active", metric: "1 个待修复" });
    expect(checklist.find((step) => step.id === "backup_data")).toMatchObject({ status: "done", metric: "已导出" });
  });
});

describe("insight action selector", () => {
  const repairTask: RepairTask = {
    id: "repair_1",
    reviewLogId: "review_a",
    cardId: "card_a",
    sourceId: "source_a",
    sourceChunkId: "chunk_a",
    status: "open",
    reason: "not_retrieved",
    confidence: 5,
    outcome: "again",
    tagSnapshot: ["course", "spacing"],
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    linkedRemedialCandidateIds: []
  };

  it("prioritizes repair, due review, candidate review, and weak explanation actions", () => {
    const weakExplanation: ExplanationAttempt = {
      id: "explain_weak",
      concept: "spacing",
      templateId: "course",
      explanation: "Spacing is useful.",
      versionIndex: 1,
      linkedCardIds: [],
      gapTags: ["mechanism"],
      rubricScores: { clarity: 3, mechanism: 2, example: 2, boundary: 2, contrast: 2 },
      questions: [],
      createdAt: "2026-06-01T00:00:00.000Z"
    };
    const actions = deriveInsightActions({
      dueCards: [cardA],
      pendingCandidates: [candidateA],
      repairTaskSummary: buildRepairTaskSummary([repairTask]),
      explanationThreads: deriveExplanationThreads([weakExplanation]),
      sources: [sourceA]
    });

    expect(actions.map((action) => action.id)).toEqual([
      "repair-high-confidence-errors",
      "review-due-cards",
      "approve-candidates",
      "revise-explanation-spacing"
    ]);
    expect(actions[0].priority).toBe("high");
    expect(actions[3].detail).toContain("机制");
  });

  it("falls back to importing material when there is no evidence", () => {
    const actions = deriveInsightActions({
      dueCards: [],
      pendingCandidates: [],
      repairTaskSummary: buildRepairTaskSummary([]),
      explanationThreads: [],
      sources: []
    });

    expect(actions).toHaveLength(1);
    expect(actions[0].href).toBe("/library");
    expect(actions[0].evidenceLabel).toBe("证据不足");
  });
});
