import { describe, expect, it } from "vitest";
import type { Card, SourceDocument } from "@metalearn/core";
import { buildStudyAssets, cardsToCsv, candidatesToAnkiTsv, createExportManifest, serializeExportPackage } from "@metalearn/storage";
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

describe("exports", () => {
  it("serializes export packages with schema v3 manifest metadata", () => {
    const manifest = createExportManifest({ materials: [source], cards: [card], reviews: [{}], aiRequestPreviews: [{}] });
    const parsed = JSON.parse(serializeExportPackage({ cards: [card] }, manifest)) as {
      version: number;
      schemaVersion: number;
      manifest: ReturnType<typeof createExportManifest>;
      payload: { cards: Card[] };
    };

    expect(parsed.version).toBe(3);
    expect(parsed.schemaVersion).toBe(3);
    expect(parsed.manifest.schemaVersion).toBe(3);
    expect(parsed.manifest.counts.materials).toBe(1);
    expect(parsed.manifest.counts.cards).toBe(1);
    expect(parsed.manifest.counts.reviews).toBe(1);
    expect(parsed.manifest.includesAIRequestRecords).toBe(true);
    expect(parsed.payload.cards[0].id).toBe("card_1");
  });

  it("exports cards as CSV and Anki TSV", () => {
    expect(cardsToCsv([card])).toContain('"Why does spacing help?"');
    expect(candidatesToAnkiTsv([card])).toContain("Why does spacing help?\tIt creates effortful retrieval over time.");
  });

  it("builds a unified asset list for the MetaLearn OS library", () => {
    const assets = buildStudyAssets({ sources: [source], candidates: [], cards: [card], explanations: [] });

    expect(assets.map((asset) => asset.kind)).toEqual(["material", "card"]);
    expect(assets[0].statusLabel).toBe("reviewing");
    expect(assets[1].href).toBe("/review");
  });
});
