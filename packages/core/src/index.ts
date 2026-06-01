export type AppId = "metalearn-os" | "calibrate-memory" | "learning-compass" | "feynman-workshop";
export type ProductArea = "home" | "library" | "review" | "explain" | "compass" | "insights" | "settings";

export type LearningTemplateId = "course" | "paper" | "exam" | "technical";

export type CardType =
  | "definition"
  | "mechanism"
  | "comparison"
  | "application"
  | "counterexample"
  | "experiment"
  | "cloze";

export type ReviewOutcome = "again" | "partial" | "correct" | "easy";

export type CandidateStatus = "candidate" | "approved" | "rejected";
export type MaterialStatus = "new" | "chunked" | "candidates" | "reviewing" | "explaining" | "active" | "archived";
export type StudyAssetKind = "material" | "candidate" | "card" | "review" | "explanation" | "session" | "insight";
export type MistakeReason = "unknown" | "not_retrieved" | "confused_concepts" | "weak_mechanism" | "missed_boundary" | "bad_card" | "source_gap";
export type AIProviderMode = "local_mock" | "server_env" | "custom_endpoint";
export type SourceInputType = "plain_text" | "markdown" | "pdf_text";
export type AIRequestKind = "generate_cards" | "socratic_questions" | "weekly_report";
export type AIRequestPreviewStatus = "pending_confirmation" | "confirmed" | "completed" | "cancelled" | "failed";
export type ReviewEvidenceStrength = "strong" | "medium" | "weak";
export type CheckInFocusState = "focused" | "wandering" | "stuck" | "passive";
export type ConceptRelationType = "related" | "contrast" | "causal" | "exception";

export interface ActionResult {
  ok: boolean;
  message: string;
  requiresConfirmation?: boolean;
  eventId?: string;
}

export interface LearningTemplate {
  id: LearningTemplateId;
  label: string;
  description: string;
  recommendedCardTypes: CardType[];
  defaultStrategy: string;
}

export interface SourceDocument {
  id: string;
  title: string;
  templateId: LearningTemplateId;
  inputType?: SourceInputType;
  rawText: string;
  status?: MaterialStatus;
  summary?: string;
  lastWorkedAt?: string;
  candidateCount?: number;
  approvedCardCount?: number;
  explanationCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SourceChunk {
  id: string;
  sourceId: string;
  index: number;
  text: string;
}

export interface FSRSState {
  stability: number;
  difficulty: number;
  retrievability: number;
  scheduledDays: number;
  lapses: number;
  reps: number;
}

export interface CardCandidate {
  id: string;
  question: string;
  expectedAnswer: string;
  sourceQuote: string;
  cardType: CardType;
  difficulty: 1 | 2 | 3 | 4 | 5;
  tags: string[];
  sourceChunkId: string;
  status: CandidateStatus;
  createdAt: string;
}

export interface Card extends CardCandidate {
  status: "approved";
  dueAt: string;
  lastReviewedAt?: string;
  fsrs: FSRSState;
}

export interface ConfidenceJudgment {
  value: 1 | 2 | 3 | 4 | 5;
  probability: number;
  label: string;
}

export interface ReviewLog {
  id: string;
  cardId: string;
  sourceId: string;
  confidence: 1 | 2 | 3 | 4 | 5;
  confidenceProbability: number;
  answerText: string;
  outcome: ReviewOutcome;
  isCorrect: boolean;
  mistakeReason?: MistakeReason;
  selfRatedEffort?: 1 | 2 | 3 | 4 | 5;
  sourceVisibleBeforeAnswer?: boolean;
  evidenceStrength?: ReviewEvidenceStrength;
  durationMs: number;
  createdAt: string;
}

export interface LearningSession {
  id: string;
  title: string;
  templateId: LearningTemplateId;
  goal: string;
  strategy: string;
  predictedMinutes: number;
  actualMinutes?: number;
  checkInIntervalMinutes?: 0 | 10 | 20 | 30;
  completionRating?: 1 | 2 | 3 | 4 | 5;
  startedAt: string;
  endedAt?: string;
}

export interface Reflection {
  id: string;
  sessionId: string;
  worked: string;
  stuck: string;
  nextChange: string;
  createdAt: string;
}

export interface ExplanationAttempt {
  id: string;
  concept: string;
  templateId: LearningTemplateId;
  explanation: string;
  versionIndex?: number;
  parentAttemptId?: string;
  linkedCardIds?: string[];
  gapTags?: string[];
  priorRubricScores?: {
    clarity: number;
    mechanism: number;
    example: number;
    boundary: number;
    contrast: number;
  };
  rubricScores: {
    clarity: number;
    mechanism: number;
    example: number;
    boundary: number;
    contrast: number;
  };
  questions: string[];
  sourceQuote?: string;
  createdAt: string;
}

export interface CalibrationMetric {
  brierScore: number;
  overconfidenceIndex: number;
  highConfidenceErrorRate: number;
  reviewCount: number;
}

export interface Recommendation {
  id: string;
  title: string;
  rationale: string;
  actionLabel: string;
  appId: AppId;
  createdAt: string;
}

export interface StudyAsset {
  id: string;
  kind: StudyAssetKind;
  title: string;
  detail: string;
  templateId?: LearningTemplateId;
  sourceId?: string;
  href: string;
  statusLabel: string;
  updatedAt: string;
}

export interface ImportJob {
  id: string;
  sourceId?: string;
  inputType: SourceInputType;
  status: "queued" | "chunked" | "failed";
  error?: string;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AIRequestPreview {
  id: string;
  kind: AIRequestKind;
  providerMode: AIProviderMode;
  providerName: string;
  modelName: string;
  sourceId?: string;
  chunkIds: string[];
  chunkCount: number;
  payloadSummary: string;
  status: AIRequestPreviewStatus;
  createdAt: string;
  confirmedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface CheckIn {
  id: string;
  sessionId: string;
  focusState: CheckInFocusState;
  understanding: 1 | 2 | 3 | 4 | 5;
  note?: string;
  createdAt: string;
}

export interface ConceptNode {
  id: string;
  label: string;
  source: "material" | "card" | "explanation" | "tag";
  sourceId?: string;
  strength: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConceptEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  relation: ConceptRelationType;
  evidence: string;
  confirmed: boolean;
  createdAt: string;
}

export interface ExportManifest {
  schemaVersion: 3;
  exportedAt: string;
  counts: {
    materials: number;
    chunks: number;
    candidates: number;
    cards: number;
    reviews: number;
    explanations: number;
    sessions: number;
    checkIns: number;
    insights: number;
    aiRequestPreviews: number;
  };
  includesAIRequestRecords: boolean;
}

export type ImportPackageKind = "full_backup" | "material_package" | "unknown";
export type ImportConflictStrategy = "keep_both" | "skip_duplicates";

export interface ImportProblem {
  code: string;
  severity: "warning" | "repairable" | "fatal";
  table: string;
  id?: string;
  message: string;
}

export interface ImportPreview {
  kind: ImportPackageKind;
  schemaVersion?: number;
  exportedAt?: string;
  counts: ExportManifest["counts"];
  canImport: boolean;
  conflicts: ImportProblem[];
  repaired: ImportProblem[];
  warnings: ImportProblem[];
  fatalProblems: ImportProblem[];
}

export interface ImportPackagePayload {
  materials: SourceDocument[];
  chunks: SourceChunk[];
  importJobs: ImportJob[];
  candidates: CardCandidate[];
  cards: Card[];
  reviews: ReviewLog[];
  explanations: ExplanationAttempt[];
  conceptNodes: ConceptNode[];
  conceptEdges: ConceptEdge[];
  sessions: LearningSession[];
  checkIns: CheckIn[];
  reflections: Reflection[];
  insights: InsightSnapshot[];
  aiProviderConfigs: AIProviderConfig[];
  aiRequestPreviews: AIRequestPreview[];
}

export interface ImportPlan {
  strategy: ImportConflictStrategy;
  preview: ImportPreview;
  idMap: Record<string, string>;
  inserts: ImportPackagePayload;
  skipped: ImportProblem[];
  repaired: ImportProblem[];
}

export interface ReviewQueueItem {
  card: Card;
  source?: SourceDocument;
  chunk?: SourceChunk;
  urgency: "overdue" | "due" | "soon" | "later";
  reason: string;
}

export interface ExplanationVersion extends ExplanationAttempt {
  versionIndex: number;
  linkedCardIds: string[];
  gapTags: string[];
}

export interface InsightSnapshot {
  id: string;
  brierScore: number;
  overconfidenceIndex: number;
  highConfidenceErrorRate: number;
  activeLearningRatio: number;
  metacognitiveOverheadRatio: number;
  predictionBias: number;
  passiveLearningRisk: number;
  weakTags: string[];
  explanationGapTags: string[];
  weeklyCalibratedRetrievals: number;
  recommendation: string;
  createdAt: string;
}

export interface DailyPlan {
  id: string;
  title: string;
  dueReviewCount: number;
  highConfidenceErrorCount: number;
  pendingCandidateCount: number;
  unfinishedExplanationCount: number;
  metacognitiveOverheadWarning?: string;
  suggestedArea: ProductArea;
  nextBestAction: string;
  generatedAt: string;
}

export interface AIProviderConfig {
  id: string;
  mode: AIProviderMode;
  providerName: string;
  modelName: string;
  endpoint?: string;
  apiKeyStoredLocally?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LearningEvent {
  id: string;
  sourceId?: string;
  appId: AppId;
  actionType:
    | "asset_opened"
    | "insight_created"
    | "settings_updated"
    | "source_imported"
    | "source_archived"
    | "source_restored"
    | "manual_candidate_created"
    | "candidate_generated"
    | "candidate_rejected"
    | "card_approved"
    | "review_completed"
    | "session_started"
    | "checkin_recorded"
    | "session_finished"
    | "reflection_saved"
    | "explanation_attempted"
    | "handoff_exported"
    | "ai_preview_created"
    | "import_preview_created"
    | "concept_edge_added"
    | "data_exported"
    | "data_imported"
    | "data_import_failed"
    | "data_deleted";
  confidence?: 1 | 2 | 3 | 4 | 5;
  outcome?: ReviewOutcome | "completed" | "saved" | "exported";
  durationMs?: number;
  createdAt: string;
}

export const learningTemplates: LearningTemplate[] = [
  {
    id: "course",
    label: "课程学习",
    description: "面向课程章节、课堂笔记和讲义，强调定义、机制和例题迁移。",
    recommendedCardTypes: ["definition", "mechanism", "application", "cloze"],
    defaultStrategy: "先用 3 个核心问题提取，再复盘错题来源。"
  },
  {
    id: "paper",
    label: "论文阅读",
    description: "面向论文、综述和技术报告，强调研究问题、机制、证据和边界。",
    recommendedCardTypes: ["mechanism", "comparison", "experiment", "counterexample"],
    defaultStrategy: "抓住问题、方法、证据、局限四件事，不做纯摘要。"
  },
  {
    id: "exam",
    label: "考试复习",
    description: "面向备考、证书和题库回顾，强调高信心错误和薄弱标签。",
    recommendedCardTypes: ["definition", "application", "comparison", "cloze"],
    defaultStrategy: "优先处理高信心错误，再做间隔复习。"
  },
  {
    id: "technical",
    label: "技术自学",
    description: "面向编程、工具链和工程概念，强调机制、反例和应用条件。",
    recommendedCardTypes: ["mechanism", "application", "counterexample", "comparison"],
    defaultStrategy: "每个概念至少解释一次机制、限制和可运行例子。"
  }
];

export function getTemplate(id: LearningTemplateId): LearningTemplate {
  return learningTemplates.find((template) => template.id === id) ?? learningTemplates[0];
}
