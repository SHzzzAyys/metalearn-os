import Dexie, { type Table } from "dexie";
import type {
  AIRequestPreview,
  AIProviderConfig,
  Card,
  CardCandidate,
  CheckIn,
  ConceptEdge,
  ConceptNode,
  ExportManifest,
  ExplanationAttempt,
  ImportConflictStrategy,
  ImportJob,
  ImportPackageKind,
  ImportPackagePayload,
  ImportPlan,
  ImportPreview,
  ImportProblem,
  InsightSnapshot,
  LearningEvent,
  LearningSession,
  Reflection,
  RepairTask,
  ReviewLog,
  SavedStudyView,
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
  repairTasks!: Table<RepairTask, string>;
  savedStudyViews!: Table<SavedStudyView, string>;
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
    this.version(4).stores({
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
      repairTasks: "id, status, reviewLogId, cardId, sourceId, sourceChunkId, reason, createdAt, updatedAt",
      learningEvents: "id, appId, sourceId, actionType, createdAt"
    });
    this.version(5).stores({
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
      repairTasks: "id, status, reviewLogId, cardId, sourceId, sourceChunkId, reason, createdAt, updatedAt",
      savedStudyViews: "id, scopeKind, scopeValue, priority, updatedAt, lastOpenedAt",
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
    currentDb.repairTasks.clear(),
    currentDb.savedStudyViews.clear(),
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
  repairTasks?: unknown[];
  savedStudyViews?: unknown[];
}): ExportManifest {
  const aiRequestPreviews = input.aiRequestPreviews?.length ?? 0;
  return {
    schemaVersion: 5,
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
      aiRequestPreviews,
      repairTasks: input.repairTasks?.length ?? 0,
      savedStudyViews: input.savedStudyViews?.length ?? 0
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
      version: 5,
      schemaVersion: 5,
      manifest,
      payload
    },
    null,
    2
  );
}

export interface ParsedImportPackage {
  kind: ImportPackageKind;
  schemaVersion?: number;
  exportedAt?: string;
  manifest?: ExportManifest;
  payload: ImportPackagePayload;
}

export type ImportParseResult =
  | { ok: true; package: ParsedImportPackage }
  | { ok: false; error: string; preview: ImportPreview };

export function parseImportPackage(text: string): ImportParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, error: "文件不是有效 JSON。", preview: failedImportPreview("invalid_json", "文件不是有效 JSON。") };
  }

  if (!isRecord(parsed)) {
    return { ok: false, error: "导入包必须是 JSON 对象。", preview: failedImportPreview("invalid_package", "导入包必须是 JSON 对象。") };
  }
  if (typeof parsed.schemaVersion !== "number") {
    return { ok: false, error: "导入包缺少 schemaVersion。", preview: failedImportPreview("missing_schema", "导入包缺少 schemaVersion。") };
  }
  if (!("payload" in parsed) || !isRecord(parsed.payload)) {
    return { ok: false, error: "导入包缺少 payload。", preview: failedImportPreview("missing_payload", "导入包缺少 payload。", parsed.schemaVersion) };
  }

  const payload = normalizeImportPayload(parsed.payload);
  const kind = detectImportPackageKind(parsed.payload, payload);
  const manifest = isRecord(parsed.manifest) ? (parsed.manifest as unknown as ExportManifest) : undefined;
  return {
    ok: true,
    package: {
      kind,
      schemaVersion: parsed.schemaVersion,
      exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : manifest?.exportedAt,
      manifest,
      payload
    }
  };
}

export function validateImportPackage(pkg: ParsedImportPackage): ImportPreview {
  const warnings: ImportProblem[] = [];
  const repaired: ImportProblem[] = [];
  const fatalProblems: ImportProblem[] = [];
  const counts = countImportPayload(pkg.payload);

  if (pkg.schemaVersion !== 3 && pkg.schemaVersion !== 4 && pkg.schemaVersion !== 5) {
    fatalProblems.push(problem("unsupported_schema", "fatal", "package", undefined, "当前版本只支持 schemaVersion 3、4 或 5 的导出包。"));
  }
  if (pkg.kind === "unknown") {
    fatalProblems.push(problem("unknown_package", "fatal", "package", undefined, "无法识别 MetaLearn OS 导入包类型。"));
  }
  if (pkg.payload.materials.length === 0) {
    fatalProblems.push(problem("missing_materials", "fatal", "materials", undefined, "导入包没有材料，无法恢复资料库。"));
  }
  if (pkg.manifest?.counts) {
    for (const key of Object.keys(counts) as Array<keyof ExportManifest["counts"]>) {
      const manifestValue = pkg.manifest.counts[key];
      if (typeof manifestValue === "number" && manifestValue !== counts[key]) {
        warnings.push(problem("manifest_count_mismatch", "warning", "manifest", key, `${key} 计数与 payload 不一致。`));
      }
    }
  }

  const sourceIds = new Set(pkg.payload.materials.map((source) => source.id));
  const chunkById = new Map(pkg.payload.chunks.map((chunk) => [chunk.id, chunk]));
  const cardById = new Map(pkg.payload.cards.map((card) => [card.id, card]));
  const reviewIds = new Set(pkg.payload.reviews.map((review) => review.id));

  for (const chunk of pkg.payload.chunks) {
    if (!sourceIds.has(chunk.sourceId)) {
      fatalProblems.push(problem("missing_source", "fatal", "chunks", chunk.id, `片段 ${chunk.id} 指向不存在的材料 ${chunk.sourceId}。`));
    }
  }

  for (const candidate of pkg.payload.candidates) {
    const validation = validateCardCandidateEvidence(candidate, pkg.payload.chunks);
    if (!validation.ok) {
      fatalProblems.push(problem("invalid_candidate_evidence", "fatal", "candidates", candidate.id, validation.reason ?? `候选题 ${candidate.id} 来源证据无效。`));
    }
  }

  for (const card of pkg.payload.cards) {
    const validation = validateCardCandidateEvidence(card, pkg.payload.chunks);
    if (!validation.ok) {
      fatalProblems.push(problem("invalid_card_evidence", "fatal", "cards", card.id, validation.reason ?? `卡片 ${card.id} 来源证据无效。`));
    }
  }

  for (const review of pkg.payload.reviews) {
    const card = cardById.get(review.cardId);
    if (!card) {
      fatalProblems.push(problem("missing_review_card", "fatal", "reviews", review.id, `复习记录 ${review.id} 指向不存在的卡片 ${review.cardId}。`));
      continue;
    }
    if (!sourceIds.has(review.sourceId)) {
      const sourceId = chunkById.get(card.sourceChunkId)?.sourceId;
      if (sourceId && sourceIds.has(sourceId)) {
        repaired.push(problem("repair_review_source", "repairable", "reviews", review.id, `复习记录 ${review.id} 的 sourceId 将由卡片来源修复。`));
      } else {
        fatalProblems.push(problem("missing_review_source", "fatal", "reviews", review.id, `复习记录 ${review.id} 指向不存在的材料 ${review.sourceId}。`));
      }
    }
  }

  for (const edge of pkg.payload.conceptEdges) {
    const nodeIds = new Set(pkg.payload.conceptNodes.map((node) => node.id));
    if (!nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.toNodeId)) {
      warnings.push(problem("missing_concept_node", "warning", "conceptEdges", edge.id, `概念连接 ${edge.id} 有端点缺失，将作为弱证据导入。`));
    }
  }

  for (const task of pkg.payload.repairTasks) {
    if (!reviewIds.has(task.reviewLogId)) {
      fatalProblems.push(problem("missing_repair_review", "fatal", "repairTasks", task.id, `修复任务 ${task.id} 指向不存在的复习记录 ${task.reviewLogId}。`));
    }
    if (!cardById.has(task.cardId)) {
      fatalProblems.push(problem("missing_repair_card", "fatal", "repairTasks", task.id, `修复任务 ${task.id} 指向不存在的卡片 ${task.cardId}。`));
    }
    if (!sourceIds.has(task.sourceId)) {
      fatalProblems.push(problem("missing_repair_source", "fatal", "repairTasks", task.id, `修复任务 ${task.id} 指向不存在的材料 ${task.sourceId}。`));
    }
    if (!chunkById.has(task.sourceChunkId)) {
      fatalProblems.push(problem("missing_repair_chunk", "fatal", "repairTasks", task.id, `修复任务 ${task.id} 指向不存在的片段 ${task.sourceChunkId}。`));
    }
  }

  return {
    kind: pkg.kind,
    schemaVersion: pkg.schemaVersion,
    exportedAt: pkg.exportedAt,
    counts,
    canImport: fatalProblems.length === 0,
    conflicts: [],
    repaired,
    warnings,
    fatalProblems
  };
}

export function createImportPreview(pkg: ParsedImportPackage, current: ImportPackagePayload = emptyImportPayload()): ImportPreview {
  const validation = validateImportPackage(pkg);
  const conflicts = findImportConflicts(pkg.payload, current);
  return {
    ...validation,
    conflicts,
    canImport: validation.canImport
  };
}

export function planImport(
  pkg: ParsedImportPackage,
  current: ImportPackagePayload = emptyImportPayload(),
  strategy: ImportConflictStrategy = "keep_both"
): ImportPlan {
  const preview = createImportPreview(pkg, current);
  const skipped: ImportProblem[] = [];
  if (!preview.canImport) {
    return { strategy, preview, idMap: {}, inserts: emptyImportPayload(), skipped, repaired: preview.repaired };
  }

  if (strategy === "skip_duplicates") {
    return planSkipDuplicates(pkg, current, preview, skipped);
  }

  return planKeepBoth(pkg, current, preview, skipped);
}

export async function applyImportPlan(db: MetaLearnDb, plan: ImportPlan): Promise<void> {
  if (!plan.preview.canImport) {
    throw new Error("导入预检未通过，不能写入本地数据。");
  }
  const inserts = plan.inserts;
  await db.transaction(
    "rw",
    [
      db.sourceDocuments,
      db.sourceChunks,
      db.importJobs,
      db.cardCandidates,
      db.cards,
      db.reviewLogs,
      db.learningSessions,
      db.checkIns,
      db.reflections,
      db.explanationAttempts,
      db.conceptNodes,
      db.conceptEdges,
      db.insightSnapshots,
      db.aiProviderConfigs,
      db.aiRequestPreviews,
      db.repairTasks,
      db.savedStudyViews
    ],
    async () => {
      await bulkPutIfAny(db.sourceDocuments, inserts.materials);
      await bulkPutIfAny(db.sourceChunks, inserts.chunks);
      await bulkPutIfAny(db.importJobs, inserts.importJobs);
      await bulkPutIfAny(db.cardCandidates, inserts.candidates);
      await bulkPutIfAny(db.cards, inserts.cards);
      await bulkPutIfAny(db.reviewLogs, inserts.reviews);
      await bulkPutIfAny(db.learningSessions, inserts.sessions);
      await bulkPutIfAny(db.checkIns, inserts.checkIns);
      await bulkPutIfAny(db.reflections, inserts.reflections);
      await bulkPutIfAny(db.explanationAttempts, inserts.explanations);
      await bulkPutIfAny(db.conceptNodes, inserts.conceptNodes);
      await bulkPutIfAny(db.conceptEdges, inserts.conceptEdges);
      await bulkPutIfAny(db.insightSnapshots, inserts.insights);
      await bulkPutIfAny(db.aiProviderConfigs, inserts.aiProviderConfigs);
      await bulkPutIfAny(db.aiRequestPreviews, inserts.aiRequestPreviews);
      await bulkPutIfAny(db.repairTasks, inserts.repairTasks);
      await bulkPutIfAny(db.savedStudyViews, inserts.savedStudyViews);
    }
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

function failedImportPreview(code: string, message: string, schemaVersion?: number): ImportPreview {
  const fatal = [problem(code, "fatal", "package", undefined, message)];
  return {
    kind: "unknown",
    schemaVersion,
    counts: emptyImportCounts(),
    canImport: false,
    conflicts: [],
    repaired: [],
    warnings: [],
    fatalProblems: fatal
  };
}

function emptyImportCounts(): ExportManifest["counts"] {
  return {
    materials: 0,
    chunks: 0,
    candidates: 0,
    cards: 0,
    reviews: 0,
    explanations: 0,
    sessions: 0,
    checkIns: 0,
    insights: 0,
    aiRequestPreviews: 0,
    repairTasks: 0,
    savedStudyViews: 0
  };
}

export function emptyImportPayload(): ImportPackagePayload {
  return {
    materials: [],
    chunks: [],
    importJobs: [],
    candidates: [],
    cards: [],
    reviews: [],
    explanations: [],
    conceptNodes: [],
    conceptEdges: [],
    sessions: [],
    checkIns: [],
    reflections: [],
    insights: [],
    aiProviderConfigs: [],
    aiRequestPreviews: [],
    repairTasks: [],
    savedStudyViews: []
  };
}

function normalizeImportPayload(payload: Record<string, unknown>): ImportPackagePayload {
  return {
    materials: cloneArray<SourceDocument>(payload.materials),
    chunks: cloneArray<SourceChunk>(payload.chunks),
    importJobs: cloneArray<ImportJob>(payload.importJobs),
    candidates: cloneArray<CardCandidate>(payload.candidates),
    cards: cloneArray<Card>(payload.cards),
    reviews: cloneArray<ReviewLog>(payload.reviews),
    explanations: cloneArray<ExplanationAttempt>(payload.explanations),
    conceptNodes: cloneArray<ConceptNode>(payload.conceptNodes),
    conceptEdges: cloneArray<ConceptEdge>(payload.conceptEdges),
    sessions: cloneArray<LearningSession>(payload.sessions),
    checkIns: cloneArray<CheckIn>(payload.checkIns),
    reflections: cloneArray<Reflection>(payload.reflections),
    insights: cloneArray<InsightSnapshot>(payload.insights),
    aiProviderConfigs: cloneArray<AIProviderConfig>(payload.aiProviderConfigs),
    aiRequestPreviews: cloneArray<AIRequestPreview>(payload.aiRequestPreviews),
    repairTasks: cloneArray<RepairTask>(payload.repairTasks),
    savedStudyViews: cloneArray<SavedStudyView>(payload.savedStudyViews)
  };
}

function cloneArray<T>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return JSON.parse(JSON.stringify(value)) as T[];
}

function detectImportPackageKind(rawPayload: Record<string, unknown>, payload: ImportPackagePayload): ImportPackageKind {
  if (payload.materials.length === 0) return "unknown";
  const broadKeys = [
    "importJobs",
    "sessions",
    "checkIns",
    "reflections",
    "insights",
    "conceptNodes",
    "conceptEdges",
    "aiRequestPreviews",
    "savedStudyViews"
  ];
  if (broadKeys.some((key) => Array.isArray(rawPayload[key]))) return "full_backup";
  if (payload.materials.length === 1) return "material_package";
  return "full_backup";
}

function countImportPayload(payload: ImportPackagePayload): ExportManifest["counts"] {
  return {
    materials: payload.materials.length,
    chunks: payload.chunks.length,
    candidates: payload.candidates.length,
    cards: payload.cards.length,
    reviews: payload.reviews.length,
    explanations: payload.explanations.length,
    sessions: payload.sessions.length,
    checkIns: payload.checkIns.length,
    insights: payload.insights.length,
    aiRequestPreviews: payload.aiRequestPreviews.length,
    repairTasks: payload.repairTasks.length,
    savedStudyViews: payload.savedStudyViews.length
  };
}

function problem(code: string, severity: ImportProblem["severity"], table: string, id: string | undefined, message: string): ImportProblem {
  return { code, severity, table, id, message };
}

function findImportConflicts(payload: ImportPackagePayload, current: ImportPackagePayload): ImportProblem[] {
  const conflicts: ImportProblem[] = [];
  addConflicts(conflicts, "materials", payload.materials, current.materials);
  addConflicts(conflicts, "chunks", payload.chunks, current.chunks);
  addConflicts(conflicts, "candidates", payload.candidates, current.candidates);
  addConflicts(conflicts, "cards", payload.cards, current.cards);
  addConflicts(conflicts, "reviews", payload.reviews, current.reviews);
  addConflicts(conflicts, "explanations", payload.explanations, current.explanations);
  addConflicts(conflicts, "sessions", payload.sessions, current.sessions);
  addConflicts(conflicts, "checkIns", payload.checkIns, current.checkIns);
  addConflicts(conflicts, "reflections", payload.reflections, current.reflections);
  addConflicts(conflicts, "conceptNodes", payload.conceptNodes, current.conceptNodes);
  addConflicts(conflicts, "conceptEdges", payload.conceptEdges, current.conceptEdges);
  addConflicts(conflicts, "insights", payload.insights, current.insights);
  addConflicts(conflicts, "aiRequestPreviews", payload.aiRequestPreviews, current.aiRequestPreviews);
  addConflicts(conflicts, "repairTasks", payload.repairTasks, current.repairTasks);
  addConflicts(conflicts, "savedStudyViews", payload.savedStudyViews, current.savedStudyViews);
  return conflicts;
}

function addConflicts<T extends { id: string }>(conflicts: ImportProblem[], table: string, incoming: T[], current: T[]) {
  const currentIds = new Set(current.map((item) => item.id));
  for (const item of incoming) {
    if (currentIds.has(item.id)) {
      conflicts.push(problem("id_conflict", "repairable", table, item.id, `${table} 中的 ${item.id} 已存在。`));
    }
  }
}

function planKeepBoth(pkg: ParsedImportPackage, current: ImportPackagePayload, preview: ImportPreview, skipped: ImportProblem[]): ImportPlan {
  const idMap = buildConflictIdMap(pkg.payload, current);
  const mapRequiredId = (id: string) => idMap[id] ?? id;
  const mapOptionalId = (id: string | undefined) => (id ? idMap[id] ?? id : undefined);
  const sourceIdByOriginalChunkId = new Map(pkg.payload.chunks.map((chunk) => [chunk.id, chunk.sourceId]));
  const cardByOriginalId = new Map(pkg.payload.cards.map((card) => [card.id, card]));
  const inserts: ImportPackagePayload = {
    materials: pkg.payload.materials.map((source) => ({
      ...source,
      id: mapRequiredId(source.id),
      title: idMap[source.id] ? `${source.title} 导入副本` : source.title
    })),
    chunks: pkg.payload.chunks.map((chunk) => ({ ...chunk, id: mapRequiredId(chunk.id), sourceId: mapRequiredId(chunk.sourceId) })),
    importJobs: pkg.payload.importJobs.map((job) => ({ ...job, id: mapRequiredId(job.id), sourceId: mapOptionalId(job.sourceId) })),
    candidates: pkg.payload.candidates.map((candidate) => ({ ...candidate, id: mapRequiredId(candidate.id), sourceChunkId: mapRequiredId(candidate.sourceChunkId) })),
    cards: pkg.payload.cards.map((card) => ({ ...card, id: mapRequiredId(card.id), sourceChunkId: mapRequiredId(card.sourceChunkId) })),
    reviews: pkg.payload.reviews.map((review) => {
      const card = cardByOriginalId.get(review.cardId);
      const derivedSourceId = card ? sourceIdByOriginalChunkId.get(card.sourceChunkId) : undefined;
      return { ...review, id: mapRequiredId(review.id), cardId: mapRequiredId(review.cardId), sourceId: mapRequiredId(derivedSourceId ?? review.sourceId) };
    }),
    explanations: pkg.payload.explanations.map((attempt) => ({
      ...attempt,
      id: mapRequiredId(attempt.id),
      parentAttemptId: mapOptionalId(attempt.parentAttemptId),
      linkedCardIds: attempt.linkedCardIds?.map((id) => mapRequiredId(id)) ?? attempt.linkedCardIds
    })),
    conceptNodes: pkg.payload.conceptNodes.map((node) => ({ ...node, id: mapRequiredId(node.id), sourceId: mapOptionalId(node.sourceId) })),
    conceptEdges: pkg.payload.conceptEdges.map((edge) => ({ ...edge, id: mapRequiredId(edge.id), fromNodeId: mapRequiredId(edge.fromNodeId), toNodeId: mapRequiredId(edge.toNodeId) })),
    sessions: pkg.payload.sessions.map((session) => ({ ...session, id: mapRequiredId(session.id) })),
    checkIns: pkg.payload.checkIns.map((checkIn) => ({ ...checkIn, id: mapRequiredId(checkIn.id), sessionId: mapRequiredId(checkIn.sessionId) })),
    reflections: pkg.payload.reflections.map((reflection) => ({ ...reflection, id: mapRequiredId(reflection.id), sessionId: mapRequiredId(reflection.sessionId) })),
    insights: pkg.payload.insights.map((insight) => ({ ...insight, id: mapRequiredId(insight.id) })),
    aiProviderConfigs: pkg.payload.aiProviderConfigs.map((config) => ({ ...config, id: mapRequiredId(config.id) })),
    aiRequestPreviews: pkg.payload.aiRequestPreviews.map((previewItem) => ({
      ...previewItem,
      id: mapRequiredId(previewItem.id),
      sourceId: mapOptionalId(previewItem.sourceId),
      chunkIds: previewItem.chunkIds.map((id) => mapRequiredId(id))
    })),
    repairTasks: pkg.payload.repairTasks.map((task) => ({
      ...task,
      id: mapRequiredId(task.id),
      reviewLogId: mapRequiredId(task.reviewLogId),
      cardId: mapRequiredId(task.cardId),
      sourceId: mapRequiredId(task.sourceId),
      sourceChunkId: mapRequiredId(task.sourceChunkId),
      linkedExplanationId: mapOptionalId(task.linkedExplanationId),
      linkedRemedialCandidateIds: task.linkedRemedialCandidateIds.map((id) => mapRequiredId(id))
    })),
    savedStudyViews: pkg.payload.savedStudyViews.map((view) => remapSavedStudyView(view, idMap))
  };
  return { strategy: "keep_both", preview, idMap, inserts, skipped, repaired: preview.repaired };
}

function buildConflictIdMap(payload: ImportPackagePayload, current: ImportPackagePayload): Record<string, string> {
  const idMap: Record<string, string> = {};
  const add = (prefix: string, incoming: Array<{ id: string }>, existing: Array<{ id: string }>) => {
    const existingIds = new Set(existing.map((item) => item.id));
    for (const item of incoming) {
      if (existingIds.has(item.id) && !idMap[item.id]) idMap[item.id] = createId(prefix);
    }
  };
  add("source", payload.materials, current.materials);
  add("chunk", payload.chunks, current.chunks);
  add("import", payload.importJobs, current.importJobs);
  add("cand", payload.candidates, current.candidates);
  add("card", payload.cards, current.cards);
  add("review", payload.reviews, current.reviews);
  add("explanation", payload.explanations, current.explanations);
  add("concept", payload.conceptNodes, current.conceptNodes);
  add("edge", payload.conceptEdges, current.conceptEdges);
  add("session", payload.sessions, current.sessions);
  add("checkin", payload.checkIns, current.checkIns);
  add("reflection", payload.reflections, current.reflections);
  add("insight", payload.insights, current.insights);
  add("ai_config", payload.aiProviderConfigs, current.aiProviderConfigs);
  add("preview", payload.aiRequestPreviews, current.aiRequestPreviews);
  add("repair", payload.repairTasks, current.repairTasks);
  add("view", payload.savedStudyViews, current.savedStudyViews);
  return idMap;
}

function remapSavedStudyView(view: SavedStudyView, idMap: Record<string, string>): SavedStudyView {
  const mappedScopeValue = view.scopeKind === "material" && view.scopeValue ? idMap[view.scopeValue] ?? view.scopeValue : view.scopeValue;
  return {
    ...view,
    id: idMap[view.id] ?? view.id,
    scopeValue: mappedScopeValue,
    href: remapHrefIds(view.href, idMap),
    title: idMap[view.id] ? `${view.title} 导入副本` : view.title
  };
}

function remapHrefIds(href: string, idMap: Record<string, string>): string {
  let nextHref = href;
  for (const [from, to] of Object.entries(idMap)) {
    nextHref = nextHref.split(encodeURIComponent(from)).join(encodeURIComponent(to));
    nextHref = nextHref.split(from).join(to);
  }
  return nextHref;
}

function planSkipDuplicates(pkg: ParsedImportPackage, current: ImportPackagePayload, preview: ImportPreview, skipped: ImportProblem[]): ImportPlan {
  const currentIds = buildCurrentIdSets(current);
  const skippedSourceIds = new Set<string>();
  const skippedChunkIds = new Set<string>();
  const skippedCandidateIds = new Set<string>();
  const skippedCardIds = new Set<string>();
  const skippedReviewIds = new Set<string>();
  const skippedSessionIds = new Set<string>();
  const skippedNodeIds = new Set<string>();

  const materials = pkg.payload.materials.filter((source) => {
    if (!currentIds.materials.has(source.id)) return true;
    skippedSourceIds.add(source.id);
    skipped.push(problem("skipped_duplicate", "warning", "materials", source.id, `材料 ${source.id} 已存在，已跳过。`));
    return false;
  });
  const chunks = pkg.payload.chunks.filter((chunk) => {
    if (!currentIds.chunks.has(chunk.id) && !skippedSourceIds.has(chunk.sourceId)) return true;
    skippedChunkIds.add(chunk.id);
    skipped.push(problem("skipped_duplicate", "warning", "chunks", chunk.id, `片段 ${chunk.id} 已存在或依赖被跳过。`));
    return false;
  });
  const candidates = pkg.payload.candidates.filter((candidate) => {
    if (!currentIds.candidates.has(candidate.id) && !skippedChunkIds.has(candidate.sourceChunkId)) return true;
    skippedCandidateIds.add(candidate.id);
    skipped.push(problem("skipped_duplicate", "warning", "candidates", candidate.id, `候选题 ${candidate.id} 已存在或依赖被跳过。`));
    return false;
  });
  const cards = pkg.payload.cards.filter((card) => {
    if (!currentIds.cards.has(card.id) && !skippedChunkIds.has(card.sourceChunkId)) return true;
    skippedCardIds.add(card.id);
    skipped.push(problem("skipped_duplicate", "warning", "cards", card.id, `卡片 ${card.id} 已存在或依赖被跳过。`));
    return false;
  });
  const cardByOriginalId = new Map(pkg.payload.cards.map((card) => [card.id, card]));
  const chunkByOriginalId = new Map(pkg.payload.chunks.map((chunk) => [chunk.id, chunk]));
  const reviews = pkg.payload.reviews
    .filter((review) => {
      if (!currentIds.reviews.has(review.id) && !skippedCardIds.has(review.cardId) && !skippedSourceIds.has(review.sourceId)) return true;
      skippedReviewIds.add(review.id);
      skipped.push(problem("skipped_duplicate", "warning", "reviews", review.id, `复习记录 ${review.id} 已存在或依赖被跳过。`));
      return false;
    })
    .map((review) => {
      const card = cardByOriginalId.get(review.cardId);
      const sourceId = card ? chunkByOriginalId.get(card.sourceChunkId)?.sourceId : undefined;
      return { ...review, sourceId: sourceId ?? review.sourceId };
    });

  const sessions = pkg.payload.sessions.filter((session) => {
    if (!currentIds.sessions.has(session.id)) return true;
    skippedSessionIds.add(session.id);
    skipped.push(problem("skipped_duplicate", "warning", "sessions", session.id, `学习会话 ${session.id} 已存在，已跳过。`));
    return false;
  });
  const conceptNodes = pkg.payload.conceptNodes.filter((node) => {
    if (!currentIds.conceptNodes.has(node.id) && (!node.sourceId || !skippedSourceIds.has(node.sourceId))) return true;
    skippedNodeIds.add(node.id);
    skipped.push(problem("skipped_duplicate", "warning", "conceptNodes", node.id, `概念节点 ${node.id} 已存在或依赖被跳过。`));
    return false;
  });

  return {
    strategy: "skip_duplicates",
    preview,
    idMap: {},
    inserts: {
      materials,
      chunks,
      importJobs: pkg.payload.importJobs.filter((job) => !currentIds.importJobs.has(job.id) && (!job.sourceId || !skippedSourceIds.has(job.sourceId))),
      candidates,
      cards,
      reviews,
      explanations: pkg.payload.explanations.filter((attempt) => !currentIds.explanations.has(attempt.id)),
      conceptNodes,
      conceptEdges: pkg.payload.conceptEdges.filter((edge) => !currentIds.conceptEdges.has(edge.id) && !skippedNodeIds.has(edge.fromNodeId) && !skippedNodeIds.has(edge.toNodeId)),
      sessions,
      checkIns: pkg.payload.checkIns.filter((checkIn) => !currentIds.checkIns.has(checkIn.id) && !skippedSessionIds.has(checkIn.sessionId)),
      reflections: pkg.payload.reflections.filter((reflection) => !currentIds.reflections.has(reflection.id) && !skippedSessionIds.has(reflection.sessionId)),
      insights: pkg.payload.insights.filter((insight) => !currentIds.insights.has(insight.id)),
      aiProviderConfigs: pkg.payload.aiProviderConfigs.filter((config) => !currentIds.aiProviderConfigs.has(config.id)),
      aiRequestPreviews: pkg.payload.aiRequestPreviews.filter((previewItem) => !currentIds.aiRequestPreviews.has(previewItem.id) && (!previewItem.sourceId || !skippedSourceIds.has(previewItem.sourceId))),
      repairTasks: pkg.payload.repairTasks.filter((task) => {
        const shouldKeep =
          !currentIds.repairTasks.has(task.id) &&
          !skippedReviewIds.has(task.reviewLogId) &&
          !skippedCardIds.has(task.cardId) &&
          !skippedSourceIds.has(task.sourceId) &&
          !skippedChunkIds.has(task.sourceChunkId);
        if (!shouldKeep) skipped.push(problem("skipped_duplicate", "warning", "repairTasks", task.id, `修复任务 ${task.id} 已存在或依赖被跳过。`));
        return shouldKeep;
      }),
      savedStudyViews: pkg.payload.savedStudyViews.filter((view) => {
        const dependsOnSkippedSource = view.scopeKind === "material" && view.scopeValue ? skippedSourceIds.has(view.scopeValue) : false;
        const shouldKeep = !currentIds.savedStudyViews.has(view.id) && !dependsOnSkippedSource;
        if (!shouldKeep) skipped.push(problem("skipped_duplicate", "warning", "savedStudyViews", view.id, `固定学习视图 ${view.id} 已存在或依赖被跳过。`));
        return shouldKeep;
      })
    },
    skipped,
    repaired: preview.repaired
  };
}

function buildCurrentIdSets(current: ImportPackagePayload) {
  return {
    materials: new Set(current.materials.map((item) => item.id)),
    chunks: new Set(current.chunks.map((item) => item.id)),
    importJobs: new Set(current.importJobs.map((item) => item.id)),
    candidates: new Set(current.candidates.map((item) => item.id)),
    cards: new Set(current.cards.map((item) => item.id)),
    reviews: new Set(current.reviews.map((item) => item.id)),
    explanations: new Set(current.explanations.map((item) => item.id)),
    conceptNodes: new Set(current.conceptNodes.map((item) => item.id)),
    conceptEdges: new Set(current.conceptEdges.map((item) => item.id)),
    sessions: new Set(current.sessions.map((item) => item.id)),
    checkIns: new Set(current.checkIns.map((item) => item.id)),
    reflections: new Set(current.reflections.map((item) => item.id)),
    insights: new Set(current.insights.map((item) => item.id)),
    aiProviderConfigs: new Set(current.aiProviderConfigs.map((item) => item.id)),
    aiRequestPreviews: new Set(current.aiRequestPreviews.map((item) => item.id)),
    repairTasks: new Set(current.repairTasks.map((item) => item.id)),
    savedStudyViews: new Set(current.savedStudyViews.map((item) => item.id))
  };
}

async function bulkPutIfAny<T extends { id: string }>(table: Table<T, string>, rows: T[]): Promise<void> {
  if (rows.length > 0) await table.bulkPut(rows);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
