import { describe, expect, it } from "vitest";
import type { Card, CardCandidate, ReviewLog, SourceChunk, SourceDocument } from "@metalearn/core";
import { createInitialFsrsState } from "@metalearn/learning-science";
import {
  buildChunkRecallPrompts,
  deriveActiveReadingTrack,
  deriveChunkEvidenceSummaries,
  deriveMaterialDetail,
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
