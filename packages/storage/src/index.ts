import Dexie, { type Table } from "dexie";
import type {
  AIRequestPreview,
  Card,
  CardCandidate,
  AIProviderConfig,
  CheckIn,
  ConceptEdge,
  ConceptNode,
  ExportManifest,
  ExplanationAttempt,
  ImportJob,
  InsightSnapshot,
  LearningEvent,
  LearningSession,
  Reflection,
  ReviewLog,
  SourceChunk,
  SourceDocument,
  StudyAsset
} from "@metalearn/core";

export class MetaLearnDb extends Dexie {
  sourceDocuments!: Table<SourceDocument, string>;
  sourceChunks!: Table<SourceChunk, string>;
  importJobs!: Table<ImportJob, string>;
  cardCandidates!: Table<CardCandidate, string>;
  cards!: Table<Card, string>;
  reviewLogs!: Table<ReviewLog, string>;
  learningSessions!: Table<LearningSession, string>;
  checkIns!: Table<CheckIn, string>;
  reflections!: Table<Reflection, string>;
  explanationAttempts!: Table<ExplanationAttempt, string>;
  conceptNodes!: Table<ConceptNode, string>;
  conceptEdges!: Table<ConceptEdge, string>;
  insightSnapshots!: Table<InsightSnapshot, string>;
  aiProviderConfigs!: Table<AIProviderConfig, string>;
  aiRequestPreviews!: Table<AIRequestPreview, string>;
  learningEvents!: Table<LearningEvent, string>;

  constructor() {
    super("metalearn-suite");
    this.version(1).stores({
      sourceDocuments: "id, templateId, createdAt",
      sourceChunks: "id, sourceId, index",
      cardCandidates: "id, sourceChunkId, status, createdAt",
      cards: "id, sourceChunkId, dueAt, createdAt",
      reviewLogs: "id, cardId, sourceId, confidence, createdAt",
      learningSessions: "id, templateId, startedAt, endedAt",
      reflections: "id, sessionId, createdAt",
      explanationAttempts: "id, templateId, concept, createdAt",
      learningEvents: "id, appId, sourceId, actionType, createdAt"
    });
    this.version(2).stores({
      sourceDocuments: "id, templateId, status, lastWorkedAt, createdAt",
      sourceChunks: "id, sourceId, index",
      cardCandidates: "id, sourceChunkId, status, createdAt",
      cards: "id, sourceChunkId, dueAt, createdAt",
      reviewLogs: "id, cardId, sourceId, confidence, mistakeReason, createdAt",
      learningSessions: "id, templateId, startedAt, endedAt",
      reflections: "id, sessionId, createdAt",
      explanationAttempts: "id, templateId, concept, parentAttemptId, createdAt",
      insightSnapshots: "id, createdAt",
      aiProviderConfigs: "id, mode, providerName, updatedAt",
      learningEvents: "id, appId, sourceId, actionType, createdAt"
    });
    this.version(3).stores({
      sourceDocuments: "id, templateId, status, lastWorkedAt, createdAt",
      sourceChunks: "id, sourceId, index",
      importJobs: "id, sourceId, inputType, status, createdAt",
      cardCandidates: "id, sourceChunkId, status, createdAt",
      cards: "id, sourceChunkId, dueAt, createdAt",
      reviewLogs: "id, cardId, sourceId, confidence, mistakeReason, evidenceStrength, createdAt",
      learningSessions: "id, templateId, startedAt, endedAt",
      checkIns: "id, sessionId, focusState, createdAt",
      reflections: "id, sessionId, createdAt",
      explanationAttempts: "id, templateId, concept, parentAttemptId, createdAt",
      conceptNodes: "id, label, source, sourceId, updatedAt",
      conceptEdges: "id, fromNodeId, toNodeId, relation, confirmed, createdAt",
      insightSnapshots: "id, createdAt",
      aiProviderConfigs: "id, mode, providerName, updatedAt",
      aiRequestPreviews: "id, kind, sourceId, providerMode, status, createdAt",
      learningEvents: "id, appId, sourceId, actionType, createdAt"
    });
  }
}

let db: MetaLearnDb | null = null;

export function getMetaLearnDb(): MetaLearnDb {
  if (typeof window === "undefined") {
    throw new Error("MetaLearnDb is only available in the browser.");
  }
  db ??= new MetaLearnDb();
  return db;
}

export function createId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

export async function saveLearningEvent(event: LearningEvent): Promise<void> {
  await getMetaLearnDb().learningEvents.put(event);
}

export async function clearAllLocalData(): Promise<void> {
  const currentDb = getMetaLearnDb();
  await Promise.all([
    currentDb.sourceDocuments.clear(),
    currentDb.sourceChunks.clear(),
    currentDb.importJobs.clear(),
    currentDb.cardCandidates.clear(),
    currentDb.cards.clear(),
    currentDb.reviewLogs.clear(),
    currentDb.learningSessions.clear(),
    currentDb.checkIns.clear(),
    currentDb.reflections.clear(),
    currentDb.explanationAttempts.clear(),
    currentDb.conceptNodes.clear(),
    currentDb.conceptEdges.clear(),
    currentDb.insightSnapshots.clear(),
    currentDb.aiProviderConfigs.clear(),
    currentDb.aiRequestPreviews.clear(),
    currentDb.learningEvents.clear()
  ]);
}

export function chunkText(sourceId: string, text: string, targetLength = 800): SourceChunk[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  const paragraphs = normalized.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const chunks: SourceChunk[] = [];
  let buffer = "";

  for (const paragraph of paragraphs) {
    if ((buffer + "\n\n" + paragraph).trim().length > targetLength && buffer.length > 0) {
      chunks.push({ id: createId("chunk"), sourceId, index: chunks.length, text: buffer.trim() });
      buffer = paragraph;
    } else {
      buffer = `${buffer}\n\n${paragraph}`.trim();
    }
  }

  if (buffer.length > 0) {
    chunks.push({ id: createId("chunk"), sourceId, index: chunks.length, text: buffer.trim() });
  }

  if (chunks.length === 0 && normalized.length > 0) {
    chunks.push({ id: createId("chunk"), sourceId, index: 0, text: normalized.slice(0, targetLength) });
  }

  return chunks;
}

export function createExportManifest(input: {
  materials?: unknown[];
  chunks?: unknown[];
  candidates?: unknown[];
  cards?: unknown[];
  reviews?: unknown[];
  explanations?: unknown[];
  sessions?: unknown[];
  checkIns?: unknown[];
  insights?: unknown[];
  aiRequestPreviews?: unknown[];
}): ExportManifest {
  const aiRequestPreviews = input.aiRequestPreviews?.length ?? 0;
  return {
    schemaVersion: 3,
    exportedAt: new Date().toISOString(),
    counts: {
      materials: input.materials?.length ?? 0,
      chunks: input.chunks?.length ?? 0,
      candidates: input.candidates?.length ?? 0,
      cards: input.cards?.length ?? 0,
      reviews: input.reviews?.length ?? 0,
      explanations: input.explanations?.length ?? 0,
      sessions: input.sessions?.length ?? 0,
      checkIns: input.checkIns?.length ?? 0,
      insights: input.insights?.length ?? 0,
      aiRequestPreviews
    },
    includesAIRequestRecords: aiRequestPreviews > 0
  };
}

export interface CandidateEvidenceValidation {
  ok: boolean;
  reason?: string;
  chunk?: SourceChunk;
}

export function validateCardCandidateEvidence(candidate: CardCandidate, chunks: SourceChunk[]): CandidateEvidenceValidation {
  const question = candidate.question.trim();
  const expectedAnswer = candidate.expectedAnswer.trim();
  const sourceQuote = candidate.sourceQuote.trim();
  const sourceChunkId = candidate.sourceChunkId.trim();

  if (question.length < 6) return { ok: false, reason: "问题至少需要 6 个字符。" };
  if (expectedAnswer.length < 4) return { ok: false, reason: "预期答案不能为空。" };
  if (!sourceQuote) return { ok: false, reason: "缺少来源证据，不能进入复习队列。" };
  if (!sourceChunkId) return { ok: false, reason: "缺少来源片段 ID，不能进入复习队列。" };
  if (candidate.tags.length === 0 || candidate.tags.every((tag) => !tag.trim())) return { ok: false, reason: "至少需要一个标签。" };

  const chunk = chunks.find((item) => item.id === sourceChunkId);
  if (!chunk) return { ok: false, reason: "来源片段不存在，请重新选择材料片段。" };

  const normalizedQuote = normalizeEvidenceText(sourceQuote);
  const normalizedChunk = normalizeEvidenceText(chunk.text);
  if (!normalizedQuote || !normalizedChunk.includes(normalizedQuote)) {
    return { ok: false, reason: "来源摘录必须来自所选材料片段。" };
  }

  return { ok: true, chunk };
}

export function serializeExportPackage(payload: unknown, manifest?: ExportManifest): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      version: 3,
      schemaVersion: 3,
      manifest,
      payload
    },
    null,
    2
  );
}

export function buildStudyAssets(input: {
  sources: SourceDocument[];
  chunks?: SourceChunk[];
  candidates: CardCandidate[];
  cards: Card[];
  explanations: ExplanationAttempt[];
}): StudyAsset[] {
  const chunkById = new Map((input.chunks ?? []).map((chunk) => [chunk.id, chunk]));
  const sourceHrefForChunk = (sourceChunkId: string) => {
    const sourceId = chunkById.get(sourceChunkId)?.sourceId;
    return sourceId ? `/library/${sourceId}` : undefined;
  };
  const sourceAssets: StudyAsset[] = input.sources.map((source) => ({
    id: source.id,
    kind: "material",
    title: source.title,
    detail: source.summary ?? `${source.rawText.slice(0, 120)}${source.rawText.length > 120 ? "..." : ""}`,
    templateId: source.templateId,
    sourceId: source.id,
    href: `/library/${source.id}`,
    statusLabel: source.status ?? "new",
    updatedAt: source.lastWorkedAt ?? source.updatedAt
  }));
  const candidateAssets: StudyAsset[] = input.candidates
    .filter((candidate) => candidate.status === "candidate")
    .map((candidate) => ({
      id: candidate.id,
      kind: "candidate",
      title: candidate.question,
      detail: candidate.sourceQuote,
      sourceId: chunkById.get(candidate.sourceChunkId)?.sourceId,
      href: sourceHrefForChunk(candidate.sourceChunkId) ?? "/review?panel=candidates",
      statusLabel: "待审核",
      updatedAt: candidate.createdAt
    }));
  const cardAssets: StudyAsset[] = input.cards.map((card) => ({
    id: card.id,
    kind: "card",
    title: card.question,
    detail: `下次复习 ${new Date(card.dueAt).toLocaleDateString()}`,
    sourceId: chunkById.get(card.sourceChunkId)?.sourceId,
    href: sourceHrefForChunk(card.sourceChunkId) ?? "/review",
    statusLabel: card.fsrs.reps > 0 ? "复习中" : "新卡",
    updatedAt: card.lastReviewedAt ?? card.createdAt
  }));
  const explanationAssets: StudyAsset[] = input.explanations.map((attempt) => ({
    id: attempt.id,
    kind: "explanation",
    title: attempt.concept,
    detail: attempt.explanation.slice(0, 140),
    templateId: attempt.templateId,
    href: "/explain",
    statusLabel: `v${attempt.versionIndex ?? 1}`,
    updatedAt: attempt.createdAt
  }));
  return [...sourceAssets, ...candidateAssets, ...cardAssets, ...explanationAssets].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
}

export function cardsToCsv(cards: Card[]): string {
  const rows = [
    ["id", "question", "expectedAnswer", "cardType", "difficulty", "tags", "sourceQuote", "dueAt"],
    ...cards.map((card) => [
      card.id,
      card.question,
      card.expectedAnswer,
      card.cardType,
      String(card.difficulty),
      card.tags.join("|"),
      card.sourceQuote,
      card.dueAt
    ])
  ];
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

export function candidatesToAnkiTsv(candidates: CardCandidate[]): string {
  return candidates
    .map((candidate) =>
      [candidate.question, candidate.expectedAnswer, candidate.sourceQuote, candidate.tags.join(" ")].map(tsvEscape).join("\t")
    )
    .join("\n");
}

export function downloadTextFile(filename: string, content: string, mime = "text/plain;charset=utf-8"): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function tsvEscape(value: string): string {
  return value.replace(/\t/g, " ").replace(/\n/g, "<br>");
}

function normalizeEvidenceText(value: string): string {
  return value.replace(/\s+/g, "").trim().toLowerCase();
}
