import { describe, expect, it } from "vitest";
import type { Card, CardCandidate, RepairTask, ReviewLog, SourceChunk, SourceDocument } from "@metalearn/core";
import { createInitialFsrsState } from "@metalearn/learning-science";
import {
  createExportManifest,
  createImportPreview,
  emptyImportPayload,
  parseImportPackage,
  planImport,
  serializeExportPackage
} from "@metalearn/storage";

const source: SourceDocument = {
  id: "source_1",
  title: "Spacing notes",
  templateId: "course",
  rawText: "Spacing supports long-term retention.",
  status: "reviewing",
  createdAt: "2026-05-31T00:00:00.000Z",
  updatedAt: "2026-05-31T00:00:00.000Z"
};

const chunk: SourceChunk = {
  id: "chunk_1",
  sourceId: "source_1",
  index: 0,
  text: "Spacing supports long-term retention."
};

const candidate: CardCandidate = {
  id: "candidate_1",
  question: "Why does spacing support retention?",
  expectedAnswer: "It creates effortful retrieval over time.",
  sourceQuote: "Spacing supports long-term retention.",
  cardType: "mechanism",
  difficulty: 3,
  tags: ["course", "spacing"],
  sourceChunkId: "chunk_1",
  status: "candidate",
  createdAt: "2026-05-31T00:00:00.000Z"
};

const card: Card = {
  ...candidate,
  id: "card_1",
  status: "approved",
  dueAt: "2026-06-01T00:00:00.000Z",
  fsrs: createInitialFsrsState()
};

const review: ReviewLog = {
  id: "review_1",
  cardId: "card_1",
  sourceId: "missing_source",
  confidence: 4,
  confidenceProbability: 0.7,
  answerText: "Spacing helps because it creates effortful retrieval.",
  outcome: "correct",
  isCorrect: true,
  durationMs: 60_000,
  createdAt: "2026-06-01T00:00:00.000Z"
};

const repairTask: RepairTask = {
  id: "repair_1",
  reviewLogId: "review_1",
  cardId: "card_1",
  sourceId: "source_1",
  sourceChunkId: "chunk_1",
  status: "open",
  reason: "not_retrieved",
  confidence: 4,
  outcome: "partial",
  tagSnapshot: ["course", "spacing"],
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
  linkedRemedialCandidateIds: []
};

function fullPackage(overrides: Record<string, unknown> = {}) {
  const payload = {
    materials: [source],
    chunks: [chunk],
    importJobs: [],
    candidates: [candidate],
    cards: [card],
    reviews: [review],
    explanations: [],
    conceptNodes: [],
    conceptEdges: [],
    sessions: [],
    checkIns: [],
    reflections: [],
    insights: [],
    aiRequestPreviews: [],
    repairTasks: [repairTask],
    ...overrides
  };
  return serializeExportPackage(payload, createExportManifest(payload));
}

describe("JSON import packages", () => {
  it("parses full backup packages and material packages", () => {
    const full = parseImportPackage(fullPackage());
    expect(full.ok).toBe(true);
    if (full.ok) expect(full.package.kind).toBe("full_backup");

    const material = parseImportPackage(serializeExportPackage({ materials: [source], chunks: [chunk], candidates: [candidate], cards: [card], reviews: [review], explanations: [] }));
    expect(material.ok).toBe(true);
    if (material.ok) expect(material.package.kind).toBe("material_package");
  });

  it("rejects invalid JSON, missing schema, and unsupported schema", () => {
    expect(parseImportPackage("{").ok).toBe(false);
    expect(parseImportPackage(JSON.stringify({ payload: {} })).ok).toBe(false);
    const unsupported = parseImportPackage(JSON.stringify({ schemaVersion: 99, payload: { materials: [source] } }));
    expect(unsupported.ok).toBe(true);
    if (unsupported.ok) {
      const preview = createImportPreview(unsupported.package);
      expect(preview.canImport).toBe(false);
      expect(preview.fatalProblems.some((item) => item.code === "unsupported_schema")).toBe(true);
    }
  });

  it("warns when manifest counts do not match payload counts", () => {
    const parsed = parseImportPackage(serializeExportPackage({ materials: [source], chunks: [chunk] }, { ...createExportManifest({ materials: [source], chunks: [chunk] }), counts: { ...createExportManifest({}).counts, materials: 9 } }));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const preview = createImportPreview(parsed.package);
      expect(preview.warnings.some((item) => item.code === "manifest_count_mismatch")).toBe(true);
    }
  });

  it("blocks dangling references and invalid source evidence", () => {
    const missingSource = parseImportPackage(fullPackage({ chunks: [{ ...chunk, sourceId: "missing" }] }));
    expect(missingSource.ok).toBe(true);
    if (missingSource.ok) expect(createImportPreview(missingSource.package).fatalProblems.some((item) => item.code === "missing_source")).toBe(true);

    const missingChunk = parseImportPackage(fullPackage({ cards: [{ ...card, sourceChunkId: "missing_chunk" }] }));
    expect(missingChunk.ok).toBe(true);
    if (missingChunk.ok) expect(createImportPreview(missingChunk.package).fatalProblems.some((item) => item.code === "invalid_card_evidence")).toBe(true);

    const badQuote = parseImportPackage(fullPackage({ cards: [{ ...card, sourceQuote: "This quote is not in the chunk." }] }));
    expect(badQuote.ok).toBe(true);
    if (badQuote.ok) expect(createImportPreview(badQuote.package).fatalProblems.some((item) => item.code === "invalid_card_evidence")).toBe(true);
  });

  it("repairs review source ids when they can be derived from the card", () => {
    const parsed = parseImportPackage(fullPackage());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const preview = createImportPreview(parsed.package);
    expect(preview.repaired.some((item) => item.code === "repair_review_source")).toBe(true);
    const plan = planImport(parsed.package);
    expect(plan.inserts.reviews[0].sourceId).toBe("source_1");
  });

  it("imports v3 packages with empty repair tasks", () => {
    const v3 = JSON.stringify({
      schemaVersion: 3,
      payload: { materials: [source], chunks: [chunk], candidates: [candidate], cards: [card], reviews: [review] }
    });
    const parsed = parseImportPackage(v3);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.package.payload.repairTasks).toEqual([]);
      expect(createImportPreview(parsed.package).canImport).toBe(true);
    }
  });

  it("keeps both copies by remapping conflicting ids without mutating the package", () => {
    const parsed = parseImportPackage(fullPackage());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const before = JSON.stringify(parsed.package.payload);
    const current = { ...emptyImportPayload(), materials: [source], chunks: [chunk], cards: [card], reviews: [review] };
    const plan = planImport(parsed.package, current, "keep_both");

    expect(plan.preview.conflicts.length).toBeGreaterThan(0);
    expect(plan.inserts.materials[0].id).not.toBe("source_1");
    expect(plan.inserts.chunks[0].sourceId).toBe(plan.inserts.materials[0].id);
    expect(plan.inserts.cards[0].sourceChunkId).toBe(plan.inserts.chunks[0].id);
    expect(plan.inserts.reviews[0].cardId).toBe(plan.inserts.cards[0].id);
    expect(plan.inserts.repairTasks[0].cardId).toBe(plan.inserts.cards[0].id);
    expect(plan.inserts.repairTasks[0].reviewLogId).toBe(plan.inserts.reviews[0].id);
    expect(JSON.stringify(parsed.package.payload)).toBe(before);
  });

  it("skips duplicate sources and dependent rows", () => {
    const parsed = parseImportPackage(fullPackage());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const current = { ...emptyImportPayload(), materials: [source] };
    const plan = planImport(parsed.package, current, "skip_duplicates");

    expect(plan.inserts.materials).toHaveLength(0);
    expect(plan.inserts.chunks).toHaveLength(0);
    expect(plan.inserts.cards).toHaveLength(0);
    expect(plan.inserts.repairTasks).toHaveLength(0);
    expect(plan.skipped.length).toBeGreaterThan(0);
  });

  it("blocks repair tasks with missing core references", () => {
    const parsed = parseImportPackage(fullPackage({ repairTasks: [{ ...repairTask, reviewLogId: "missing_review" }] }));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(createImportPreview(parsed.package).fatalProblems.some((item) => item.code === "missing_repair_review")).toBe(true);
  });
});
