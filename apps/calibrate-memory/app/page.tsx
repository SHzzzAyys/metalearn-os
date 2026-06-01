"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Check, Download, RefreshCw, ShieldCheck, Trash2, Upload } from "lucide-react";
import type { Card, CardCandidate, LearningTemplateId, ReviewLog, ReviewOutcome, SourceChunk, SourceDocument } from "@metalearn/core";
import { learningTemplates } from "@metalearn/core";
import {
  buildCalibrationBuckets,
  buildWeeklyAdvice,
  calculateBrierScore,
  calculateHighConfidenceErrorRate,
  calculateOverconfidenceIndex,
  confidenceToJudgment,
  createInitialFsrsState,
  findHighConfidenceErrors,
  outcomeToCorrectness,
  scheduleReview
} from "@metalearn/learning-science";
import {
  candidatesToAnkiTsv,
  cardsToCsv,
  chunkText,
  clearAllLocalData,
  createId,
  downloadTextFile,
  getMetaLearnDb,
  saveLearningEvent,
  serializeExportPackage
} from "@metalearn/storage";
import { AppFrame, Badge, Button, Field, Metric, Panel, SecondaryButton, TextArea, TextInput } from "@metalearn/ui";

const sampleText =
  "间隔效应说明，分散复习通常比集中复习更有利于长期保持。提取练习要求学习者主动从记忆中取回答案，而不是只重读材料。信心校准关注学习者预测自己会不会答对，并把预测与实际结果比较。高信心错误尤其重要，因为它暴露了熟悉感和真实掌握之间的差距。";

export default function CalibrateMemoryPage() {
  const [title, setTitle] = useState("我的学习材料");
  const [templateId, setTemplateId] = useState<LearningTemplateId>("course");
  const [sourceText, setSourceText] = useState(sampleText);
  const [sources, setSources] = useState<SourceDocument[]>([]);
  const [chunks, setChunks] = useState<SourceChunk[]>([]);
  const [candidates, setCandidates] = useState<CardCandidate[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [logs, setLogs] = useState<ReviewLog[]>([]);
  const [nowMs, setNowMs] = useState(0);
  const [confidence, setConfidence] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [answerText, setAnswerText] = useState("");
  const [lastFeedback, setLastFeedback] = useState<string>("尚未完成本轮复习。");
  const [isGenerating, setIsGenerating] = useState(false);

  const loadData = useCallback(async () => {
    const db = getMetaLearnDb();
    const [nextSources, nextChunks, nextCandidates, nextCards, nextLogs] = await Promise.all([
      db.sourceDocuments.orderBy("createdAt").reverse().toArray(),
      db.sourceChunks.toArray(),
      db.cardCandidates.orderBy("createdAt").reverse().toArray(),
      db.cards.orderBy("dueAt").toArray(),
      db.reviewLogs.orderBy("createdAt").toArray()
    ]);
    setSources(nextSources);
    setChunks(nextChunks);
    setCandidates(nextCandidates);
    setCards(nextCards);
    setLogs(nextLogs);
    setNowMs(Date.now());
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadData]);

  const dueCards = useMemo(() => {
    return cards.filter((card) => new Date(card.dueAt).getTime() <= nowMs);
  }, [cards, nowMs]);

  const activeCard = dueCards[0] ?? cards[0];
  const brier = calculateBrierScore(logs);
  const overconfidence = calculateOverconfidenceIndex(logs);
  const highConfidenceErrorRate = calculateHighConfidenceErrorRate(logs);
  const highConfidenceErrors = findHighConfidenceErrors(cards, logs);
  const buckets = buildCalibrationBuckets(logs);
  const advice = buildWeeklyAdvice(logs);

  async function importSource() {
    if (sourceText.trim().length < 40) return;
    const now = new Date().toISOString();
    const sourceId = createId("source");
    const document: SourceDocument = {
      id: sourceId,
      title,
      templateId,
      rawText: sourceText,
      createdAt: now,
      updatedAt: now
    };
    const nextChunks = chunkText(sourceId, sourceText);
    const db = getMetaLearnDb();
    await db.transaction("rw", db.sourceDocuments, db.sourceChunks, async () => {
      await db.sourceDocuments.put(document);
      await db.sourceChunks.bulkPut(nextChunks);
    });
    await saveLearningEvent({
      id: createId("event"),
      sourceId,
      appId: "calibrate-memory",
      actionType: "source_imported",
      outcome: "saved",
      createdAt: now
    });
    await loadData();
  }

  async function generateCandidates() {
    const activeSource = sources[0];
    const activeChunks = activeSource ? chunks.filter((chunk) => chunk.sourceId === activeSource.id) : chunkText("draft", sourceText);
    if (activeChunks.length === 0) return;
    setIsGenerating(true);
    try {
      const response = await fetch("/api/ai/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chunks: activeChunks.slice(0, 4), templateId, requestedCount: 6 })
      });
      const data = (await response.json()) as { candidates?: CardCandidate[]; error?: string };
      if (!response.ok || !data.candidates) throw new Error(data.error ?? "生成失败");
      const db = getMetaLearnDb();
      await db.cardCandidates.bulkPut(data.candidates);
      await saveLearningEvent({
        id: createId("event"),
        sourceId: activeSource?.id,
        appId: "calibrate-memory",
        actionType: "candidate_generated",
        outcome: "saved",
        createdAt: new Date().toISOString()
      });
      setCandidates((previous) => [...data.candidates!, ...previous]);
    } finally {
      setIsGenerating(false);
    }
  }

  async function approveCandidate(candidate: CardCandidate) {
    if (!candidate.sourceQuote.trim()) return;
    const now = new Date().toISOString();
    const card: Card = {
      ...candidate,
      status: "approved",
      dueAt: now,
      fsrs: createInitialFsrsState()
    };
    const db = getMetaLearnDb();
    await db.transaction("rw", db.cards, db.cardCandidates, async () => {
      await db.cards.put(card);
      await db.cardCandidates.put({ ...candidate, status: "approved" });
    });
    await saveLearningEvent({
      id: createId("event"),
      sourceId: chunks.find((chunk) => chunk.id === candidate.sourceChunkId)?.sourceId,
      appId: "calibrate-memory",
      actionType: "card_approved",
      outcome: "saved",
      createdAt: now
    });
    await loadData();
  }

  async function rejectCandidate(candidate: CardCandidate) {
    await getMetaLearnDb().cardCandidates.put({ ...candidate, status: "rejected" });
    await loadData();
  }

  async function completeReview(outcome: ReviewOutcome) {
    if (!activeCard) return;
    const judgment = confidenceToJudgment(confidence);
    const now = new Date().toISOString();
    const isCorrect = outcomeToCorrectness(outcome);
    const log: ReviewLog = {
      id: createId("review"),
      cardId: activeCard.id,
      sourceId: chunks.find((chunk) => chunk.id === activeCard.sourceChunkId)?.sourceId ?? "unknown",
      confidence,
      confidenceProbability: judgment.probability,
      answerText,
      outcome,
      isCorrect,
      durationMs: 90_000,
      createdAt: now
    };
    const updatedCard = scheduleReview(activeCard, outcome, new Date(now));
    const gap = Math.abs(judgment.probability - (isCorrect ? 1 : 0));
    const db = getMetaLearnDb();
    await db.transaction("rw", db.reviewLogs, db.cards, async () => {
      await db.reviewLogs.put(log);
      await db.cards.put(updatedCard);
    });
    await saveLearningEvent({
      id: createId("event"),
      sourceId: log.sourceId,
      appId: "calibrate-memory",
      actionType: "review_completed",
      confidence,
      outcome,
      durationMs: log.durationMs,
      createdAt: now
    });
    setAnswerText("");
    setLastFeedback(`本轮信心 ${judgment.label}，结果为${isCorrect ? "答对" : "未掌握"}，校准差距 ${Math.round(gap * 100)}%。`);
    await loadData();
  }

  async function resetLocalData() {
    await clearAllLocalData();
    await loadData();
  }

  function exportJson() {
    downloadTextFile("metalearn-calibrate-export.json", serializeExportPackage({ sources, chunks, candidates, cards, logs }), "application/json");
  }

  function exportCsv() {
    downloadTextFile("metalearn-cards.csv", cardsToCsv(cards), "text/csv;charset=utf-8");
  }

  function exportAnki() {
    downloadTextFile("metalearn-anki.tsv", candidatesToAnkiTsv(cards), "text/tab-separated-values;charset=utf-8");
  }

  return (
    <AppFrame
      appName="校准记忆"
      subtitle="把真实材料变成可审核的提取题；复习前先判断信心，再用结果校准“以为会”和“真的会”。"
      actions={
        <>
          <SecondaryButton onClick={exportJson} title="导出 JSON">
            <Archive size={16} /> JSON
          </SecondaryButton>
          <SecondaryButton onClick={exportCsv} title="导出 CSV">
            <Download size={16} /> CSV
          </SecondaryButton>
          <SecondaryButton onClick={exportAnki} title="导出 Anki TSV">
            <Download size={16} /> Anki
          </SecondaryButton>
        </>
      }
    >
      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="卡片总数" value={String(cards.length)} detail={`${dueCards.length} 张到期`} />
        <Metric label="Brier 分数" value={brier.toFixed(3)} detail="越低越校准" />
        <Metric label="过度自信" value={`${Math.round(overconfidence * 100)}%`} detail="平均信心 - 正确率" />
        <Metric label="高信心错误" value={`${Math.round(highConfidenceErrorRate * 100)}%`} detail="4-5 档信心里的错误率" />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">1. 导入真实材料</h2>
              <p className="mt-1 text-sm text-zinc-600">材料只保存在本地。只有点击“生成候选题”后，当前片段才会进入服务端 AI 边界。</p>
            </div>
            <Badge>
              <ShieldCheck size={14} /> local-first
            </Badge>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_220px]">
            <Field label="材料标题">
              <TextInput value={title} onChange={(event) => setTitle(event.target.value)} />
            </Field>
            <Field label="学习模板">
              <select
                className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                value={templateId}
                onChange={(event) => setTemplateId(event.target.value as LearningTemplateId)}
              >
                {learningTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-4">
            <Field label="文本 / Markdown / PDF 提取文本">
              <TextArea value={sourceText} onChange={(event) => setSourceText(event.target.value)} className="min-h-48" />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={importSource}>
              <Upload size={16} /> 保存到本地库
            </Button>
            <SecondaryButton onClick={generateCandidates} disabled={isGenerating}>
              <RefreshCw size={16} /> {isGenerating ? "生成中" : "生成候选题"}
            </SecondaryButton>
            <SecondaryButton onClick={resetLocalData}>
              <Trash2 size={16} /> 清空本地数据
            </SecondaryButton>
          </div>
        </Panel>

        <Panel>
          <h2 className="text-lg font-semibold">2. 候选题审核</h2>
          <p className="mt-1 text-sm text-zinc-600">候选题不会自动进入复习队列；没有来源片段的题不能批准。</p>
          <div className="mt-4 grid max-h-[420px] gap-3 overflow-auto pr-1">
            {candidates.length === 0 ? <p className="text-sm text-zinc-500">还没有候选题。先保存材料，再生成。</p> : null}
            {candidates.slice(0, 8).map((candidate) => (
              <article key={candidate.id} className="rounded-lg border border-zinc-200 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{candidate.cardType}</Badge>
                  <span className="text-xs text-zinc-500">难度 {candidate.difficulty}</span>
                  <span className="text-xs text-zinc-500">{candidate.status}</span>
                </div>
                <h3 className="mt-2 text-sm font-semibold">{candidate.question}</h3>
                <p className="mt-2 border-l-2 border-emerald-500 pl-3 text-xs leading-5 text-zinc-600">{candidate.sourceQuote}</p>
                <div className="mt-3 flex gap-2">
                  <Button onClick={() => approveCandidate(candidate)} disabled={candidate.status !== "candidate"}>
                    <Check size={14} /> 批准
                  </Button>
                  <SecondaryButton onClick={() => rejectCandidate(candidate)} disabled={candidate.status !== "candidate"}>
                    拒绝
                  </SecondaryButton>
                </div>
              </article>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Panel>
          <h2 className="text-lg font-semibold">3. 校准复习</h2>
          {activeCard ? (
            <div className="mt-4 grid gap-4">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-wrap gap-2">
                  <Badge>{activeCard.cardType}</Badge>
                  <span className="text-xs text-zinc-500">下次间隔 {activeCard.fsrs.scheduledDays} 天</span>
                </div>
                <h3 className="mt-3 text-xl font-semibold">{activeCard.question}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-600">{activeCard.sourceQuote}</p>
              </div>
              <Field label="先评信心">
                <div className="grid grid-cols-5 gap-2">
                  {([1, 2, 3, 4, 5] as const).map((value) => (
                    <button
                      key={value}
                      className={`rounded-md border px-3 py-2 text-sm ${
                        confidence === value ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-zinc-300 bg-white text-zinc-700"
                      }`}
                      onClick={() => setConfidence(value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="主动回答">
                <TextArea value={answerText} onChange={(event) => setAnswerText(event.target.value)} placeholder="先回想，再看答案或来源。" />
              </Field>
              <div className="grid gap-2 md:grid-cols-4">
                <SecondaryButton onClick={() => completeReview("again")}>错</SecondaryButton>
                <SecondaryButton onClick={() => completeReview("partial")}>部分对</SecondaryButton>
                <Button onClick={() => completeReview("correct")}>对</Button>
                <Button onClick={() => completeReview("easy")}>轻松</Button>
              </div>
              <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">{lastFeedback}</p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-zinc-500">批准候选题后，这里会出现到期复习卡。</p>
          )}
        </Panel>

        <Panel>
          <h2 className="text-lg font-semibold">校准曲线</h2>
          <div className="mt-4 grid gap-3">
            {buckets.map((bucket) => (
              <div key={bucket.confidence}>
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>信心 {bucket.confidence}</span>
                  <span>
                    期望 {Math.round(bucket.expected * 100)}% / 实际 {Math.round(bucket.actual * 100)}% / {bucket.count} 次
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-zinc-200">
                  <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${Math.max(4, bucket.actual * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm leading-6 text-zinc-700">{advice}</div>
          <div className="mt-5">
            <h3 className="text-sm font-semibold">高信心错误</h3>
            <div className="mt-2 grid gap-2">
              {highConfidenceErrors.length === 0 ? <p className="text-sm text-zinc-500">暂无。继续复习后再看。</p> : null}
              {highConfidenceErrors.map(({ log, card }) => (
                <div key={log.id} className="rounded-md border border-zinc-200 p-2 text-xs text-zinc-600">
                  <strong className="block text-zinc-900">{card?.question}</strong>
                  信心 {log.confidence}，结果 {log.outcome}
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </section>
    </AppFrame>
  );
}
