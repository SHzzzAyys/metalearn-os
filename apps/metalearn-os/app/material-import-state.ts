import type {
  AIRequestPreview,
  AIRequestPreviewStatus,
  CardCandidate,
  MaterialStatus,
  SourceChunk,
  SourceDocument,
  SourceInputType
} from "@metalearn/core";

export type MaterialImportStage =
  | "idle"
  | "file_reading"
  | "text_ready"
  | "saving_source"
  | "source_saved"
  | "preview_ready"
  | "generating_candidates"
  | "candidates_ready"
  | "failed";

export type MaterialFileKind = "pdf" | "txt" | "markdown" | "pasted";

export interface MaterialImportDraft {
  stage: MaterialImportStage;
  fileName?: string;
  fileKind?: MaterialFileKind;
  title: string;
  inputType: SourceInputType;
  textLength: number;
  pageCount?: number;
  sourceId?: string;
  chunkCount?: number;
  previewId?: string;
  generatedCandidateCount?: number;
  candidateIds: string[];
  error?: string;
  updatedAt: string;
}

export interface MaterialTextQuality {
  charCount: number;
  pageCount?: number;
  chunkEstimate: number;
  nonWhitespaceRatio: number;
  lineCount: number;
  warnings: string[];
  blockingError?: string;
}

export interface CandidateGenerationDiagnostic {
  sourceId?: string;
  sourceTitle?: string;
  sourceStatus?: MaterialStatus;
  chunkCount: number;
  pendingCandidateCount: number;
  lastPreviewStatus?: AIRequestPreviewStatus;
  lastPreviewId?: string;
  lastGeneratedAt?: string;
  canGenerate: boolean;
  blockingReason?: string;
  nextAction: "read_file" | "save_source" | "create_preview" | "confirm_preview" | "review_candidates" | "manual_card";
}

export function createMaterialImportDraft(input: {
  stage?: MaterialImportStage;
  title: string;
  inputType: SourceInputType;
  textLength?: number;
  updatedAt?: string;
}): MaterialImportDraft {
  return {
    stage: input.stage ?? "idle",
    title: input.title,
    inputType: input.inputType,
    textLength: input.textLength ?? 0,
    candidateIds: [],
    updatedAt: input.updatedAt ?? new Date().toISOString()
  };
}

export function analyzeMaterialTextQuality(text: string, pageCount?: number): MaterialTextQuality {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  const charCount = normalized.length;
  const nonWhitespace = normalized.replace(/\s/g, "").length;
  const nonWhitespaceRatio = charCount === 0 ? 0 : nonWhitespace / charCount;
  const lineCount = normalized.length === 0 ? 0 : normalized.split("\n").length;
  const chunkEstimate = charCount < 40 ? 0 : Math.max(1, Math.ceil(charCount / 800));
  const warnings: string[] = [];
  const replacementCount = (normalized.match(/�/g) ?? []).length;
  const controlCount = (normalized.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g) ?? []).length;

  if (pageCount && pageCount >= 2 && charCount < 120) {
    warnings.push("这个 PDF 页数不少但可读取文本很少，可能是扫描件或没有完整文本层。当前版本不做 OCR。");
  }
  if (charCount > 0 && nonWhitespaceRatio < 0.55) {
    warnings.push("文本中空白比例较高，可能包含排版噪声。生成前建议快速检查。");
  }
  if (replacementCount > 5 || replacementCount / Math.max(1, charCount) > 0.02 || controlCount > 0) {
    warnings.push("文本可能包含乱码或异常控制字符，建议换可复制文本层 PDF 或手动粘贴。");
  }

  return {
    charCount,
    pageCount,
    chunkEstimate,
    nonWhitespaceRatio,
    lineCount,
    warnings,
    blockingError: charCount < 40 ? "材料至少需要 40 个字符，才能生成稳定候选题。" : undefined
  };
}

export function deriveCandidateGenerationDiagnostic(input: {
  currentText: string;
  draft: MaterialImportDraft;
  sources: SourceDocument[];
  chunks: SourceChunk[];
  previews: AIRequestPreview[];
  candidates: CardCandidate[];
  quality: MaterialTextQuality;
  sourceId?: string;
}): CandidateGenerationDiagnostic {
  const hasExplicitSource = Boolean(input.sourceId || input.draft.sourceId);
  const hasUnsavedDraft =
    !hasExplicitSource &&
    input.currentText.trim().length > 0 &&
    ["file_reading", "text_ready", "failed"].includes(input.draft.stage);
  const sourceId = input.sourceId ?? input.draft.sourceId ?? (hasUnsavedDraft ? undefined : input.sources[0]?.id);
  const source = input.sources.find((item) => item.id === sourceId);
  const sourceChunks = source ? input.chunks.filter((chunk) => chunk.sourceId === source.id) : [];
  const chunkIds = new Set(sourceChunks.map((chunk) => chunk.id));
  const pendingCandidateCount = input.candidates.filter((candidate) => candidate.status === "candidate" && chunkIds.has(candidate.sourceChunkId)).length;
  const latestPreview = latestPreviewForSource(input.previews, source?.id ?? input.draft.sourceId);

  const base = {
    sourceId: source?.id ?? input.draft.sourceId,
    sourceTitle: source?.title ?? input.draft.title,
    sourceStatus: source?.status,
    chunkCount: sourceChunks.length || input.draft.chunkCount || 0,
    pendingCandidateCount,
    lastPreviewStatus: latestPreview?.status,
    lastPreviewId: latestPreview?.id,
    lastGeneratedAt: latestPreview?.completedAt
  };

  if (input.draft.stage === "failed") {
    return {
      ...base,
      canGenerate: false,
      blockingReason: input.draft.error ?? "当前导入或生成流程失败。",
      nextAction: source ? "manual_card" : "read_file"
    };
  }
  if ((input.draft.stage === "text_ready" || input.draft.stage === "file_reading") && !input.draft.sourceId) {
    return {
      ...base,
      canGenerate: false,
      blockingReason: "文件已读取到编辑框，但还没有保存为材料。",
      nextAction: "save_source"
    };
  }
  if (pendingCandidateCount > 0 || input.draft.stage === "candidates_ready") {
    return { ...base, canGenerate: false, nextAction: "review_candidates" };
  }
  if (latestPreview?.status === "pending_confirmation" || input.draft.stage === "preview_ready") {
    return {
      ...base,
      canGenerate: false,
      blockingReason: "已生成上传预览，请确认后生成候选题。",
      nextAction: "confirm_preview"
    };
  }
  if (latestPreview?.status === "failed") {
    return {
      ...base,
      canGenerate: false,
      blockingReason: latestPreview.error ?? "候选题生成失败，但材料已保存，可手工建卡。",
      nextAction: source ? "manual_card" : "read_file"
    };
  }
  if (input.currentText.trim().length === 0 && !source) {
    return { ...base, canGenerate: false, blockingReason: "请先选择文件或粘贴文本。", nextAction: "read_file" };
  }
  if (input.quality.blockingError && !source) {
    return { ...base, canGenerate: false, blockingReason: input.quality.blockingError, nextAction: "read_file" };
  }
  if (source && sourceChunks.length === 0) {
    return {
      ...base,
      canGenerate: false,
      blockingReason: "材料已保存，但没有可用来源片段。",
      nextAction: "manual_card"
    };
  }
  if (source && sourceChunks.length > 0) {
    return { ...base, canGenerate: true, nextAction: "create_preview" };
  }
  return {
    ...base,
    canGenerate: false,
    blockingReason: "文件已读取到编辑框，但还没有保存为材料。",
    nextAction: "save_source"
  };
}

function latestPreviewForSource(previews: AIRequestPreview[], sourceId?: string) {
  return previews
    .filter((preview) => !sourceId || preview.sourceId === sourceId)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0];
}
