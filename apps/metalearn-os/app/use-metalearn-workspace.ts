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
  RepairTaskResolution,
  ReviewLog,
  ReviewOutcome,
  ReviewStateMachine,
  SavedStudyView,
  SourceInputType,
  SourceChunk,
  SourceDocument
} from "@metalearn/core";
import {
  confidenceToJudgment,
  createRepairTaskFromReview,
  createInitialFsrsState,
  createReviewState,
  deriveReviewEvidenceStrength,
  outcomeToCorrectness,
  shouldCreateRepairTask,
  simplifiedFsrsAdapter,
  transitionReviewState
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
import { extractPdfTextFromFile } from "./pdf-import";
import {
  analyzeMaterialTextQuality,
  createMaterialImportDraft,
  deriveCandidateGenerationDiagnostic,
  type MaterialFileKind,
  type MaterialImportDraft
} from "./material-import-state";
import { deriveWorkspace, emptyWorkspaceState, sampleText, type StudyView, type WorkspaceState } from "./workspace-selectors";

interface PendingCardRequest {
  previewId: string;
  source: SourceDocument;
  chunks: SourceChunk[];
  requestedCount: number;
}

interface ReviewScope {
  tag?: string;
  sourceId?: string;
}

interface ReviewUndoSnapshot {
  log: ReviewLog;
  previousCard: Card;
  repairTaskId?: string;
  createdAt: string;
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
  savedStudyViewCount: number;
  skippedCount: number;
  repairedCount: number;
  firstMaterialId?: string;
}

interface SavedSourceRecord {
  source: SourceDocument;
  sourceChunks: SourceChunk[];
  eventId: string;
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
  const [title, setTitleState] = useState("我的学习材料");
  const [templateId, setTemplateId] = useState<LearningTemplateId>("course");
  const [sourceInputType, setSourceInputTypeState] = useState<SourceInputType>("plain_text");
  const [sourceText, setSourceTextState] = useState(sampleText);
  const [isReadingMaterialFile, setIsReadingMaterialFile] = useState(false);
  const [materialImportDraft, setMaterialImportDraft] = useState<MaterialImportDraft>(() =>
    createMaterialImportDraft({ title: "我的学习材料", inputType: "plain_text", textLength: sampleText.length })
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [reviewScope, setReviewScopeState] = useState<ReviewScope>({});
  const [confidence, setConfidence] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [effort, setEffort] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [reviewMachine, setReviewMachine] = useState<ReviewStateMachine>(createReviewState());
  const [mistakeReason, setMistakeReason] = useState<MistakeReason>("unknown");
  const [revealedSourceQuote, setRevealedSourceQuote] = useState("");
  const [reviewFeedback, setReviewFeedback] = useState("还没有完成本轮校准复习。");
  const [lastReviewUndo, setLastReviewUndo] = useState<ReviewUndoSnapshot | null>(null);
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
  const [activeRepairTaskId, setActiveRepairTaskId] = useState("");

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
      aiRequestPreviews,
      repairTasks,
      savedStudyViews
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
      db.aiRequestPreviews.orderBy("createdAt").reverse().toArray(),
      db.repairTasks.orderBy("createdAt").reverse().toArray(),
      db.savedStudyViews.orderBy("updatedAt").reverse().toArray()
    ]);
    setState({
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
      aiRequestPreviews,
      repairTasks,
      savedStudyViews: savedStudyViews.sort(compareSavedStudyViews)
    });
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
  const materialTextQuality = useMemo(() => analyzeMaterialTextQuality(sourceText, materialImportDraft.pageCount), [sourceText, materialImportDraft.pageCount]);
  const candidateDiagnostic = useMemo(
    () =>
      deriveCandidateGenerationDiagnostic({
        currentText: sourceText,
        draft: materialImportDraft,
        sources: state.sources,
        chunks: state.chunks,
        previews: state.aiRequestPreviews,
        candidates: state.candidates,
        quality: materialTextQuality
      }),
    [sourceText, materialImportDraft, state.sources, state.chunks, state.aiRequestPreviews, state.candidates, materialTextQuality]
  );
  function getCandidateDiagnostic(sourceId?: string) {
    return deriveCandidateGenerationDiagnostic({
      currentText: sourceText,
      draft: materialImportDraft,
      sources: state.sources,
      chunks: state.chunks,
      previews: state.aiRequestPreviews,
      candidates: state.candidates,
      quality: materialTextQuality,
      sourceId
    });
  }
  const activeSource = state.sources[0];
  const hasReviewScope = Boolean(reviewScope.tag || reviewScope.sourceId);
  const scopedReviewQueue = useMemo(
    () => derived.reviewQueue.filter((item) => cardMatchesReviewScope(item.card, reviewScope, state.chunks)),
    [derived.reviewQueue, reviewScope, state.chunks]
  );
  const scopedCards = useMemo(
    () => state.cards.filter((card) => cardMatchesReviewScope(card, reviewScope, state.chunks)),
    [state.cards, reviewScope, state.chunks]
  );
  const scopedDueCards = scopedCards.filter((card) => new Date(card.dueAt).getTime() <= nowMs);
  const activeCard = hasReviewScope ? scopedDueCards[0] ?? scopedCards[0] : derived.activeCard;
  const effectiveReviewMachine = useMemo(() => {
    if (!activeCard) return reviewMachine.stage === "idle" ? reviewMachine : createReviewState();
    if (reviewMachine.stage === "feedback") return reviewMachine;
    if (reviewMachine.cardId === activeCard.id && reviewMachine.stage !== "idle") return reviewMachine;
    return createReviewState(activeCard.id);
  }, [activeCard, reviewMachine]);
  const activeReviewCard = state.cards.find((card) => card.id === effectiveReviewMachine.cardId) ?? activeCard;

  function setAction(action: ActionResult) {
    setLastAction(action);
    setError(action.ok ? "" : action.message);
    return action;
  }

  function updateMaterialImportDraft(patch: Partial<MaterialImportDraft>) {
    setMaterialImportDraft((current) => ({
      ...current,
      ...patch,
      updatedAt: new Date().toISOString()
    }));
  }

  function setMaterialImportFailure(message: string, patch: Partial<MaterialImportDraft> = {}) {
    updateMaterialImportDraft({ ...patch, stage: "failed", error: message });
    return setAction(result(false, message));
  }

  function setTitle(value: string) {
    setTitleState(value);
    updateMaterialImportDraft({ title: value });
  }

  function setSourceInputType(value: SourceInputType) {
    setSourceInputTypeState(value);
    updateMaterialImportDraft({ inputType: value });
  }

  function setSourceText(value: string) {
    setSourceTextState(value);
    updateMaterialImportDraft({
      stage: value.trim().length > 0 ? "text_ready" : "idle",
      fileKind: "pasted",
      textLength: value.trim().length,
      pageCount: undefined,
      sourceId: undefined,
      chunkCount: undefined,
      previewId: undefined,
      generatedCandidateCount: undefined,
      candidateIds: [],
      error: undefined
    });
  }

  function setReviewScope(scope: ReviewScope) {
    const nextScope = {
      tag: scope.tag?.trim() || undefined,
      sourceId: scope.sourceId?.trim() || undefined
    };
    if (reviewScope.tag === nextScope.tag && reviewScope.sourceId === nextScope.sourceId) return;
    setReviewScopeState(nextScope);
    setReviewMachine(createReviewState());
    setRevealedSourceQuote("");
    setReviewFeedback(nextScope.tag || nextScope.sourceId ? "已切换复习筛选范围，请从信心预测开始。" : "还没有完成本轮校准复习。");
  }

  function clearReviewScope() {
    setReviewScope({});
  }

  async function prepareMaterialFileImport(file: File): Promise<ActionResult> {
    const lowerName = file.name.toLowerCase();
    const isPdf = file.type === "application/pdf" || lowerName.endsWith(".pdf");
    const isMarkdown = lowerName.endsWith(".md") || lowerName.endsWith(".markdown") || file.type === "text/markdown";
    const isText = isMarkdown || lowerName.endsWith(".txt") || file.type.startsWith("text/");
    const fileKind: MaterialFileKind = isPdf ? "pdf" : isMarkdown ? "markdown" : "txt";
    if (!isPdf && !isText) return setMaterialImportFailure("当前材料文件只支持 PDF、TXT、MD 和 Markdown。JSON 备份包请使用右侧“导入与恢复”。", { fileName: file.name });
    if (file.size > 25 * 1024 * 1024) return setMaterialImportFailure("材料文件超过 25 MB。请先拆分材料，或粘贴其中一段可学习文本。", { fileName: file.name, fileKind });
    setIsReadingMaterialFile(true);
    updateMaterialImportDraft({
      stage: "file_reading",
      fileName: file.name,
      fileKind,
      title,
      inputType: sourceInputType,
      textLength: 0,
      pageCount: undefined,
      sourceId: undefined,
      chunkCount: undefined,
      previewId: undefined,
      generatedCandidateCount: undefined,
      candidateIds: [],
      error: undefined
    });
    try {
      const fileTitle = file.name.replace(/\.(pdf|txt|markdown|md)$/i, "").trim();
      const nextTitle = fileTitle && (!title.trim() || title === "我的学习材料") ? fileTitle : title;
      if (nextTitle !== title) setTitleState(nextTitle);

      if (isPdf) {
        const extraction = await extractPdfTextFromFile(file);
        setSourceInputTypeState("pdf_text");
        setSourceTextState(extraction.text);
        const summary = `已从 PDF 提取 ${extraction.pageCount} 页、${extraction.text.length} 个字符。当前只是读取到编辑框，还没有入库。请检查文本后保存，或直接保存并生成候选题。`;
        updateMaterialImportDraft({
          stage: "text_ready",
          fileName: file.name,
          fileKind,
          title: nextTitle,
          inputType: "pdf_text",
          textLength: extraction.text.length,
          pageCount: extraction.pageCount,
          error: undefined
        });
        return setAction(result(true, summary));
      }

      const text = (await file.text()).trim();
      const nextInputType: SourceInputType = isMarkdown ? "markdown" : "plain_text";
      if (text.length < 40) return setMaterialImportFailure("材料至少需要 40 个字符。请换一个文件，或粘贴更完整的学习内容。", { fileName: file.name, fileKind, title: nextTitle, inputType: nextInputType, textLength: text.length });
      setSourceInputTypeState(nextInputType);
      setSourceTextState(text);
      const summary = `已读取 ${isMarkdown ? "Markdown" : "文本"} 文件，${text.length} 个字符。当前只是读取到编辑框，还没有入库。请检查文本后保存，或直接保存并生成候选题。`;
      updateMaterialImportDraft({
        stage: "text_ready",
        fileName: file.name,
        fileKind,
        title: nextTitle,
        inputType: nextInputType,
        textLength: text.length,
        pageCount: undefined,
        error: undefined
      });
      return setAction(result(true, summary));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "文件读取失败。请确认文件格式受支持。";
      return setMaterialImportFailure(message, { fileName: file.name, fileKind });
    } finally {
      setIsReadingMaterialFile(false);
    }
  }

  async function saveSourceFromCurrentInput(): Promise<SavedSourceRecord | ActionResult> {
    const quality = analyzeMaterialTextQuality(sourceText, materialImportDraft.pageCount);
    if (quality.blockingError) return setMaterialImportFailure(quality.blockingError, { textLength: quality.charCount, pageCount: quality.pageCount });
    updateMaterialImportDraft({ stage: "saving_source", title, inputType: sourceInputType, textLength: quality.charCount, error: undefined });
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
    updateMaterialImportDraft({ stage: "source_saved", sourceId, chunkCount: sourceChunks.length, title, inputType: sourceInputType, textLength: sourceText.trim().length, error: undefined });
    return { source, sourceChunks, eventId };
  }

  async function importSource(): Promise<ActionResult> {
    const saved = await saveSourceFromCurrentInput();
    if ("ok" in saved) return saved;
    return setAction(result(true, `已导入并分成 ${saved.sourceChunks.length} 个来源片段。`, { eventId: saved.eventId }));
  }

  async function prepareCandidateGeneration(source = activeSource): Promise<ActionResult> {
    if (!source) {
      const message = materialImportDraft.stage === "text_ready" ? "文件已读取到编辑框，但还没有保存为材料。" : "先导入一份材料，再生成候选题。";
      return setMaterialImportFailure(message);
    }
    const sourceChunks = state.chunks.filter((chunk) => chunk.sourceId === source.id).slice(0, 5);
    if (sourceChunks.length === 0) return setMaterialImportFailure("这份材料没有可用分块。请重新导入。", { sourceId: source.id, title: source.title, chunkCount: 0 });
    return prepareCandidateGenerationFromChunks(source, sourceChunks);
  }

  async function prepareRecentCandidateGeneration(): Promise<ActionResult> {
    const diagnostic = getCandidateDiagnostic();
    if (diagnostic.nextAction === "save_source") {
      return setAction(result(false, diagnostic.blockingReason ?? "文件已读取到编辑框，但还没有保存为材料。"));
    }
    if (diagnostic.nextAction === "confirm_preview") {
      return setAction(result(false, diagnostic.blockingReason ?? "已生成上传预览，请确认后生成候选题。", { requiresConfirmation: true }));
    }
    if (diagnostic.nextAction === "review_candidates") {
      return setAction(result(true, `已有 ${diagnostic.pendingCandidateCount || materialImportDraft.generatedCandidateCount || 0} 张候选题，请在下方审核台处理。`));
    }
    if (diagnostic.nextAction === "manual_card") {
      return setAction(result(false, diagnostic.blockingReason ?? "候选题生成不可用，可以改为手工建卡。"));
    }
    return prepareCandidateGeneration(activeSource);
  }

  async function prepareCandidateGenerationFromChunks(source: SourceDocument, sourceChunks: SourceChunk[]): Promise<ActionResult> {
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
    setPendingCardRequest({ previewId: preview.id, source, chunks: sourceChunks, requestedCount: 8 });
    updateMaterialImportDraft({ stage: "preview_ready", sourceId: source.id, title: source.title, inputType: source.inputType ?? sourceInputType, chunkCount: sourceChunks.length, previewId: preview.id, error: undefined });
    await loadData();
    return setAction(result(true, "已生成 AI 上传预览，确认后才会发送片段。", { requiresConfirmation: true }));
  }

  async function importSourceAndPrepareCandidates(): Promise<ActionResult> {
    const saved = await saveSourceFromCurrentInput();
    if ("ok" in saved) return saved;
    return prepareCandidateGenerationFromChunks(saved.source, saved.sourceChunks.slice(0, 5));
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
    if (!request) return setMaterialImportFailure("没有待确认的 AI 请求。");
    const sourceChunks = request.chunks.length > 0 ? request.chunks : state.chunks.filter((chunk) => chunk.sourceId === request.source.id).slice(0, 5);
    if (sourceChunks.length === 0) return setMaterialImportFailure("这份材料没有可用分块。请重新导入。", { sourceId: request.source.id, title: request.source.title, chunkCount: 0 });
    const db = getMetaLearnDb();
    const confirmedAt = new Date().toISOString();
    const preview = state.aiRequestPreviews.find((item) => item.id === request.previewId) ?? aiPreview;
    if (preview) await db.aiRequestPreviews.put({ ...preview, status: "confirmed", confirmedAt });
    updateMaterialImportDraft({ stage: "generating_candidates", sourceId: request.source.id, title: request.source.title, chunkCount: sourceChunks.length, previewId: request.previewId, error: undefined });
    const response = await fetch("/api/ai/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chunks: sourceChunks, templateId: request.source.templateId, requestedCount: request.requestedCount })
    });
    const payload = (await response.json()) as { candidates?: CardCandidate[]; error?: string };
    if (!response.ok || !payload.candidates) {
      if (preview) await db.aiRequestPreviews.put({ ...preview, status: "failed", confirmedAt, error: payload.error ?? "候选题生成失败。" });
      await loadData();
      return setMaterialImportFailure(payload.error ?? "候选题生成失败，但材料已保存，可手工建卡。", { sourceId: request.source.id, title: request.source.title, previewId: request.previewId });
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
    updateMaterialImportDraft({ stage: "candidates_ready", sourceId: request.source.id, title: request.source.title, chunkCount: sourceChunks.length, previewId: request.previewId, generatedCandidateCount: payload.candidates.length, candidateIds: payload.candidates.map((candidate) => candidate.id), error: undefined });
    return setAction(result(true, `已生成 ${payload.candidates.length} 张候选题，仍需在下方“候选题审核台”人工审核。`));
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
    const eventByOutcome = {
      again: "self_rate_again",
      partial: "self_rate_partial",
      correct: "self_rate_correct",
      easy: "self_rate_easy"
    } as const;
    const transition = transitionReviewState(effectiveReviewMachine, eventByOutcome[outcome]);
    if (!transition.ok || !transition.outcome) return setAction(result(false, transition.error ?? "复习状态不允许自评。"));
    const selectedConfidence = transition.state.confidence ?? confidence;
    const judgment = confidenceToJudgment(selectedConfidence);
    const timestamp = new Date().toISOString();
    const isCorrect = outcomeToCorrectness(outcome);
    const inferredReason = isCorrect ? undefined : classifyMistakeReason(transition.state.answerText, activeCard.sourceQuote);
    const startedAt = transition.state.startedAt ? new Date(transition.state.startedAt).getTime() : Date.now() - 90_000;
    const durationMs = Math.max(1_000, Date.now() - startedAt);
    const baseLog = {
      answerText: transition.state.answerText,
      durationMs,
      selfRatedEffort: effort,
      sourceVisibleBeforeAnswer: transition.state.sourceVisibleBeforeAnswer
    };
    const log: ReviewLog = {
      id: createId("review"),
      cardId: activeCard.id,
      sourceId: state.chunks.find((chunk) => chunk.id === activeCard.sourceChunkId)?.sourceId ?? "unknown",
      confidence: selectedConfidence,
      confidenceProbability: judgment.probability,
      answerText: transition.state.answerText,
      outcome,
      isCorrect,
      mistakeReason: isCorrect ? undefined : mistakeReason === "unknown" ? inferredReason : mistakeReason,
      selfRatedEffort: effort,
      sourceVisibleBeforeAnswer: transition.state.sourceVisibleBeforeAnswer,
      evidenceStrength: deriveReviewEvidenceStrength(baseLog),
      durationMs: baseLog.durationMs,
      createdAt: timestamp
    };
    const updatedCard = simplifiedFsrsAdapter.schedule(activeCard, outcome, new Date(timestamp));
    const gap = Math.abs(judgment.probability - (isCorrect ? 1 : 0));
    const db = getMetaLearnDb();
    let repairTaskId: string | undefined;
    await db.transaction("rw", db.reviewLogs, db.cards, db.repairTasks, async () => {
      await db.reviewLogs.put(log);
      await db.cards.put(updatedCard);
      if (shouldCreateRepairTask(log)) {
        const existing = await db.repairTasks.where("reviewLogId").equals(log.id).first();
        if (!existing) {
          repairTaskId = createId("repair");
          await db.repairTasks.put(createRepairTaskFromReview({ id: repairTaskId, log, card: activeCard, sourceChunkId: activeCard.sourceChunkId, now: new Date(timestamp) }));
        }
      }
    });
    await saveLearningEvent({ id: createId("event"), sourceId: log.sourceId, appId: "metalearn-os", actionType: "review_completed", confidence: selectedConfidence, outcome, durationMs: log.durationMs, createdAt: timestamp });
    if (repairTaskId) await saveLearningEvent({ id: createId("event"), sourceId: log.sourceId, appId: "metalearn-os", actionType: "repair_task_created", confidence: selectedConfidence, outcome, createdAt: timestamp });
    setLastReviewUndo({ log, previousCard: activeCard, repairTaskId, createdAt: timestamp });
    setReviewFeedback(`信心 ${judgment.label}，结果${isCorrect ? "答对" : "未掌握"}，校准差距 ${Math.round(gap * 100)}%，证据强度 ${log.evidenceStrength}。`);
    setRevealedSourceQuote(activeCard.sourceQuote);
    setReviewMachine(transition.state);
    setMistakeReason("unknown");
    await loadData();
    return setAction(result(true, repairTaskId ? "本轮复习已记录，并创建高信心错误修复任务。" : "本轮复习已记录，来源现在可见。"));
  }

  async function undoLastReview(): Promise<ActionResult> {
    if (!lastReviewUndo) return setAction(result(false, "当前没有可撤销的最近复习。"));
    const { log, previousCard, repairTaskId } = lastReviewUndo;
    const db = getMetaLearnDb();
    try {
      await db.transaction("rw", db.reviewLogs, db.cards, db.repairTasks, async () => {
        const existingLog = await db.reviewLogs.get(log.id);
        if (!existingLog) throw new Error("这条复习记录已经不存在，不能撤销。");
        if (repairTaskId) {
          const task = await db.repairTasks.get(repairTaskId);
          const taskWasAlreadyUsed =
            task &&
            (task.reviewLogId !== log.id ||
              task.status !== "open" ||
              Boolean(task.linkedExplanationId) ||
              (task.linkedRemedialCandidateIds?.length ?? 0) > 0);
          if (taskWasAlreadyUsed) throw new Error("这条复习已经进入修复流程，不能安全撤销。");
          if (task) await db.repairTasks.delete(task.id);
        }
        await db.reviewLogs.delete(log.id);
        await db.cards.put(previousCard);
      });
    } catch (caught) {
      return setAction(result(false, caught instanceof Error ? caught.message : "撤销复习失败。"));
    }
    await saveLearningEvent({ id: createId("event"), sourceId: log.sourceId, appId: "metalearn-os", actionType: "review_undone", confidence: log.confidence, outcome: "completed", createdAt: new Date().toISOString() });
    setLastReviewUndo(null);
    setConfidence(log.confidence);
    setEffort(log.selfRatedEffort ?? 3);
    setMistakeReason(log.mistakeReason ?? "unknown");
    setRevealedSourceQuote(log.sourceVisibleBeforeAnswer ? previousCard.sourceQuote : "");
    setReviewFeedback("已撤销本次复习；答案和信心已保留，可以重新自评。");
    setReviewMachine({
      stage: "self_rating",
      cardId: previousCard.id,
      confidence: log.confidence,
      answerText: log.answerText,
      sourceVisibleBeforeAnswer: Boolean(log.sourceVisibleBeforeAnswer),
      startedAt: new Date(Date.now() - Math.max(1_000, log.durationMs)).toISOString(),
      answeredAt: log.createdAt
    });
    await loadData();
    return setAction(result(true, "已撤销本次复习，可以重新选择自评结果。"));
  }

  function chooseConfidence(value: 1 | 2 | 3 | 4 | 5) {
    const transition = transitionReviewState(effectiveReviewMachine, "choose_confidence", { confidence: value });
    if (!transition.ok) {
      setAction(result(false, transition.error ?? "当前阶段不能选择信心。"));
      return;
    }
    setConfidence(value);
    setReviewMachine(transition.state);
  }

  function setReviewAnswer(value: string) {
    const transition = transitionReviewState(effectiveReviewMachine, "edit_answer", { answerText: value });
    if (!transition.ok) {
      setAction(result(false, transition.error ?? "当前阶段不能编辑答案。"));
      return;
    }
    setReviewMachine(transition.state);
  }

  function markSourceSeenBeforeAnswer() {
    const transition = transitionReviewState(effectiveReviewMachine, "mark_source_seen");
    if (!transition.ok) {
      setAction(result(false, transition.error ?? "当前阶段不能提前查看来源。"));
      return;
    }
    setRevealedSourceQuote(activeCard?.sourceQuote ?? "");
    setReviewMachine(transition.state);
    setAction(result(true, "已显示来源，本轮会记录为弱提取证据。"));
  }

  function startNextReview() {
    const transition = transitionReviewState(effectiveReviewMachine, "next_card", { cardId: activeCard?.id });
    if (!transition.ok) {
      setAction(result(false, transition.error ?? "当前阶段不能进入下一张。"));
      return;
    }
    setRevealedSourceQuote("");
    setLastReviewUndo(null);
    setReviewMachine(createReviewState(activeCard?.id));
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
    await db.transaction("rw", db.explanationAttempts, db.conceptNodes, db.repairTasks, async () => {
      await db.explanationAttempts.put(attempt);
      await db.conceptNodes.put({ id: `concept_explanation_${concept}`, label: concept, source: "explanation", sourceId: attempt.id, strength: scoreAverage(attempt.rubricScores), createdAt: timestamp, updatedAt: timestamp });
      if (activeRepairTaskId) {
        const task = await db.repairTasks.get(activeRepairTaskId);
        if (task) await db.repairTasks.put({ ...task, status: "in_progress", linkedExplanationId: attempt.id, updatedAt: timestamp });
      }
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
    const db = getMetaLearnDb();
    await db.transaction("rw", db.cardCandidates, db.repairTasks, async () => {
      await db.cardCandidates.bulkPut(candidates);
      if (activeRepairTaskId) {
        const task = await db.repairTasks.get(activeRepairTaskId);
        if (task) {
          await db.repairTasks.put({
            ...task,
            status: "in_progress",
            linkedRemedialCandidateIds: [...new Set([...task.linkedRemedialCandidateIds, ...candidates.map((candidate) => candidate.id)])],
            updatedAt: new Date().toISOString()
          });
        }
      }
    });
    await saveLearningEvent({ id: createId("event"), appId: "metalearn-os", actionType: "handoff_exported", outcome: "exported", createdAt: new Date().toISOString() });
    await loadData();
    return setAction(result(true, `已从解释版本 v${latest.versionIndex ?? 1} 生成 ${candidates.length} 张候选卡。`));
  }

  async function startRepairExplanation(taskId: string): Promise<ActionResult> {
    const task = state.repairTasks.find((item) => item.id === taskId);
    if (!task) return setAction(result(false, "找不到修复任务。"));
    const card = state.cards.find((item) => item.id === task.cardId);
    if (card) {
      setConcept(card.tags[0] ?? "高信心错误");
      setExplainQuote(card.sourceQuote);
      setExplanation(`我需要重新解释这个高信心错误相关概念：${card.question}\n\n我的当前解释是：`);
      setTemplateId(state.sources.find((source) => source.id === task.sourceId)?.templateId ?? templateId);
    }
    setActiveRepairTaskId(task.id);
    const timestamp = new Date().toISOString();
    await getMetaLearnDb().repairTasks.put({ ...task, status: "in_progress", updatedAt: timestamp });
    await saveLearningEvent({ id: createId("event"), sourceId: task.sourceId, appId: "metalearn-os", actionType: "repair_task_updated", outcome: "saved", createdAt: timestamp });
    await loadData();
    return setAction(result(true, "已带入费曼解释工作台。"));
  }

  async function createRemedialCandidateForTask(taskId: string): Promise<ActionResult> {
    const task = state.repairTasks.find((item) => item.id === taskId);
    if (!task) return setAction(result(false, "找不到修复任务。"));
    const card = state.cards.find((item) => item.id === task.cardId);
    if (!card) return setAction(result(false, "找不到任务关联卡片。"));
    const timestamp = new Date().toISOString();
    const candidate: CardCandidate = {
      id: createId("cand"),
      question: `补救：${card.question}`,
      expectedAnswer: card.expectedAnswer,
      sourceQuote: card.sourceQuote,
      cardType: card.cardType,
      difficulty: Math.min(5, card.difficulty + 1) as 1 | 2 | 3 | 4 | 5,
      tags: [...new Set([...card.tags, "repair"])],
      sourceChunkId: task.sourceChunkId,
      status: "candidate",
      createdAt: timestamp
    };
    const db = getMetaLearnDb();
    await db.transaction("rw", db.cardCandidates, db.repairTasks, async () => {
      await db.cardCandidates.put(candidate);
      await db.repairTasks.put({
        ...task,
        status: "in_progress",
        linkedRemedialCandidateIds: [...new Set([...task.linkedRemedialCandidateIds, candidate.id])],
        updatedAt: timestamp
      });
    });
    await saveLearningEvent({ id: createId("event"), sourceId: task.sourceId, appId: "metalearn-os", actionType: "repair_task_updated", outcome: "saved", createdAt: timestamp });
    await loadData();
    return setAction(result(true, "已生成补救候选题，批准后才会进入复习队列。"));
  }

  async function updateRepairTask(taskId: string, status: "resolved" | "dismissed", resolution: RepairTaskResolution): Promise<ActionResult> {
    const task = state.repairTasks.find((item) => item.id === taskId);
    if (!task) return setAction(result(false, "找不到修复任务。"));
    if (!resolution) return setAction(result(false, "关闭修复任务必须选择处理方式。"));
    const timestamp = new Date().toISOString();
    await getMetaLearnDb().repairTasks.put({
      ...task,
      status,
      resolution,
      resolvedAt: timestamp,
      updatedAt: timestamp
    });
    await saveLearningEvent({ id: createId("event"), sourceId: task.sourceId, appId: "metalearn-os", actionType: "repair_task_resolved", outcome: "saved", createdAt: timestamp });
    await loadData();
    return setAction(result(true, status === "resolved" ? "修复任务已标记为已完成。" : "修复任务已忽略。"));
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

  async function saveStudyView(view: StudyView): Promise<ActionResult> {
    const timestamp = new Date().toISOString();
    const id = `saved_${view.id}`;
    const existing = state.savedStudyViews.find((item) => item.id === id);
    const savedView: SavedStudyView = {
      id,
      title: view.title,
      detail: view.detail,
      href: view.href,
      scopeKind: view.scopeKind,
      scopeValue: view.scopeValue,
      metric: view.metric,
      priority: view.priority,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      lastOpenedAt: existing?.lastOpenedAt
    };
    await getMetaLearnDb().savedStudyViews.put(savedView);
    await saveLearningEvent({ id: createId("event"), appId: "metalearn-os", actionType: "study_view_saved", outcome: "saved", createdAt: timestamp });
    await loadData();
    return setAction(result(true, "已固定到首页学习视图。"));
  }

  async function removeSavedStudyView(id: string): Promise<ActionResult> {
    const existing = state.savedStudyViews.find((item) => item.id === id);
    if (!existing) return setAction(result(false, "找不到这个固定学习视图。"));
    await getMetaLearnDb().savedStudyViews.delete(id);
    await saveLearningEvent({ id: createId("event"), appId: "metalearn-os", actionType: "study_view_removed", outcome: "saved", createdAt: new Date().toISOString() });
    await loadData();
    return setAction(result(true, "已取消固定学习视图。"));
  }

  async function updateSavedStudyView(id: string, patch: { title: string; detail: string; priority: SavedStudyView["priority"] }): Promise<ActionResult> {
    const existing = state.savedStudyViews.find((item) => item.id === id);
    if (!existing) return setAction(result(false, "找不到这个固定学习视图。"));
    const titleValue = patch.title.trim();
    const detailValue = patch.detail.trim();
    if (titleValue.length < 2) return setAction(result(false, "视图标题至少需要 2 个字符。"));
    if (detailValue.length < 6) return setAction(result(false, "视图说明至少需要 6 个字符，避免固定入口失去语境。"));
    if (!["high", "medium", "low"].includes(patch.priority)) return setAction(result(false, "优先级只能是 high、medium 或 low。"));
    const timestamp = new Date().toISOString();
    await getMetaLearnDb().savedStudyViews.put({
      ...existing,
      title: titleValue,
      detail: detailValue,
      priority: patch.priority,
      updatedAt: timestamp
    });
    await saveLearningEvent({ id: createId("event"), appId: "metalearn-os", actionType: "study_view_updated", outcome: "saved", createdAt: timestamp });
    await loadData();
    return setAction(result(true, "固定学习视图已更新。"));
  }

  async function openSavedStudyView(id: string): Promise<ActionResult> {
    const existing = state.savedStudyViews.find((item) => item.id === id);
    if (!existing) return setAction(result(false, "找不到这个固定学习视图。"));
    const timestamp = new Date().toISOString();
    await getMetaLearnDb().savedStudyViews.put({
      ...existing,
      lastOpenedAt: timestamp
    });
    await saveLearningEvent({ id: createId("event"), appId: "metalearn-os", actionType: "study_view_opened", outcome: "completed", createdAt: timestamp });
    window.location.href = existing.href;
    return result(true, "正在打开固定学习视图。");
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
    setLastReviewUndo(null);
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
        savedStudyViewCount: importPlan.inserts.savedStudyViews.length,
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
      aiRequestPreviews: state.aiRequestPreviews,
      repairTasks: state.repairTasks,
      savedStudyViews: state.savedStudyViews
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
    const reviewIds = new Set(reviews.map((log) => log.id));
    const explanations = state.explanations.filter((attempt) => chunks.some((chunk) => attempt.sourceQuote && chunk.text.includes(attempt.sourceQuote)));
    const candidates = state.candidates.filter((candidate) => chunkIds.has(candidate.sourceChunkId));
    const repairTasks = state.repairTasks.filter((task) => task.sourceId === sourceId || reviewIds.has(task.reviewLogId));
    const payload = {
      materials: [source],
      chunks,
      candidates,
      cards,
      reviews,
      explanations,
      repairTasks
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
    isReadingMaterialFile,
    materialImportDraft,
    materialTextQuality,
    candidateDiagnostic,
    getCandidateDiagnostic,
    prepareMaterialFileImport,
    searchQuery,
    setSearchQuery,
    reviewScope,
    setReviewScope,
    clearReviewScope,
    scopedReviewQueue,
    scopedReviewCardCount: scopedCards.length,
    confidence,
    chooseConfidence,
    effort,
    setEffort,
    reviewMachine: effectiveReviewMachine,
    activeReviewCard,
    answerText: effectiveReviewMachine.answerText,
    setAnswerText: setReviewAnswer,
    sourceVisibleBeforeAnswer: effectiveReviewMachine.sourceVisibleBeforeAnswer,
    markSourceSeenBeforeAnswer,
    canUndoLastReview: Boolean(lastReviewUndo),
    undoLastReview,
    mistakeReason,
    setMistakeReason,
    reviewStage: effectiveReviewMachine.stage,
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
    activeRepairTaskId,
    setActiveRepairTaskId,
    importSource,
    importSourceAndPrepareCandidates,
    prepareCandidateGeneration,
    prepareRecentCandidateGeneration,
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
    startRepairExplanation,
    createRemedialCandidateForTask,
    updateRepairTask,
    askSocraticQuestions,
    saveExplanation,
    handoffExplanation,
    addConceptEdge,
    saveSession,
    recordCheckIn,
    saveInsight,
    saveStudyView,
    updateSavedStudyView,
    openSavedStudyView,
    removeSavedStudyView,
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

function compareSavedStudyViews(left: SavedStudyView, right: SavedStudyView): number {
  const leftPriority = studyViewPriorityRank(left.priority);
  const rightPriority = studyViewPriorityRank(right.priority);
  if (leftPriority !== rightPriority) return rightPriority - leftPriority;
  const leftTime = Date.parse(left.lastOpenedAt ?? left.updatedAt);
  const rightTime = Date.parse(right.lastOpenedAt ?? right.updatedAt);
  return rightTime - leftTime;
}

function studyViewPriorityRank(priority: SavedStudyView["priority"]): number {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
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
    aiRequestPreviews: state.aiRequestPreviews,
    repairTasks: state.repairTasks,
    savedStudyViews: state.savedStudyViews
  };
}

function cardMatchesReviewScope(card: Card, scope: ReviewScope, chunks: SourceChunk[]): boolean {
  if (scope.tag && !card.tags.includes(scope.tag)) return false;
  if (scope.sourceId) {
    const chunk = chunks.find((item) => item.id === card.sourceChunkId);
    if (chunk?.sourceId !== scope.sourceId) return false;
  }
  return true;
}
