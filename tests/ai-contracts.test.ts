import { describe, expect, it } from "vitest";
import {
  aiRequestPreviewSchema,
  buildAIRequestPreview,
  cardCandidateListSchema,
  classifyMistakeReason,
  generateFallbackCardCandidates,
  generateFallbackSocraticQuestions,
  socraticResponseSchema,
  summarizeWeeklyReport,
  weeklySummarySchema
} from "@metalearn/ai";

describe("AI contracts", () => {
  it("builds a reviewable upload preview before card generation", () => {
    const preview = buildAIRequestPreview({
      id: "preview_1",
      kind: "generate_cards",
      sourceId: "source_1",
      createdAt: new Date("2026-05-31T00:00:00.000Z"),
      chunks: [
        {
          id: "chunk_1",
          sourceId: "source_1",
          index: 0,
          text: "提取练习要求学习者主动从记忆中取回答案，而不是只重读材料。"
        }
      ]
    });

    const parsed = aiRequestPreviewSchema.parse(preview);
    expect(parsed.status).toBe("pending_confirmation");
    expect(parsed.providerMode).toBe("local_mock");
    expect(parsed.chunkCount).toBe(1);
    expect(parsed.payloadSummary).toContain("提取练习");
  });

  it("generates source-grounded candidate cards", () => {
    const candidates = generateFallbackCardCandidates({
      templateId: "paper",
      requestedCount: 3,
      chunks: [
        {
          id: "chunk_1",
          sourceId: "source_1",
          index: 0,
          text: "提取练习要求学习者主动从记忆中取回答案，而不是只重读材料。信心校准关注预测与实际结果之间的差距。"
        }
      ]
    });

    expect(cardCandidateListSchema.parse(candidates)).toHaveLength(3);
    expect(candidates.every((candidate) => candidate.sourceQuote.length > 0)).toBe(true);
    expect(candidates.every((candidate) => candidate.status === "candidate")).toBe(true);
  });

  it("generates exactly three Socratic questions without answers", () => {
    const result = generateFallbackSocraticQuestions({
      concept: "间隔效应",
      templateId: "course",
      explanation: "间隔效应因为多次主动提取而强化记忆。比如今天、明天和三天后复习。"
    });

    const parsed = socraticResponseSchema.parse(result);
    expect(parsed.questions).toHaveLength(3);
    expect(parsed.rubricScores.mechanism).toBeGreaterThanOrEqual(4);
  });

  it("classifies likely mistake reasons without acting as a fact judge", () => {
    expect(classifyMistakeReason("", "The result depends on a boundary condition.")).toBe("not_retrieved");
    expect(classifyMistakeReason("我把两个概念混淆了", "The concepts differ in mechanism.")).toBe("confused_concepts");
    expect(classifyMistakeReason("这是一个定义，没有说明为什么", "The process depends on a boundary condition.")).toBe("weak_mechanism");
  });

  it("summarizes weekly reports as structured, reviewable output", () => {
    const summary = summarizeWeeklyReport({
      weakTags: ["spacing"],
      recommendation: "优先复盘高信心错误。",
      logs: [
        {
          id: "review_1",
          cardId: "card_1",
          sourceId: "source_1",
          confidence: 5,
          confidenceProbability: 0.9,
          answerText: "wrong",
          outcome: "again",
          isCorrect: false,
          durationMs: 1000,
          createdAt: "2026-05-31T00:00:00.000Z"
        }
      ]
    });

    expect(weeklySummarySchema.parse(summary).headline).toContain("1 次校准提取");
    expect(summary.risk).toContain("高信心错误");
  });
});
