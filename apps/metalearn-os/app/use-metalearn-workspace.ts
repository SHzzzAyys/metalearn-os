"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildAIRequestPreview, buildCardsFromExplanation, classifyMistakeReason } from "@metalearn/ai";
import type {
  AIProviderConfig,
  AIRequestPreview,
  ActionResult,
  Card,
  CardCandidate,
  CardType,
  CheckInFocusState,
  ConceptRelationType,
  ExplanationAttempt,
  ImportConflictStrategy,
  ImportPackagePayload,
  ImportPlan,
  ImportPreview,
  LearningSession,
  LearningTemplateId,
  MistakeReason,
  Reflection,
  ReviewLog,
  ReviewOutcome,
  SourceInputType,
  SourceChunk,
  SourceDocument
} from "@metalearn/core";
import {
  confidenceToJudgment,
  createInitialFsrsState,
  deriveReviewEvidenceStrength,
  outcomeToCorrectness,
  simplifiedFsrsAdapter
} from "@metalearn/learning-science";
import {
  cardsToCsv,
  candidatesToAnkiTsv,
  chunkText,
  clearAllLocalData,
  applyImportPlan,
  createExportManifest,
  createId,
  downloadTextFile,
  emptyImportPayload,
  getMetaLearnDb,
  parseImportPackage,
  planImport,
  type ParsedImportPackage,
  saveLearningEvent,
  serializeExportPackage,
  validateCardCandidateEvidence
} from "@metalearn/storage";
import { deriveWorkspace, emptyWorkspaceState, sampleText, type WorkspaceState } from "./workspace-selectors";

type ReviewStage = "confidence" | "answer" | "feedback";

interface PendingCardRequest {
  previewId: string;
  source: SourceDocument;
  requestedCount: number;
}

interface ManualCardForm {
  isOpen: boolean;
  sourceId: string;
  sourceChunkId: string;
  question: string;
  expectedAnswer: string;
  sourceQuote: string;
  cardType: CardType;
  difficulty: 1 | 2 | 3 | 4 | 5;
  tagsText: string;
}

interface ImportReport {
  materialCount: number;
  chunkCount: number;
  candidateCount: number;
  cardCount: number;
  reviewCount: number;
  skippedCount: number;
  repairedCount: number;
  firstMaterialId?: string;
}

const emptyManualCardForm: ManualCardForm = {
  isOpen: false,
  sourceId: "",
  sourceChunkId: "",
  question: "",
  expectedAnswer: "",
  sourceQuote: "",
  cardType: "mechanism",
  difficulty: 3,
  tagsText: ""
};

function result(ok: boolean, message: string, extra: Partial<ActionResult> = {}): ActionResult {
  return { ok, message, ...extra };
}

export function useMetaLearnWorkspace() {
  const [state, setState] = useState<WorkspaceState>(emptyWorkspaceState);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastAction, setLastAction] = useState<ActionResult | null>(null);
  const [nowMs, setNowMs] = useState(0);
  const [title, setTitle] = useState("我的学习材料");
  const [templateId, setTemplateId] = useState<LearningTemplateId>("course");
  const [sourceInputType, setSourceInputType] = useState<SourceInputType>("plain_text");
  const [sourceText, setSourceText] = useState(sampleText);
  const [searchQuery, setSearchQuery] = useState("");
  const [confidence, setConfidence] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [effort, setEffort] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [answerText, setAnswerText] = useState("");
  const [sourceVisibleBeforeAnswer, setSourceVisibleBeforeAnswer] = useState(false);
  const [mistakeReason, setMistakeReason] = useState<MistakeReason>("unknown");
  const [reviewStage, setReviewStage] = useState<ReviewStage>("confidence");
  const [revealedSourceQuote, setRevealedSourceQuote] = useState("");
  const [reviewFeedback, setReviewFeedback] = useState("还没有完成本轮校准复习。");
  const [concept, setConcept] = useState("间隔效应");
  const [explanation, setExplanation] = useState("请用自己的话解释一个概念，不要复制材料。");
  const [explainQuote, setExplainQuote] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [rubricScores, setRubricScores] = useState<ExplanationAttempt["rubricScores"] | null>(null);
  const [sessionTitle, setSessionTitle] = useState("今天的学习会话");
  const [goal, setGoal] = useState("用主动提取确认我是否真的掌握。");
  const [strategy, setStrategy] = useState("先预测，再学习，再用 3 个问题自测。");
  const [predictedMinutes, setPredictedMinutes] = useState(30);
  const [checkInIntervalMinutes, setCheckInIntervalMinutes] = useState<0 | 10 | 20 | 30>(0);
  const [checkInFocusState, setCheckInFocusState] = useState<CheckInFocusState>("focused");
  const [checkInUnderstanding, setCheckInUnderstanding] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [reflectionWorked, setReflectionWorked] = useState("");
  const [reflectionStuck, setReflectionStuck] = useState("");
  const [reflectionNext, setReflectionNext] = useState("");
  const [providerName, setProviderName] = useState("Local mock");
  const [modelName, setModelName] = useState("schema-checked-fallback");
  const [aiPreview, setAiPreview] = useState<AIRequestPreview | null>(null);
  const [pendingCardRequest, setPendingCardRequest] = useState<PendingCardRequest | null>(null);
  const [manualCardForm, setManualCardForm] = useState<ManualCardForm>(emptyManualCardForm);
  const [importText, setImportText] = useState("");
  const [importPackage, setImportPackage] = useState<ParsedImportPackage | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importPlan, setImportPlan] = useState<ImportPlan | null>(null);
  const [importStrategy, setImportStrategyState] = useState<ImportConflictStrategy>("keep_both");
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const db = getMetaLearnDb();
    const [
      sources,
      chunks,
      importJobs,
      candidates,
      cards,
      logs,
      sessions,
      checkIns,
      reflections,
      explanations,
      conceptNodes,
      conceptEdges,
      insights,
      aiConfigs,
      aiRequestPreviews
    ] = await Promise.all([
      db.sourceDocuments.orderBy("createdAt").reverse().toArray(),
      db.sourceChunks.toArray(),
      db.importJobs.orderBy("createdAt").reverse().toArray(),
      db.cardCandidates.orderBy("createdAt").reverse().toArray(),
      db.cards.orderBy("dueAt").toArray(),
      db.reviewLogs.orderBy("createdAt").toArray(),
      db.learningSessions.orderBy("startedAt").reverse().toArray(),
      db.checkIns.orderBy("createdAt").reverse().toArray(),
      db.reflections.orderBy("createdAt").reverse().toArray(),
      db.explanationAttempts.orderBy("createdAt").reverse().toArray(),
      db.conceptNodes.orderBy("updatedAt").reverse().toArray(),
      db.conceptEdges.orderBy("createdAt").reverse().toArray(),
      db.insightSnapshots.orderBy("createdAt").reverse().toArray(),
      db.aiProviderConfigs.orderBy("updatedAt").reverse().toArray(),
      db.aiRequestPreviews.orderBy("createdAt").reverse().toArray()
    ]);
    setState({ sources, chunks, importJobs, candidates, cards, logs, sessions, checkIns, reflections, explanations, conceptNodes, conceptEdges, insights, aiConfigs, aiRequestPreviews });
    setNowMs(Date.now());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadData().catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "本地数据加载失败。");
        setIsLoading(false);
      });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadData]);

  const now = useMemo(() => new Date(nowMs || 0), [nowMs]);
  const derived = useMemo(() => deriveWorkspace({ state, now, nowMs, searchQuery }), [state, now, nowMs, searchQuery]);
  const activeSource = state.sources[0];
  const activeCard = derived.activeCard;

  function setAction(action: ActionResult) {
    setLastAction(action);
    setError(action.ok ? "" : action.message);
    return action;
  }

  async function importSource(): Promise<ActionResult> {
    if (sourceText.trim().length < 40) return setAction(result(false, "材料至少需要 40 个字符，才能生成可用的来源片段。"));
    const timestamp = new Date().toISOString();
    const sourceId = createId("source");
    const importJobId = createId("import");
    const sourceChunks = chunkText(sourceId, sourceText);
    const source: SourceDocument = {
      id: sourceId,
      title,
      templateId,
      inputType: sourceInputType,
      rawText: sourceText,
      status: "chunked",
      summary: sourceText.trim().slice(0, 160),
      lastWorkedAt: timestamp,
      candidateCount: 0,
      approvedCardCount: 0,
      explanationCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const db = getMetaLearnDb();
    await db.transaction("rw", db.sourceDocuments, db.sourceChunks, db.importJobs, db.conceptNodes, async () => {
      await db.sourceDocuments.put(source);
      await db.sourceChunks.bulkPut(sourceChunks);
      await db.importJobs.put({ id: importJobId, sourceId, inputType: sourceInputType, status: "chunked", chunkCount: sourceChunks.length, createdAt: timestamp, updatedAt: timestamp });
      await db.conceptNodes.put({ id: `concept_material_${sourceId}`, label: title, source: "material", sourceId, strength: 1, createdAt: timestamp, updatedAt: timestamp });
    });
    const eventId = createId("event");
    await saveLearningEvent({ id: eventId, sourceId, appId: "metalearn-os", actionType: "source_imported", outcome: "saved", createdAt: timestamp });
    await loadData();
    return setAction(result(true, `已导入并分成 ${sourceChunks.length} 个来源片段。`, { eventId }));
  }

  async function prepareCandidateGeneration(source = activeSource): Promise<ActionResult> {
    if (!source) return setAction(result(false, "先导入一份材料，再生成候选题。"));
    const sourceChunks = state.chunks.filter((chunk) => chunk.sourceId === source.id).slice(0, 5);
    if (sourceChunks.length === 0) return setAction(result(false, "这份材料没有可用分块。请重新导入。"));
    const timestamp = new Date();
    const provider = state.aiConfigs[0] ?? {
      id: "local_mock",
      mode: "local_mock" as const,
      providerName,
      modelName,
      apiKeyStoredLocally: false,
      createdAt: timestamp.toISOString(),
      updatedAt: timestamp.toISOString()
    };
    const preview = buildAIRequestPreview({ id: createId("preview"), kind: "generate_cards", chunks: sourceChunks, sourceId: source.id, provider, createdAt: timestamp });
    await getMetaLearnDb().aiRequestPreviews.put(preview);
    await saveLearningEvent({ id: createId("event"), sourceId: source.id, appId: "metalearn-os", actionType: "ai_preview_created", outcome: "saved", createdAt: preview.createdAt });
    setAiPreview(preview);
    setPendingCardRequest({ previewId: preview.id, source, requestedCount: 8 });
    await loadData();
    return setAction(result(true, "已生成 AI 上传预览，确认后才会发送片段。", { requiresConfirmation: true }));
  }

  async function cancelAIRequestPreview(): Promise<ActionResult> {
    if (aiPreview) {
      await getMetaLearnDb().aiRequestPreviews.put({ ...aiPreview, status: "cancelled" });
    }
    setAiPreview(null);
    setPendingCardRequest(null);
    await loadData();
    return setAction(result(true, "已取消本次 AI 请求。"));
  }

  async function confirmCandidateGeneration(): Promise<ActionResult> {
    const request = pendingCardRequest;
    if (!request) return setAction(result(false, "没有待确认的 AI 请求。"));
    const sourceChunks = state.chunks.filter((chunk) => chunk.sourceId === request.source.id).slice(0, 5);
    if (sourceChunks.length === 0) return setAction(result(false, "这份材料没有可用分块。请重新导入。"));
    const db = getMetaLearnDb();
    const confirmedAt = new Date().toISOString();
    const preview = state.aiRequestPreviews.find((item) => item.id === request.previewId) ?? aiPreview;
    if (preview) await db.aiRequestPreviews.put({ ...preview, status: "confirmed", confirmedAt });
    const response = await fetch("/api/ai/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chunks: sourceChunks, templateId: request.source.templateId, requestedCount: request.requestedCount })
    });
    const payload = (await response.json()) as { candidates?: CardCandidate[]; error?: string };
    if (!response.ok || !payload.candidates) {
      if (preview) await db.aiRequestPreviews.put({ ...preview, status: "failed", confirmedAt, error: payload.error ?? "候选题生成失败。" });
      await loadData();
      return setAction(result(false, payload.error ?? "候选题生成失败。"));
    }
    const completedAt = new Date().toISOString();
    const updatedSource: SourceDocument = {
      ...request.source,
      status: "candidates",
      candidateCount: (request.source.candidateCount ?? 0) + payload.candidates.length,
      lastWorkedAt: completedAt,
      updatedAt: completedAt
    };
    await db.transaction("rw", db.cardCandidates, db.sourceDocuments, db.aiRequestPreviews, async () => {
      await db.cardCandidates.bulkPut(payload.candidates!);
      await db.sourceDocuments.put(updatedSource);
      if (preview) await db.aiRequestPreviews.put({ ...preview, status: "completed", confirmedAt, completedAt });
    });
    await saveLearningEvent({ id: createId("event"), sourceId: request.source.id, appId: "metalearn-os", actionType: "candidate_generated", outcome: "saved", createdAt: completedAt });
    setAiPreview(null);
    setPendingCardRequest(null);
    await loadData();
    return setAction(result(true, `已生成 ${payload.candidates.length} 张候选题，仍需人工审核。`));
  }

  async function updateCandidate(candidate: CardCandidate, patch: Partial<CardCandidate>) {
    await getMetaLearnDb().cardCandidates.put({ ...candidate, ...patch });
    await loadData();
  }

  function startManualCard(sourceId = activeSource?.id, chunkId?: string): ActionResult {
    const source = state.sources.find((item) => item.id === sourceId);
    if (!source) return setAction(result(false, "先选择一份材料，再手工建卡。"));
    if (source.status === "archived") return setAction(result(false, "这份材料已归档，恢复后才能继续建卡。"));
    const sourceChunks = state.chunks.filter((chunk) => chunk.sourceId === source.id).sort((left, right) => left.index - right.index);
    const selectedChunk = sourceChunks.find((chunk) => chunk.id === chunkId) ?? sourceChunks[0];
    if (!selectedChunk) return setAction(result(false, "这份材料没有可用来源片段，不能手工建卡。"));
    setManualCardForm({
      ...emptyManualCardForm,
      isOpen: true,
      sourceId: source.id,
      sourceChunkId: selectedChunk.id,
      sourceQuote: buildManualSourceQuote(selectedChunk),
      tagsText: `${source.templateId}, mechanism`
    });
    return setAction(result(true, "已打开手工建卡表单。保存后仍需批准，才会进入复习队列。"));
  }

  function updateManualCardForm(patch: Partial<ManualCardForm>) {
    setManualCardForm((current) => ({ ...current, ...patch }));
  }

  function selectManualCardChunk(chunkId: string): ActionResult {
    const chunk = state.chunks.find((item) => item.id === chunkId);
    if (!chunk) return setAction(result(false, "找不到所选来源片段。"));
    setManualCardForm((current) => ({
      ...current,
      sourceChunkId: chunk.id,
      sourceId: chunk.sourceId,
      sourceQuote: buildManualSourceQuote(chunk)
    }));
    return setAction(result(true, `已选择来源片段 #${chunk.index + 1}。`));
  }

  function resetManualCardForm() {
    setManualCardForm(emptyManualCardForm);
  }

  async function saveManualCandidate(): Promise<ActionResult> {
    const source = state.sources.find((item) => item.id === manualCardForm.sourceId);
    if (!source) return setAction(result(false, "找不到材料，无法保存手工候选题。"));
    if (source.status === "archived") return setAction(result(false, "这份材料已归档，恢复后才能继续建卡。"));
    const tags = manualCardForm.tagsText.split(/[,\n，]/).map((tag) => tag.trim()).filter(Boolean);
    const timestamp = new Date().toISOString();
    const candidate: CardCandidate = {
      id: createId("cand_manual"),
      question: manualCardForm.question.trim(),
      expectedAnswer: manualCardForm.expectedAnswer.trim(),
      sourceQuote: manualCardForm.sourceQuote.trim(),
      cardType: manualCardForm.cardType,
      difficulty: manualCardForm.difficulty,
      tags,
      sourceChunkId: manualCardForm.sourceChunkId.trim(),
      status: "candidate",
      createdAt: timestamp
    };
    const validation = validateCardCandidateEvidence(candidate, state.chunks);
    if (!validation.ok) return setAction(result(false, validation.reason ?? "手工候选题没有通过来源验证。"));
    const updatedSource: SourceDocument = {
      ...source,
      status: "candidates",
      candidateCount: (source.candidateCount ?? 0) + 1,
      lastWorkedAt: timestamp,
      updatedAt: timestamp
    };
    const db = getMetaLearnDb();
    await db.transaction("rw", db.cardCandidates, db.sourceDocuments, async () => {
      await db.cardCandidates.put(candidate);
      await db.sourceDocuments.put(updatedSource);
    });
    const eventId = createId("event");
    await saveLearningEvent({ id: eventId, sourceId: source.id, appId: "metalearn-os", actionType: "manual_candidate_created", outcome: "saved", createdAt: timestamp });
    setManualCardForm((current) => ({
      ...current,
      question: "",
      expectedAnswer: "",
      tagsText: current.tagsText || `${source.templateId}, ${current.cardType}`
    }));
    await loadData();
    return setAction(result(true, "已保存为候选题。批准后才会进入复习队列。", { eventId }));
  }

  async function rejectCandidate(candidate: CardCandidate): Promise<ActionResult> {
    await getMetaLearnDb().cardCandidates.put({ ...candidate, status: "rejected" });
    await saveLearningEvent({ id: createId("event"), appId: "metalearn-os", actionType: "candidate_rejected", outcome: "saved", createdAt: new Date().toISOString() });
    await loadData();
    return setAction(result(true, "已拒绝候选题。"));
  }

  async function approveCandidate(candidate: CardCandidate): Promise<ActionResult> {
    const validation = validateCardCandidateEvidence(candidate, state.chunks);
    if (!validation.ok) return setAction(result(false, validation.reason ?? "没有来源片段的候选题不能进入复习队列。"));
    const timestamp = new Date().toISOString();
    const sourceId = validation.chunk?.sourceId;
    const source = state.sources.find((item) => item.id === sourceId);
    const card: Card = {
      ...candidate,
      status: "approved",
      dueAt: timestamp,
      fsrs: createInitialFsrsState()
    };
    const db = getMetaLearnDb();
    await db.transaction("rw", db.cards, db.cardCandidates, db.sourceDocuments, db.conceptNodes, async () => {
      await db.cards.put(card);
      await db.cardCandidates.put({ ...candidate, status: "approved" });
      for (const tag of candidate.tags) {
        await db.conceptNodes.put({ id: `concept_tag_${tag}`, label: tag, source: "tag", strength: 1, createdAt: timestamp, updatedAt: timestamp });
      }
      if (source) {
        await db.sourceDocuments.put({ ...source, status: "reviewing", approvedCardCount: (source.approvedCardCount ?? 0) + 1, lastWorkedAt: timestamp, updatedAt: timestamp });
      }
    });
    const eventId = createId("event");
    await saveLearningEvent({ id: eventId, sourceId, appId: "metalearn-os", actionType: "card_approved", outcome: "saved", createdAt: timestamp });
    await loadData();
    return setAction(result(true, "已批准进入复习队列。", { eventId }));
  }

  async function approveAllCandidates(): Promise<ActionResult> {
    const validationById = new Map(derived.pendingCandidates.map((candidate) => [candidate.id, validateCardCandidateEvidence(candidate, state.chunks)]));
    const approvable = derived.pendingCandidates.filter((candidate) => validationById.get(candidate.id)?.ok);
    const blocked = derived.pendingCandidates.length - approvable.length;
    for (const candidate of approvable) {
      await approveCandidate(candidate);
    }
    await loadData();
    if (approvable.length === 0) {
      const firstFailure = [...validationById.values()].find((validation) => !validation.ok);
      return setAction(result(false, firstFailure?.reason ?? "没有可批准的候选题。"));
    }
    const blockedText = blocked > 0 ? `，${blocked} 张因来源证据不足被跳过` : "";
    return setAction(result(true, `已批量批准 ${approvable.length} 张候选题${blockedText}。`));
  }

  async function completeReview(outcome: ReviewOutcome): Promise<ActionResult> {
    if (!activeCard) return setAction(result(false, "当前没有可复习卡片。"));
    if (reviewStage === "confidence") return setAction(result(false, "请先选择信心，再主动回答。"));
    const judgment = confidenceToJudgment(confidence);
    const timestamp = new Date().toISOString();
    const isCorrect = outcomeToCorrectness(outcome);
    const inferredReason = isCorrect ? undefined : classifyMistakeReason(answerText, activeCard.sourceQuote);
    const baseLog = {
      answerText,
      durationMs: 90_000,
      selfRatedEffort: effort,
      sourceVisibleBeforeAnswer
    };
    const log: ReviewLog = {
      id: createId("review"),
      cardId: activeCard.id,
      sourceId: state.chunks.find((chunk) => chunk.id === activeCard.sourceChunkId)?.sourceId ?? "unknown",
      confidence,
      confidenceProbability: judgment.probability,
      answerText,
      outcome,
      isCorrect,
      mistakeReason: isCorrect ? undefined : mistakeReason === "unknown" ? inferredReason : mistakeReason,
      selfRatedEffort: effort,
      sourceVisibleBeforeAnswer,
      evidenceStrength: deriveReviewEvidenceStrength(baseLog),
      durationMs: baseLog.durationMs,
      createdAt: timestamp
    };
    const updatedCard = simplifiedFsrsAdapter.schedule(activeCard, outcome, new Date(timestamp));
    const gap = Math.abs(judgment.probability - (isCorrect ? 1 : 0));
    const db = getMetaLearnDb();
    await db.transaction("rw", db.reviewLogs, db.cards, async () => {
      await db.reviewLogs.put(log);
      await db.cards.put(updatedCard);
    });
    await saveLearningEvent({ id: createId("event"), sourceId: log.sourceId, appId: "metalearn-os", actionType: "review_completed", confidence, outcome, durationMs: log.durationMs, createdAt: timestamp });
    setReviewFeedback(`信心 ${judgment.label}，结果${isCorrect ? "答对" : "未掌握"}，校准差距 ${Math.round(gap * 100)}%，证据强度 ${log.evidenceStrength}。`);
    setRevealedSourceQuote(activeCard.sourceQuote);
    setReviewStage("feedback");
    setAnswerText("");
    setMistakeReason("unknown");
    setSourceVisibleBeforeAnswer(false);
    await loadData();
    return setAction(result(true, "本轮复习已记录，来源现在可见。"));
  }

  function chooseConfidence(value: 1 | 2 | 3 | 4 | 5) {
    setConfidence(value);
    setReviewStage("answer");
  }

  function startNextReview() {
    setReviewStage("confidence");
    setRevealedSourceQuote("");
    setAnswerText("");
    setReviewFeedback("还没有完成本轮校准复习。");
  }

  async function askSocraticQuestions(): Promise<ActionResult> {
    if (concept.trim().length < 2 || explanation.trim().length < 40) return setAction(result(false, "解释至少需要 40 个字符，追问才有意义。"));
    const preview = buildAIRequestPreview({
      id: createId("preview"),
      kind: "socratic_questions",
      chunks: [],
      provider: state.aiConfigs[0],
      createdAt: new Date()
    });
    await getMetaLearnDb().aiRequestPreviews.put({ ...preview, payloadSummary: "本次追问只发送你的解释文本，不发送资料库原文。" });
    const response = await fetch("/api/ai/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concept, explanation, templateId })
    });
    const payload = (await response.json()) as { result?: { questions: string[]; rubricScores: ExplanationAttempt["rubricScores"] }; error?: string };
    if (!response.ok || !payload.result) return setAction(result(false, payload.error ?? "追问生成失败。"));
    setQuestions(payload.result.questions);
    setRubricScores(payload.result.rubricScores);
    await getMetaLearnDb().aiRequestPreviews.put({ ...preview, status: "completed", completedAt: new Date().toISOString(), payloadSummary: "本次追问只发送你的解释文本，不发送资料库原文。" });
    await loadData();
    return setAction(result(true, "已生成 3 个追问；AI 没有提供标准答案。"));
  }

  async function saveExplanation(): Promise<ActionResult> {
    const timestamp = new Date().toISOString();
    const previous = state.explanations.find((item) => item.concept === concept);
    const attempt: ExplanationAttempt = {
      id: createId("explanation"),
      concept,
      templateId,
      explanation,
      versionIndex: state.explanations.filter((item) => item.concept === concept).length + 1,
      parentAttemptId: previous?.id,
      linkedCardIds: [],
      gapTags: deriveGapTags(rubricScores),
      priorRubricScores: previous?.rubricScores,
      rubricScores: rubricScores ?? { clarity: 3, mechanism: 2, example: 2, boundary: 2, contrast: 2 },
      questions,
      sourceQuote: explainQuote || undefined,
      createdAt: timestamp
    };
    const db = getMetaLearnDb();
    await db.transaction("rw", db.explanationAttempts, db.conceptNodes, async () => {
      await db.explanationAttempts.put(attempt);
      await db.conceptNodes.put({ id: `concept_explanation_${concept}`, label: concept, source: "explanation", sourceId: attempt.id, strength: scoreAverage(attempt.rubricScores), createdAt: timestamp, updatedAt: timestamp });
    });
    await saveLearningEvent({ id: createId("event"), appId: "metalearn-os", actionType: "explanation_attempted", outcome: "saved", durationMs: 180_000, createdAt: timestamp });
    await loadData();
    return setAction(result(true, `已保存 ${concept} 的 v${attempt.versionIndex} 解释版本。`));
  }

  async function handoffExplanation(): Promise<ActionResult> {
    const latest = state.explanations[0];
    if (!latest) return setAction(result(false, "先保存一个解释版本，再生成交接卡片。"));
    const candidates = buildCardsFromExplanation(latest).map((candidate) => ({
      ...candidate,
      tags: [...new Set([...candidate.tags, `explain-v${latest.versionIndex ?? 1}`])]
    }));
    await getMetaLearnDb().cardCandidates.bulkPut(candidates);
    await saveLearningEvent({ id: createId("event"), appId: "metalearn-os", actionType: "handoff_exported", outcome: "exported", createdAt: new Date().toISOString() });
    await loadData();
    return setAction(result(true, `已从解释版本 v${latest.versionIndex ?? 1} 生成 ${candidates.length} 张候选卡。`));
  }

  async function addConceptEdge(fromLabel: string, toLabel: string, relation: ConceptRelationType, evidence: string): Promise<ActionResult> {
    if (!fromLabel.trim() || !toLabel.trim()) return setAction(result(false, "概念边需要两个节点。"));
    const timestamp = new Date().toISOString();
    const fromId = `concept_manual_${fromLabel.trim()}`;
    const toId = `concept_manual_${toLabel.trim()}`;
    const db = getMetaLearnDb();
    await db.transaction("rw", db.conceptNodes, db.conceptEdges, async () => {
      await db.conceptNodes.put({ id: fromId, label: fromLabel.trim(), source: "explanation", strength: 1, createdAt: timestamp, updatedAt: timestamp });
      await db.conceptNodes.put({ id: toId, label: toLabel.trim(), source: "explanation", strength: 1, createdAt: timestamp, updatedAt: timestamp });
      await db.conceptEdges.put({ id: createId("edge"), fromNodeId: fromId, toNodeId: toId, relation, evidence, confirmed: true, createdAt: timestamp });
    });
    await saveLearningEvent({ id: createId("event"), appId: "metalearn-os", actionType: "concept_edge_added", outcome: "saved", createdAt: timestamp });
    await loadData();
    return setAction(result(true, "已确认概念连接。"));
  }

  async function saveSession(): Promise<ActionResult> {
    const timestamp = new Date().toISOString();
    const session: LearningSession = {
      id: createId("session"),
      title: sessionTitle,
      templateId,
      goal,
      strategy,
      predictedMinutes,
      actualMinutes: predictedMinutes,
      checkInIntervalMinutes,
      completionRating: 4,
      startedAt: timestamp,
      endedAt: timestamp
    };
    const reflection: Reflection = {
      id: createId("reflection"),
      sessionId: session.id,
      worked: reflectionWorked || "完成了一次主动学习记录。",
      stuck: reflectionStuck || "还没有明确卡壳点。",
      nextChange: reflectionNext || derived.dailyPlan.nextBestAction,
      createdAt: timestamp
    };
    const db = getMetaLearnDb();
    await db.transaction("rw", db.learningSessions, db.reflections, async () => {
      await db.learningSessions.put(session);
      await db.reflections.put(reflection);
    });
    await saveLearningEvent({ id: createId("event"), appId: "metalearn-os", actionType: "session_finished", outcome: "completed", durationMs: predictedMinutes * 60_000, createdAt: timestamp });
    setReflectionWorked("");
    setReflectionStuck("");
    setReflectionNext("");
    await loadData();
    return setAction(result(true, "已保存计划、预测和 2 分钟反思。"));
  }

  async function recordCheckIn(): Promise<ActionResult> {
    const session = state.sessions[0];
    if (!session) return setAction(result(false, "先保存一个学习会话，再记录 check-in。"));
    const timestamp = new Date().toISOString();
    await getMetaLearnDb().checkIns.put({ id: createId("checkin"), sessionId: session.id, focusState: checkInFocusState, understanding: checkInUnderstanding, createdAt: timestamp });
    await saveLearningEvent({ id: createId("event"), appId: "metalearn-os", actionType: "checkin_recorded", outcome: "saved", createdAt: timestamp });
    await loadData();
    return setAction(result(true, "已记录一次轻量 check-in。"));
  }

  async function saveInsight(): Promise<ActionResult> {
    const snapshot = derived.insight;
    await getMetaLearnDb().insightSnapshots.put({ ...snapshot, id: createId("insight"), createdAt: new Date().toISOString() });
    await saveLearningEvent({ id: createId("event"), appId: "metalearn-os", actionType: "insight_created", outcome: "saved", createdAt: snapshot.createdAt });
    await loadData();
    return setAction(result(true, "已保存洞察快照。"));
  }

  async function saveAIConfig(): Promise<ActionResult> {
    const timestamp = new Date().toISOString();
    const config: AIProviderConfig = {
      id: "primary",
      mode: "local_mock",
      providerName,
      modelName,
      apiKeyStoredLocally: false,
      createdAt: state.aiConfigs[0]?.createdAt ?? timestamp,
      updatedAt: timestamp
    };
    await getMetaLearnDb().aiProviderConfigs.put(config);
    await saveLearningEvent({ id: createId("event"), appId: "metalearn-os", actionType: "settings_updated", outcome: "saved", createdAt: timestamp });
    await loadData();
    return setAction(result(true, "已保存 AI provider 设置。"));
  }

  async function resetLocalData(): Promise<ActionResult> {
    await clearAllLocalData();
    await loadData();
    return setAction(result(true, "本地数据已清空。"));
  }

  async function prepareJsonImport(fileText: string): Promise<ActionResult> {
    setImportText(fileText);
    setImportReport(null);
    const parsed = parseImportPackage(fileText);
    if (!parsed.ok) {
      setImportPackage(null);
      setImportPreview(parsed.preview);
      setImportPlan(null);
      await saveLearningEvent({ id: createId("event"), appId: "metalearn-os", actionType: "data_import_failed", outcome: "saved", createdAt: new Date().toISOString() });
      return setAction(result(false, parsed.error));
    }
    const current = buildCurrentImportPayload(state);
    const nextPlan = planImport(parsed.package, current, importStrategy);
    setImportPackage(parsed.package);
    setImportPreview(nextPlan.preview);
    setImportPlan(nextPlan);
    await saveLearningEvent({ id: createId("event"), appId: "metalearn-os", actionType: "import_preview_created", outcome: "saved", createdAt: new Date().toISOString() });
    if (!nextPlan.preview.canImport) return setAction(result(false, "导入预检未通过，请先查看 fatal 问题。"));
    return setAction(result(true, "导入预览已生成。确认后才会写入本地数据。", { requiresConfirmation: true }));
  }

  function setImportStrategy(strategy: ImportConflictStrategy) {
    setImportStrategyState(strategy);
    if (!importPackage) return;
    const nextPlan = planImport(importPackage, buildCurrentImportPayload(state), strategy);
    setImportPreview(nextPlan.preview);
    setImportPlan(nextPlan);
  }

  function cancelJsonImport(): ActionResult {
    setImportText("");
    setImportPackage(null);
    setImportPreview(null);
    setImportPlan(null);
    setImportReport(null);
    return setAction(result(true, "已取消本次导入。"));
  }

  async function confirmJsonImport(): Promise<ActionResult> {
    if (!importPlan) return setAction(result(false, "没有可确认的导入计划。"));
    if (!importPlan.preview.canImport) return setAction(result(false, "导入预检未通过，不能写入本地数据。"));
    setIsImporting(true);
    try {
      await applyImportPlan(getMetaLearnDb(), importPlan);
      const timestamp = new Date().toISOString();
      const firstMaterialId = importPlan.inserts.materials[0]?.id;
      const eventId = createId("event");
      await saveLearningEvent({ id: eventId, sourceId: firstMaterialId, appId: "metalearn-os", actionType: "data_imported", outcome: "saved", createdAt: timestamp });
      setImportReport({
        materialCount: importPlan.inserts.materials.length,
        chunkCount: importPlan.inserts.chunks.length,
        candidateCount: importPlan.inserts.candidates.length,
        cardCount: importPlan.inserts.cards.length,
        reviewCount: importPlan.inserts.reviews.length,
        skippedCount: importPlan.skipped.length,
        repairedCount: importPlan.repaired.length,
        firstMaterialId
      });
      setImportText("");
      setImportPackage(null);
      setImportPreview(null);
      setImportPlan(null);
      await loadData();
      return setAction(result(true, "导入完成，数据已写入本地 IndexedDB。", { eventId }));
    } catch (caught) {
      await saveLearningEvent({ id: createId("event"), appId: "metalearn-os", actionType: "data_import_failed", outcome: "saved", createdAt: new Date().toISOString() });
      return setAction(result(false, caught instanceof Error ? caught.message : "导入失败，现有数据未被修改。"));
    } finally {
      setIsImporting(false);
    }
  }

  function exportJson() {
    const payload = {
      materials: state.sources,
      chunks: state.chunks,
      importJobs: state.importJobs,
      candidates: state.candidates,
      cards: state.cards,
      reviews: state.logs,
      explanations: state.explanations,
      conceptNodes: state.conceptNodes,
      conceptEdges: state.conceptEdges,
      sessions: state.sessions,
      checkIns: state.checkIns,
      reflections: state.reflections,
      insights: state.insights,
      aiRequestPreviews: state.aiRequestPreviews
    };
    downloadTextFile(
      "metalearn-os-export.json",
      serializeExportPackage(payload, createExportManifest(payload)),
      "application/json"
    );
    void saveLearningEvent({ id: createId("event"), appId: "metalearn-os", actionType: "data_exported", outcome: "exported", createdAt: new Date().toISOString() });
  }

  async function exportMaterial(sourceId: string): Promise<ActionResult> {
    const source = state.sources.find((item) => item.id === sourceId);
    if (!source) return setAction(result(false, "找不到要导出的材料。"));
    const chunks = state.chunks.filter((chunk) => chunk.sourceId === sourceId);
    const chunkIds = new Set(chunks.map((chunk) => chunk.id));
    const cards = state.cards.filter((card) => chunkIds.has(card.sourceChunkId));
    const cardIds = new Set(cards.map((card) => card.id));
    const reviews = state.logs.filter((log) => cardIds.has(log.cardId) || log.sourceId === sourceId);
    const explanations = state.explanations.filter((attempt) => chunks.some((chunk) => attempt.sourceQuote && chunk.text.includes(attempt.sourceQuote)));
    const candidates = state.candidates.filter((candidate) => chunkIds.has(candidate.sourceChunkId));
    const payload = {
      materials: [source],
      chunks,
      candidates,
      cards,
      reviews,
      explanations
    };
    downloadTextFile(
      `metalearn-material-${source.id}.json`,
      serializeExportPackage(payload, createExportManifest(payload)),
      "application/json"
    );
    const eventId = createId("event");
    await saveLearningEvent({ id: eventId, sourceId, appId: "metalearn-os", actionType: "data_exported", outcome: "exported", createdAt: new Date().toISOString() });
    return setAction(result(true, "已导出该材料的证据包。", { eventId }));
  }

  async function archiveSource(sourceId: string): Promise<ActionResult> {
    const source = state.sources.find((item) => item.id === sourceId);
    if (!source) return setAction(result(false, "找不到要归档的材料。"));
    const timestamp = new Date().toISOString();
    await getMetaLearnDb().sourceDocuments.put({ ...source, status: "archived", lastWorkedAt: timestamp, updatedAt: timestamp });
    const eventId = createId("event");
    await saveLearningEvent({ id: eventId, sourceId, appId: "metalearn-os", actionType: "source_archived", outcome: "saved", createdAt: timestamp });
    await loadData();
    return setAction(result(true, "材料已归档，证据、卡片和复习记录仍保留。", { eventId }));
  }

  async function restoreSource(sourceId: string): Promise<ActionResult> {
    const source = state.sources.find((item) => item.id === sourceId);
    if (!source) return setAction(result(false, "找不到要恢复的材料。"));
    const timestamp = new Date().toISOString();
    const nextStatus: SourceDocument["status"] = (source.approvedCardCount ?? 0) > 0 ? "reviewing" : (source.candidateCount ?? 0) > 0 ? "candidates" : "chunked";
    await getMetaLearnDb().sourceDocuments.put({ ...source, status: nextStatus, lastWorkedAt: timestamp, updatedAt: timestamp });
    const eventId = createId("event");
    await saveLearningEvent({ id: eventId, sourceId, appId: "metalearn-os", actionType: "source_restored", outcome: "saved", createdAt: timestamp });
    await loadData();
    return setAction(result(true, "材料已恢复到可继续学习状态。", { eventId }));
  }

  return {
    state,
    derived,
    isLoading,
    error,
    lastAction,
    now,
    title,
    setTitle,
    templateId,
    setTemplateId,
    sourceInputType,
    setSourceInputType,
    sourceText,
    setSourceText,
    searchQuery,
    setSearchQuery,
    confidence,
    chooseConfidence,
    effort,
    setEffort,
    answerText,
    setAnswerText,
    sourceVisibleBeforeAnswer,
    setSourceVisibleBeforeAnswer,
    mistakeReason,
    setMistakeReason,
    reviewStage,
    revealedSourceQuote,
    reviewFeedback,
    startNextReview,
    concept,
    setConcept,
    explanation,
    setExplanation,
    explainQuote,
    setExplainQuote,
    questions,
    rubricScores,
    sessionTitle,
    setSessionTitle,
    goal,
    setGoal,
    strategy,
    setStrategy,
    predictedMinutes,
    setPredictedMinutes,
    checkInIntervalMinutes,
    setCheckInIntervalMinutes,
    checkInFocusState,
    setCheckInFocusState,
    checkInUnderstanding,
    setCheckInUnderstanding,
    reflectionWorked,
    setReflectionWorked,
    reflectionStuck,
    setReflectionStuck,
    reflectionNext,
    setReflectionNext,
    providerName,
    setProviderName,
    modelName,
    setModelName,
    aiPreview,
    manualCardForm,
    importText,
    importPreview,
    importPlan,
    importStrategy,
    importReport,
    isImporting,
    importSource,
    prepareCandidateGeneration,
    confirmCandidateGeneration,
    cancelAIRequestPreview,
    updateCandidate,
    startManualCard,
    updateManualCardForm,
    selectManualCardChunk,
    resetManualCardForm,
    saveManualCandidate,
    approveCandidate,
    approveAllCandidates,
    rejectCandidate,
    completeReview,
    askSocraticQuestions,
    saveExplanation,
    handoffExplanation,
    addConceptEdge,
    saveSession,
    recordCheckIn,
    saveInsight,
    saveAIConfig,
    resetLocalData,
    prepareJsonImport,
    setImportStrategy,
    cancelJsonImport,
    confirmJsonImport,
    exportJson,
    exportMaterial,
    archiveSource,
    restoreSource,
    downloadCsv: () => downloadTextFile("metalearn-cards.csv", cardsToCsv(state.cards), "text/csv;charset=utf-8"),
    downloadAnki: () => downloadTextFile("metalearn-anki.tsv", candidatesToAnkiTsv(state.cards), "text/tab-separated-values;charset=utf-8")
  };
}

function deriveGapTags(scores: ExplanationAttempt["rubricScores"] | null): string[] {
  if (!scores) return ["needs_questions"];
  return Object.entries(scores)
    .filter(([, value]) => value <= 2)
    .map(([key]) => key);
}

function scoreAverage(scores: ExplanationAttempt["rubricScores"]): number {
  const values = Object.values(scores);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildManualSourceQuote(chunk: SourceChunk): string {
  return chunk.text.replace(/\s+/g, " ").trim().slice(0, 260);
}

function buildCurrentImportPayload(state: WorkspaceState): ImportPackagePayload {
  return {
    ...emptyImportPayload(),
    materials: state.sources,
    chunks: state.chunks,
    importJobs: state.importJobs,
    candidates: state.candidates,
    cards: state.cards,
    reviews: state.logs,
    explanations: state.explanations,
    conceptNodes: state.conceptNodes,
    conceptEdges: state.conceptEdges,
    sessions: state.sessions,
    checkIns: state.checkIns,
    reflections: state.reflections,
    insights: state.insights,
    aiProviderConfigs: state.aiConfigs,
    aiRequestPreviews: state.aiRequestPreviews
  };
}
