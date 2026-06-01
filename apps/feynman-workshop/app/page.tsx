"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Download, HelpCircle, Save, Send, ShieldCheck, Split, Trash2 } from "lucide-react";
import { buildCardsFromExplanation } from "@metalearn/ai";
import type { CardCandidate, ExplanationAttempt, LearningTemplateId } from "@metalearn/core";
import { learningTemplates } from "@metalearn/core";
import {
  candidatesToAnkiTsv,
  clearAllLocalData,
  createId,
  downloadTextFile,
  getMetaLearnDb,
  saveLearningEvent,
  serializeExportPackage
} from "@metalearn/storage";
import { AppFrame, Badge, Button, Field, Metric, Panel, SecondaryButton, TextArea, TextInput } from "@metalearn/ui";

interface SocraticResult {
  questions: string[];
  rubricScores: ExplanationAttempt["rubricScores"];
}

const sampleExplanation =
  "间隔效应指学习不要集中在一次完成，而要分散到多个时间点。因为每次重新提取都会强化记忆，尤其是在快忘但还能想起来的时候。比如今天学一个概念，明天和三天后再主动回忆，比今晚连续读三遍更稳。它不适用于完全没理解的内容，因为那时只是重复错误。";

export default function FeynmanWorkshopPage() {
  const [templateId, setTemplateId] = useState<LearningTemplateId>("technical");
  const [concept, setConcept] = useState("间隔效应");
  const [explanation, setExplanation] = useState(sampleExplanation);
  const [sourceQuote, setSourceQuote] = useState("");
  const [result, setResult] = useState<SocraticResult | null>(null);
  const [attempts, setAttempts] = useState<ExplanationAttempt[]>([]);
  const [handoffCandidates, setHandoffCandidates] = useState<CardCandidate[]>([]);
  const [isAsking, setIsAsking] = useState(false);

  const loadData = useCallback(async () => {
    const db = getMetaLearnDb();
    const [nextAttempts, nextCandidates] = await Promise.all([
      db.explanationAttempts.orderBy("createdAt").reverse().toArray(),
      db.cardCandidates.toArray()
    ]);
    setAttempts(nextAttempts);
    setHandoffCandidates(nextCandidates.filter((candidate) => candidate.tags.includes("feynman")));
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadData]);

  const averageScore = useMemo(() => {
    if (!attempts.length) return 0;
    const total = attempts.reduce((sum, attempt) => sum + scoreAverage(attempt.rubricScores), 0);
    return Math.round((total / attempts.length) * 10) / 10;
  }, [attempts]);

  async function askQuestions() {
    if (concept.trim().length < 2 || explanation.trim().length < 40) return;
    setIsAsking(true);
    try {
      const response = await fetch("/api/ai/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept, explanation, templateId })
      });
      const data = (await response.json()) as { result?: SocraticResult; error?: string };
      if (!response.ok || !data.result) throw new Error(data.error ?? "追问失败");
      setResult(data.result);
    } finally {
      setIsAsking(false);
    }
  }

  async function saveAttempt() {
    if (!result) return;
    const now = new Date().toISOString();
    const attempt: ExplanationAttempt = {
      id: createId("explanation"),
      concept,
      templateId,
      explanation,
      rubricScores: result.rubricScores,
      questions: result.questions,
      sourceQuote: sourceQuote || undefined,
      createdAt: now
    };
    await getMetaLearnDb().explanationAttempts.put(attempt);
    await saveLearningEvent({
      id: createId("event"),
      appId: "feynman-workshop",
      actionType: "explanation_attempted",
      outcome: "saved",
      durationMs: 180_000,
      createdAt: now
    });
    await loadData();
  }

  async function createHandoffCards() {
    const latest = attempts[0];
    const attempt =
      latest ??
      ({
        id: createId("explanation"),
        concept,
        templateId,
        explanation,
        rubricScores: result?.rubricScores ?? { clarity: 3, mechanism: 3, example: 3, boundary: 2, contrast: 2 },
        questions: result?.questions ?? [],
        sourceQuote: sourceQuote || undefined,
        createdAt: new Date().toISOString()
      } satisfies ExplanationAttempt);
    const candidates = buildCardsFromExplanation(attempt);
    await getMetaLearnDb().cardCandidates.bulkPut(candidates);
    await saveLearningEvent({
      id: createId("event"),
      appId: "feynman-workshop",
      actionType: "handoff_exported",
      outcome: "exported",
      createdAt: new Date().toISOString()
    });
    await loadData();
  }

  function exportJson() {
    downloadTextFile("metalearn-feynman-export.json", serializeExportPackage({ attempts, handoffCandidates }), "application/json");
  }

  function exportMarkdown() {
    downloadTextFile("metalearn-feynman-explanations.md", attemptsToMarkdown(attempts), "text/markdown;charset=utf-8");
  }

  function exportAnki() {
    downloadTextFile("metalearn-feynman-anki.tsv", candidatesToAnkiTsv(handoffCandidates), "text/tab-separated-values;charset=utf-8");
  }

  async function resetLocalData() {
    await clearAllLocalData();
    await loadData();
  }

  return (
    <AppFrame
      appName="费曼坊"
      subtitle="你负责解释，AI 只负责追问和指出不清楚的地方；它不替你给标准答案。"
      actions={
        <>
          <SecondaryButton onClick={exportJson}>
            <Archive size={16} /> JSON
          </SecondaryButton>
          <SecondaryButton onClick={exportMarkdown}>
            <Download size={16} /> Markdown
          </SecondaryButton>
          <SecondaryButton onClick={exportAnki}>
            <Download size={16} /> Anki
          </SecondaryButton>
        </>
      }
    >
      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="解释版本" value={String(attempts.length)} detail="本地保存" />
        <Metric label="平均 Rubric" value={averageScore.toFixed(1)} detail="满分 5" />
        <Metric label="交接卡片" value={String(handoffCandidates.length)} detail="候选题，需审核" />
        <Metric label="AI 角色" value="只问不答" detail="防止代劳" />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <Panel>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">1. 用自己的话解释</h2>
              <p className="mt-1 text-sm text-zinc-600">先生成自己的解释，再接受追问。不要把原文摘要当作理解。</p>
            </div>
            <Badge>
              <ShieldCheck size={14} /> no answer mode
            </Badge>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_220px]">
            <Field label="概念">
              <TextInput value={concept} onChange={(event) => setConcept(event.target.value)} />
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
            <Field label="你的解释">
              <TextArea value={explanation} onChange={(event) => setExplanation(event.target.value)} className="min-h-56" />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="可选来源片段" hint="用于之后交接到校准记忆；没有来源时仍可保存解释，但候选题会标记为来自解释版本。">
              <TextArea value={sourceQuote} onChange={(event) => setSourceQuote(event.target.value)} />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={askQuestions} disabled={isAsking}>
              <HelpCircle size={16} /> {isAsking ? "追问中" : "生成 3 个追问"}
            </Button>
            <SecondaryButton onClick={saveAttempt} disabled={!result}>
              <Save size={16} /> 保存解释版本
            </SecondaryButton>
            <SecondaryButton onClick={createHandoffCards}>
              <Send size={16} /> 生成交接卡片
            </SecondaryButton>
            <SecondaryButton onClick={resetLocalData}>
              <Trash2 size={16} /> 清空本地数据
            </SecondaryButton>
          </div>
        </Panel>

        <Panel>
          <h2 className="text-lg font-semibold">2. 追问与 Rubric</h2>
          {!result ? (
            <p className="mt-4 text-sm leading-6 text-zinc-500">点击生成后，系统只给问题和评分，不给标准答案。</p>
          ) : (
            <div className="mt-4 grid gap-4">
              <div className="grid gap-2">
                {result.questions.map((question, index) => (
                  <div key={question} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm leading-6 text-zinc-700">
                    <span className="font-mono text-xs text-emerald-700">Q{index + 1}</span> {question}
                  </div>
                ))}
              </div>
              <div className="grid gap-3">
                {Object.entries(result.rubricScores).map(([key, value]) => (
                  <div key={key}>
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>{rubricLabel(key)}</span>
                      <span>{value}/5</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-zinc-200">
                      <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${value * 20}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                评分只衡量解释结构，不裁判事实真伪。事实判断必须回到来源材料或外部权威资料。
              </div>
            </div>
          )}
        </Panel>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <Panel>
          <h2 className="text-lg font-semibold">解释版本</h2>
          <div className="mt-4 grid gap-3">
            {attempts.length === 0 ? <p className="text-sm text-zinc-500">还没有保存版本。</p> : null}
            {attempts.slice(0, 6).map((attempt) => (
              <article key={attempt.id} className="rounded-lg border border-zinc-200 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{attempt.templateId}</Badge>
                  <span className="text-xs text-zinc-500">{new Date(attempt.createdAt).toLocaleString()}</span>
                </div>
                <h3 className="mt-2 font-semibold">{attempt.concept}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-600">{attempt.explanation}</p>
              </article>
            ))}
          </div>
        </Panel>

        <Panel>
          <h2 className="text-lg font-semibold">交接给校准记忆</h2>
          <p className="mt-1 text-sm text-zinc-600">这里生成的仍是候选题，需要在《校准记忆》人工批准后进入复习队列。</p>
          <div className="mt-4 grid gap-3">
            {handoffCandidates.length === 0 ? (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
                <Split size={18} className="mb-2 text-emerald-700" />
                暂无交接卡片。
              </div>
            ) : null}
            {handoffCandidates.slice(0, 6).map((candidate) => (
              <article key={candidate.id} className="rounded-lg border border-zinc-200 p-3">
                <Badge>{candidate.cardType}</Badge>
                <h3 className="mt-2 text-sm font-semibold">{candidate.question}</h3>
                <p className="mt-2 text-xs leading-5 text-zinc-600">{candidate.sourceQuote}</p>
              </article>
            ))}
          </div>
        </Panel>
      </section>
    </AppFrame>
  );
}

function scoreAverage(scores: ExplanationAttempt["rubricScores"]): number {
  const values = Object.values(scores);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rubricLabel(key: string): string {
  const labels: Record<string, string> = {
    clarity: "清晰度",
    mechanism: "机制",
    example: "例子",
    boundary: "边界",
    contrast: "区分"
  };
  return labels[key] ?? key;
}

function attemptsToMarkdown(attempts: ExplanationAttempt[]): string {
  return attempts
    .map(
      (attempt) => `## ${attempt.concept}

- 时间：${attempt.createdAt}
- 模板：${attempt.templateId}
- Rubric：${JSON.stringify(attempt.rubricScores)}

### 解释

${attempt.explanation}

### 追问

${attempt.questions.map((question, index) => `${index + 1}. ${question}`).join("\n")}
`
    )
    .join("\n");
}
