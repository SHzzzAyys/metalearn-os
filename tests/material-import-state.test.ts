import { describe, expect, it } from "vitest";
import type { AIRequestPreview, CardCandidate, SourceChunk, SourceDocument } from "@metalearn/core";
import {
  analyzeMaterialTextQuality,
  createMaterialImportDraft,
  deriveCandidateGenerationDiagnostic
} from "../apps/metalearn-os/app/material-import-state";

const source: SourceDocument = {
  id: "source_1",
  title: "Retrieval notes",
  templateId: "course",
  inputType: "plain_text",
  rawText: "Active retrieval should happen before checking source evidence.",
  status: "chunked",
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z"
};

const chunk: SourceChunk = {
  id: "chunk_1",
  sourceId: "source_1",
  index: 0,
  text: "Active retrieval should happen before checking source evidence."
};

const candidate: CardCandidate = {
  id: "candidate_1",
  question: "What should happen before checking source evidence?",
  expectedAnswer: "Active retrieval.",
  sourceQuote: "Active retrieval should happen before checking source evidence.",
  cardType: "definition",
  difficulty: 2,
  tags: ["course", "retrieval"],
  sourceChunkId: "chunk_1",
  status: "candidate",
  createdAt: "2026-06-01T00:00:00.000Z"
};

const pendingPreview: AIRequestPreview = {
  id: "preview_1",
  kind: "generate_cards",
  providerMode: "local_mock",
  providerName: "Local mock",
  modelName: "schema-checked-fallback",
  sourceId: "source_1",
  chunkIds: ["chunk_1"],
  chunkCount: 1,
  payloadSummary: "1 chunk",
  status: "pending_confirmation",
  createdAt: "2026-06-01T00:00:00.000Z"
};

function diagnostic(overrides: Partial<Parameters<typeof deriveCandidateGenerationDiagnostic>[0]> = {}) {
  const currentText = overrides.currentText ?? "";
  const draft =
    overrides.draft ??
    createMaterialImportDraft({
      title: "Retrieval notes",
      inputType: "plain_text",
      textLength: currentText.length
    });
  return deriveCandidateGenerationDiagnostic({
    currentText,
    draft,
    sources: [],
    chunks: [],
    previews: [],
    candidates: [],
    quality: analyzeMaterialTextQuality(currentText),
    ...overrides
  });
}

describe("material text quality", () => {
  it("allows normal learning text", () => {
    const quality = analyzeMaterialTextQuality("Active retrieval should happen before checking source evidence. Confidence should be rated first.");

    expect(quality.blockingError).toBeUndefined();
    expect(quality.chunkEstimate).toBe(1);
    expect(quality.charCount).toBeGreaterThan(40);
  });

  it("blocks very short text", () => {
    const quality = analyzeMaterialTextQuality("Too short.");

    expect(quality.blockingError).toContain("40 个字符");
    expect(quality.chunkEstimate).toBe(0);
  });

  it("warns when a multi-page PDF has very little text", () => {
    const quality = analyzeMaterialTextQuality("This PDF has almost no readable text but enough chars.", 3);

    expect(quality.warnings.join("\n")).toContain("可能是扫描件");
  });

  it("warns about garbled extraction", () => {
    const quality = analyzeMaterialTextQuality("Active retrieval evidence ".repeat(3) + "��������");

    expect(quality.warnings.join("\n")).toContain("乱码");
  });
});

describe("candidate generation diagnostic", () => {
  it("asks the user to read or paste material when text is empty", () => {
    expect(diagnostic().nextAction).toBe("read_file");
  });

  it("does not let an unsaved file be hidden by older materials", () => {
    const draft = createMaterialImportDraft({
      stage: "text_ready",
      title: "Unsaved PDF",
      inputType: "pdf_text",
      textLength: 80
    });

    const result = diagnostic({
      currentText: "Unsaved PDF text that is long enough to pass the local quality check.",
      draft,
      sources: [source],
      chunks: [chunk]
    });

    expect(result.nextAction).toBe("save_source");
    expect(result.blockingReason).toContain("还没有保存为材料");
  });

  it("reports saved materials without chunks as blocked", () => {
    const result = diagnostic({
      currentText: source.rawText,
      draft: createMaterialImportDraft({ title: source.title, inputType: "plain_text", textLength: source.rawText.length }),
      sources: [source],
      chunks: []
    });

    expect(result.nextAction).toBe("manual_card");
    expect(result.blockingReason).toContain("没有可用来源片段");
  });

  it("routes pending previews to confirmation", () => {
    const result = diagnostic({
      currentText: source.rawText,
      sources: [source],
      chunks: [chunk],
      previews: [pendingPreview]
    });

    expect(result.nextAction).toBe("confirm_preview");
    expect(result.lastPreviewStatus).toBe("pending_confirmation");
  });

  it("routes existing candidates to the review bench", () => {
    const result = diagnostic({
      currentText: source.rawText,
      sources: [source],
      chunks: [chunk],
      candidates: [candidate]
    });

    expect(result.nextAction).toBe("review_candidates");
    expect(result.pendingCandidateCount).toBe(1);
  });

  it("routes failed AI previews to manual card creation", () => {
    const result = diagnostic({
      currentText: source.rawText,
      sources: [source],
      chunks: [chunk],
      previews: [{ ...pendingPreview, status: "failed", error: "AI provider failed." }]
    });

    expect(result.nextAction).toBe("manual_card");
    expect(result.blockingReason).toBe("AI provider failed.");
  });
});
