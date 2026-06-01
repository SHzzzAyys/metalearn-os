import type { AIProviderConfig, AIRequestKind, AIRequestPreview, CardCandidate, CardType, ExplanationAttempt, LearningTemplateId, MistakeReason, ReviewLog, SourceChunk } from "@metalearn/core";
import { getTemplate } from "@metalearn/core";
import { z } from "zod";

export const cardCandidateSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(12),
  expectedAnswer: z.string().min(8),
  sourceQuote: z.string().min(8),
  cardType: z.enum(["definition", "mechanism", "comparison", "application", "counterexample", "experiment", "cloze"]),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  tags: z.array(z.string().min(1)).min(1),
  sourceChunkId: z.string().min(1),
  status: z.literal("candidate"),
  createdAt: z.string().datetime()
});

export const cardCandidateListSchema = z.array(cardCandidateSchema).min(1);

export const socraticResponseSchema = z.object({
  questions: z.array(z.string().min(8)).length(3),
  rubricScores: z.object({
    clarity: z.number().min(1).max(5),
    mechanism: z.number().min(1).max(5),
    example: z.number().min(1).max(5),
    boundary: z.number().min(1).max(5),
    contrast: z.number().min(1).max(5)
  })
});

export const weeklySummarySchema = z.object({
  headline: z.string().min(6),
  recommendation: z.string().min(8),
  risk: z.string().min(6)
});

export const aiRequestPreviewSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["generate_cards", "socratic_questions", "weekly_report"]),
  providerMode: z.enum(["local_mock", "server_env", "custom_endpoint"]),
  providerName: z.string().min(1),
  modelName: z.string().min(1),
  sourceId: z.string().optional(),
  chunkIds: z.array(z.string()),
  chunkCount: z.number().int().min(0),
  payloadSummary: z.string().min(1),
  status: z.enum(["pending_confirmation", "confirmed", "completed", "cancelled", "failed"]),
  createdAt: z.string().datetime(),
  confirmedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  error: z.string().optional()
});

export interface GenerateCardsInput {
  chunks: SourceChunk[];
  templateId: LearningTemplateId;
  requestedCount?: number;
}

export interface SocraticQuestionsInput {
  concept: string;
  explanation: string;
  templateId: LearningTemplateId;
}

export function buildAIRequestPreview(input: {
  id: string;
  kind: AIRequestKind;
  chunks?: SourceChunk[];
  sourceId?: string;
  provider?: AIProviderConfig;
  createdAt?: Date;
}): AIRequestPreview {
  const chunks = input.chunks ?? [];
  const provider = input.provider ?? {
    id: "local_mock",
    mode: "local_mock",
    providerName: "Local mock",
    modelName: "schema-checked-fallback",
    apiKeyStoredLocally: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const preview: AIRequestPreview = {
    id: input.id,
    kind: input.kind,
    providerMode: provider.mode,
    providerName: provider.providerName,
    modelName: provider.modelName,
    sourceId: input.sourceId,
    chunkIds: chunks.map((chunk) => chunk.id),
    chunkCount: chunks.length,
    payloadSummary:
      chunks.length === 0
        ? "本次请求不发送材料正文。"
        : chunks
            .slice(0, 3)
            .map((chunk) => chunk.text.replace(/\s+/g, " ").trim().slice(0, 96))
            .join(" / "),
    status: "pending_confirmation",
    createdAt: (input.createdAt ?? new Date()).toISOString()
  };
  return aiRequestPreviewSchema.parse(preview);
}

export function generateFallbackCardCandidates(input: GenerateCardsInput): CardCandidate[] {
  const now = new Date().toISOString();
  const template = getTemplate(input.templateId);
  const chunks = input.chunks.filter((chunk) => chunk.text.trim().length > 0);
  const count = Math.max(1, input.requestedCount ?? Math.max(1, chunks.length * 2));
  const candidates: CardCandidate[] = [];

  for (let index = 0; index < count; index += 1) {
    const chunk = chunks[index % chunks.length];
    const cardType = template.recommendedCardTypes[index % template.recommendedCardTypes.length];
    const sourceQuote = pickSourceQuote(chunk.text);
    candidates.push({
      id: `cand_${chunk.id}_${index + 1}`,
      question: buildQuestion(cardType, sourceQuote, template.id),
      expectedAnswer: buildExpectedAnswer(cardType, sourceQuote),
      sourceQuote,
      cardType,
      difficulty: ((index % 4) + 2) as 2 | 3 | 4 | 5,
      tags: [template.id, cardType],
      sourceChunkId: chunk.id,
      status: "candidate",
      createdAt: now
    });
  }

  return cardCandidateListSchema.parse(candidates);
}

export function generateFallbackSocraticQuestions(input: SocraticQuestionsInput) {
  const explanationLength = input.explanation.trim().length;
  const hasExample = /例如|比如|example|case|假设/i.test(input.explanation);
  const hasBoundary = /除非|边界|例外|失效|不适用|unless|except|limitation/i.test(input.explanation);
  const hasMechanism = /因为|导致|机制|过程|therefore|because|mechanism/i.test(input.explanation);

  return socraticResponseSchema.parse({
    questions: [
      `你说“${input.concept}”时，最关键的因果机制是什么？不要给定义，讲它为什么会这样。`,
      hasExample
        ? "你给的例子里，哪一步最能证明你不是只在复述材料？"
        : "能不能给一个具体例子，并说明这个例子为什么能代表这个概念？",
      hasBoundary
        ? "你提到了边界条件；如果这个边界被打破，结论会怎样变化？"
        : "这个解释在什么情况下会失效？请给一个反例或不适用场景。"
    ],
    rubricScores: {
      clarity: clampScore(explanationLength / 180 + 2),
      mechanism: hasMechanism ? 4 : 2,
      example: hasExample ? 4 : 2,
      boundary: hasBoundary ? 4 : 2,
      contrast: /区别|相比|类似|different|versus|vs/i.test(input.explanation) ? 4 : 2
    }
  });
}

export function buildCardsFromExplanation(attempt: ExplanationAttempt): CardCandidate[] {
  const now = new Date().toISOString();
  const quote = attempt.explanation.trim().slice(0, 260);
  return cardCandidateListSchema.parse([
    {
      id: `cand_explain_${attempt.id}_mechanism`,
      question: `请不用看笔记解释：${attempt.concept} 的核心机制是什么？`,
      expectedAnswer: "应能说清因果链、关键条件、具体例子和失效边界。",
      sourceQuote: quote,
      cardType: "mechanism",
      difficulty: 3,
      tags: [attempt.templateId, "feynman", "mechanism"],
      sourceChunkId: `explanation_${attempt.id}`,
      status: "candidate",
      createdAt: now
    },
    {
      id: `cand_explain_${attempt.id}_boundary`,
      question: `${attempt.concept} 在什么条件下不成立？请给出反例或边界。`,
      expectedAnswer: "应能给出不适用场景，并说明为什么原解释在该场景中失效。",
      sourceQuote: quote,
      cardType: "counterexample",
      difficulty: 4,
      tags: [attempt.templateId, "feynman", "boundary"],
      sourceChunkId: `explanation_${attempt.id}`,
      status: "candidate",
      createdAt: now
    }
  ]);
}

export function summarizeWeeklyReport(input: { logs: ReviewLog[]; weakTags: string[]; recommendation: string }) {
  const reviewCount = input.logs.length;
  const highConfidenceErrors = input.logs.filter((log) => log.confidence >= 4 && !log.isCorrect).length;
  return weeklySummarySchema.parse({
    headline: reviewCount === 0 ? "还没有足够校准证据" : `本周完成 ${reviewCount} 次校准提取`,
    recommendation: input.recommendation,
    risk:
      highConfidenceErrors > 0
        ? `有 ${highConfidenceErrors} 次高信心错误，优先回到来源片段和解释任务。`
        : input.weakTags.length > 0
          ? `薄弱标签集中在 ${input.weakTags.slice(0, 3).join("、")}。`
          : "暂未发现稳定盲区，继续累积复习日志。"
  });
}

export function classifyMistakeReason(answerText: string, sourceQuote: string): MistakeReason {
  const answer = answerText.trim();
  if (/混淆|区别|类似|差不多|confus/i.test(answer)) return "confused_concepts";
  if (answer.length < 12) return "not_retrieved";
  if (!/因为|导致|机制|过程|why|because|therefore/i.test(answer)) return "weak_mechanism";
  if (!/例外|边界|除非|不适用|unless|except|limit/i.test(answer) && /边界|条件|不成立|失效|except|unless|limit/i.test(sourceQuote)) {
    return "missed_boundary";
  }
  return "unknown";
}

export const CARD_GENERATION_PROMPT = `
Generate candidate retrieval-practice cards from user-provided source chunks.
Rules:
- Output JSON only.
- Every card must include sourceQuote copied from the provided chunk.
- Prefer mechanism, comparison, application, counterexample, experiment, and cloze questions over pure definitions.
- Do not claim correctness beyond the source.
- Candidates are reviewed by the user before entering the review queue.
`;

export const SOCRATIC_PROMPT = `
Act as a curious student, not a tutor.
Ask three precise questions that expose ambiguity, missing mechanism, missing example, boundary conditions, or weak contrast.
Do not provide the answer for the learner.
`;

function buildQuestion(cardType: CardType, quote: string, templateId: LearningTemplateId): string {
  if (cardType === "definition") return `用自己的话解释这段材料中的核心概念：${shorten(quote, 64)}`;
  if (cardType === "mechanism") return `为什么这段材料描述的现象会发生？请说清机制：${shorten(quote, 64)}`;
  if (cardType === "comparison") return `这段内容应和哪个相似概念区分？关键差别是什么：${shorten(quote, 64)}`;
  if (cardType === "application") return `如果把这段知识用于一个新情境，你会如何判断是否适用：${shorten(quote, 64)}`;
  if (cardType === "counterexample") return `这段结论在什么条件下可能不成立：${shorten(quote, 64)}`;
  if (cardType === "experiment") return `如果要验证这段材料的主张，你会设计什么证据或测试：${shorten(quote, 64)}`;
  return templateId === "exam"
    ? `填空并解释依据：${shorten(quote.replace(/\S{3,}/, "_____"), 80)}`
    : `补全关键表达并说明为什么：${shorten(quote.replace(/\S{3,}/, "_____"), 80)}`;
}

function buildExpectedAnswer(cardType: CardType, quote: string): string {
  if (cardType === "cloze") return `应能补全空缺，并用来源片段说明依据：${shorten(quote, 140)}`;
  return `答案必须能回到来源片段，并包含关键限定：${shorten(quote, 160)}`;
}

function pickSourceQuote(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= 220) return normalized;
  const sentences = normalized.split(/(?<=[。！？.!?])\s+/).filter(Boolean);
  return (sentences.find((sentence) => sentence.length >= 40 && sentence.length <= 220) ?? normalized.slice(0, 220)).trim();
}

function shorten(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function clampScore(value: number): number {
  return Math.max(1, Math.min(5, Math.round(value)));
}
