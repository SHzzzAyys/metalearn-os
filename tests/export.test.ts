import { describe, expect, it } from "vitest";
import type { Card, CardCandidate, SourceChunk, SourceDocument } from "@metalearn/core";
import { buildStudyAssets, cardsToCsv, candidatesToAnkiTsv, createExportManifest, serializeExportPackage, validateCardCandidateEvidence } from "@metalearn/storage";
import { createInitialFsrsState } from "@metalearn/learning-science";

const card: Card = {
  id: "card_1",
  question: "Why does spacing help?",
  expectedAnswer: "It creates effortful retrieval over time.",
  sourceQuote: "Spacing supports long-term retention.",
  cardType: "mechanism",
  difficulty: 3,
  tags: ["course", "spacing"],
  sourceChunkId: "chunk_1",
  status: "approved",
  createdAt: "2026-05-31T00:00:00.000Z",
  dueAt: "2026-06-01T00:00:00.000Z",
  fsrs: createInitialFsrsState()
};

const source: SourceDocument = {
  id: "source_1",
  title: "Spacing notes",
  templateId: "course",
  rawText: "Spacing supports long-term retention.",
  status: "reviewing",
  summary: "Spacing supports long-term retention.",
  candidateCount: 2,
  approvedCardCount: 1,
  explanationCount: 0,
  lastWorkedAt: "2026-05-31T00:00:00.000Z",
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

describe("exports", () => {
  it("serializes export packages with schema v4 manifest metadata", () => {
    const manifest = createExportManifest({ materials: [source], cards: [card], reviews: [{}], aiRequestPreviews: [{}], repairTasks: [{}] });
    const parsed = JSON.parse(serializeExportPackage({ cards: [card] }, manifest)) as {
      version: number;
      schemaVersion: number;
      manifest: ReturnType<typeof createExportManifest>;
      payload: { cards: Card[] };
    };

    expect(parsed.version).toBe(4);
    expect(parsed.schemaVersion).toBe(4);
    expect(parsed.manifest.schemaVersion).toBe(4);
    expect(parsed.manifest.counts.materials).toBe(1);
    expect(parsed.manifest.counts.cards).toBe(1);
    expect(parsed.manifest.counts.reviews).toBe(1);
    expect(parsed.manifest.counts.repairTasks).toBe(1);
    expect(parsed.manifest.includesAIRequestRecords).toBe(true);
    expect(parsed.payload.cards[0].id).toBe("card_1");
  });

  it("exports cards as CSV and Anki TSV", () => {
    expect(cardsToCsv([card])).toContain('"Why does spacing help?"');
    expect(candidatesToAnkiTsv([card])).toContain("Why does spacing help?\tIt creates effortful retrieval over time.");
  });

  it("builds a unified asset list for the MetaLearn OS library", () => {
    const assets = buildStudyAssets({ sources: [source], chunks: [chunk], candidates: [], cards: [card], explanations: [] });

    expect(assets.map((asset) => asset.kind)).toEqual(["material", "card"]);
    expect(assets[0].statusLabel).toBe("reviewing");
    expect(assets[0].href).toBe("/library/source_1");
    expect(assets[1].href).toBe("/library/source_1");
  });

  it("rejects candidates that are not traceable to a source chunk", () => {
    expect(validateCardCandidateEvidence(candidate, [chunk]).ok).toBe(true);
    expect(validateCardCandidateEvidence({ ...candidate, sourceQuote: "" }, [chunk]).ok).toBe(false);
    expect(validateCardCandidateEvidence({ ...candidate, sourceChunkId: "" }, [chunk]).ok).toBe(false);
    expect(validateCardCandidateEvidence({ ...candidate, sourceChunkId: "missing" }, [chunk]).ok).toBe(false);
    expect(validateCardCandidateEvidence({ ...candidate, sourceQuote: "Not from this source." }, [chunk]).ok).toBe(false);
    expect(validateCardCandidateEvidence({ ...candidate, tags: [] }, [chunk]).ok).toBe(false);
  });
});
