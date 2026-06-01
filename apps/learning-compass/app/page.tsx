"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Clock, Compass, Download, Pause, Play, Save, Trash2 } from "lucide-react";
import type { Card, LearningSession, LearningTemplateId, Reflection, ReviewLog } from "@metalearn/core";
import { learningTemplates } from "@metalearn/core";
import {
  buildWeeklyAdvice,
  calculateBrierScore,
  calculateMetacognitiveOverhead,
  calculateOverconfidenceIndex,
  calculatePredictionBias,
  findHighConfidenceErrors
} from "@metalearn/learning-science";
import {
  clearAllLocalData,
  createId,
  downloadTextFile,
  getMetaLearnDb,
  saveLearningEvent,
  serializeExportPackage
} from "@metalearn/storage";
import { AppFrame, Badge, Button, Field, Metric, Panel, SecondaryButton, TextArea, TextInput } from "@metalearn/ui";

export default function LearningCompassPage() {
  const [templateId, setTemplateId] = useState<LearningTemplateId>("course");
  const [title, setTitle] = useState("今天的学习会话");
  const [goal, setGoal] = useState("用主动提取确认我是否真的掌握。");
  const [strategy, setStrategy] = useState("先预测，再学习，再用 3 个问题自测。");
  const [predictedMinutes, setPredictedMinutes] = useState(30);
  const [activeSession, setActiveSession] = useState<LearningSession | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [sessions, setSessions] = useState<LearningSession[]>([]);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [reviewLogs, setReviewLogs] = useState<ReviewLog[]>([]);
  const [worked, setWorked] = useState("");
  const [stuck, setStuck] = useState("");
  const [nextChange, setNextChange] = useState("");
  const [completionRating, setCompletionRating] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [isRunning, setIsRunning] = useState(false);

  const loadData = useCallback(async () => {
    const db = getMetaLearnDb();
    const [nextSessions, nextReflections, nextLogs] = await Promise.all([
      db.learningSessions.orderBy("startedAt").reverse().toArray(),
      db.reflections.orderBy("createdAt").reverse().toArray(),
      db.reviewLogs.orderBy("createdAt").toArray()
    ]);
    setSessions(nextSessions);
    setReflections(nextReflections);
    setReviewLogs(nextLogs);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadData]);

  useEffect(() => {
    if (!isRunning || !activeSession) return;
    const interval = window.setInterval(() => {
      setElapsedSeconds((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activeSession, isRunning]);

  const actualMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
  const metaMinutes = activeSession ? 3 : 0;
  const overhead = calculateMetacognitiveOverhead(metaMinutes, actualMinutes);
  const brier = calculateBrierScore(reviewLogs);
  const overconfidence = calculateOverconfidenceIndex(reviewLogs);
  const weeklyAdvice = buildWeeklyAdvice(reviewLogs);
  const cards = useLiveCards();
  const highConfidenceErrors = findHighConfidenceErrors(cards, reviewLogs);

  const sessionStats = useMemo(() => {
    const finished = sessions.filter((session) => session.actualMinutes);
    const bias =
      finished.length === 0
        ? 0
        : finished.reduce((sum, session) => sum + calculatePredictionBias(session.predictedMinutes, session.actualMinutes ?? session.predictedMinutes), 0) /
          finished.length;
    const completion =
      finished.length === 0
        ? 0
        : finished.reduce((sum, session) => sum + (session.completionRating ?? 0), 0) / Math.max(1, finished.length);
    return {
      finished: finished.length,
      bias,
      completion
    };
  }, [sessions]);

  async function startSession() {
    const now = new Date().toISOString();
    const session: LearningSession = {
      id: createId("session"),
      title,
      templateId,
      goal,
      strategy,
      predictedMinutes,
      startedAt: now
    };
    await getMetaLearnDb().learningSessions.put(session);
    await saveLearningEvent({
      id: createId("event"),
      appId: "learning-compass",
      actionType: "session_started",
      outcome: "saved",
      createdAt: now
    });
    setActiveSession(session);
    setElapsedSeconds(0);
    setIsRunning(true);
    await loadData();
  }

  async function finishSession() {
    if (!activeSession) return;
    const now = new Date().toISOString();
    const finished: LearningSession = {
      ...activeSession,
      actualMinutes,
      completionRating,
      endedAt: now
    };
    const reflection: Reflection = {
      id: createId("reflection"),
      sessionId: activeSession.id,
      worked: worked || "本次尚未填写顺利点。",
      stuck: stuck || "本次尚未填写卡壳点。",
      nextChange: nextChange || "下次继续用主动提取验证掌握。",
      createdAt: now
    };
    const db = getMetaLearnDb();
    await db.transaction("rw", db.learningSessions, db.reflections, async () => {
      await db.learningSessions.put(finished);
      await db.reflections.put(reflection);
    });
    await saveLearningEvent({
      id: createId("event"),
      appId: "learning-compass",
      actionType: "session_finished",
      durationMs: actualMinutes * 60_000,
      outcome: "completed",
      createdAt: now
    });
    await saveLearningEvent({
      id: createId("event"),
      appId: "learning-compass",
      actionType: "reflection_saved",
      outcome: "saved",
      createdAt: now
    });
    setActiveSession(null);
    setIsRunning(false);
    setElapsedSeconds(0);
    setWorked("");
    setStuck("");
    setNextChange("");
    await loadData();
  }

  function exportJson() {
    downloadTextFile("metalearn-compass-export.json", serializeExportPackage({ sessions, reflections, reviewLogs }), "application/json");
  }

  async function resetLocalData() {
    await clearAllLocalData();
    await loadData();
  }

  return (
    <AppFrame
      appName="学习罗盘"
      subtitle="用 60 秒计划、轻量计时和 2 分钟反思追踪学习过程，不把管理学习变成学习替身。"
      actions={
        <>
          <SecondaryButton onClick={exportJson}>
            <Archive size={16} /> JSON
          </SecondaryButton>
          <SecondaryButton onClick={() => downloadTextFile("metalearn-compass-reflections.md", reflectionsToMarkdown(reflections, sessions))}>
            <Download size={16} /> Markdown
          </SecondaryButton>
        </>
      }
    >
      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="完成会话" value={String(sessionStats.finished)} detail="本地记录" />
        <Metric label="时间预测偏差" value={`${Math.round(sessionStats.bias * 100)}%`} detail="实际 - 预测 / 预测" />
        <Metric label="Brier 分数" value={brier.toFixed(3)} detail="来自校准记忆" />
        <Metric label="过度自信" value={`${Math.round(overconfidence * 100)}%`} detail="来自复习日志" />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <Panel>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">1. 60 秒计划</h2>
              <p className="mt-1 text-sm text-zinc-600">计划只保留目标、策略和时间预测三件事，防止元认知开销过高。</p>
            </div>
            <Badge>
              <Compass size={14} /> low overhead
            </Badge>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_220px]">
            <Field label="会话标题">
              <TextInput value={title} onChange={(event) => setTitle(event.target.value)} disabled={Boolean(activeSession)} />
            </Field>
            <Field label="学习模板">
              <select
                className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                value={templateId}
                onChange={(event) => setTemplateId(event.target.value as LearningTemplateId)}
                disabled={Boolean(activeSession)}
              >
                {learningTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="本次目标">
              <TextArea value={goal} onChange={(event) => setGoal(event.target.value)} disabled={Boolean(activeSession)} />
            </Field>
            <Field label="采用策略">
              <TextArea value={strategy} onChange={(event) => setStrategy(event.target.value)} disabled={Boolean(activeSession)} />
            </Field>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-[200px_1fr]">
            <Field label="预测用时（分钟）">
              <TextInput
                type="number"
                min={5}
                max={240}
                value={predictedMinutes}
                onChange={(event) => setPredictedMinutes(Number(event.target.value))}
                disabled={Boolean(activeSession)}
              />
            </Field>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm leading-6 text-zinc-700">
              当前建议：{weeklyAdvice}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {!activeSession ? (
              <Button onClick={startSession}>
                <Play size={16} /> 开始学习
              </Button>
            ) : (
              <>
                <Button onClick={() => setIsRunning((value) => !value)}>
                  {isRunning ? <Pause size={16} /> : <Play size={16} />} {isRunning ? "暂停" : "继续"}
                </Button>
                <SecondaryButton onClick={finishSession}>
                  <Save size={16} /> 保存反思并结束
                </SecondaryButton>
              </>
            )}
            <SecondaryButton onClick={resetLocalData}>
              <Trash2 size={16} /> 清空本地数据
            </SecondaryButton>
          </div>
        </Panel>

        <Panel>
          <h2 className="text-lg font-semibold">2. 学中监控</h2>
          <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-5">
            <div className="flex items-center gap-3">
              <Clock className="text-emerald-700" size={22} />
              <div>
                <div className="font-mono text-4xl font-semibold">{formatElapsed(elapsedSeconds)}</div>
                <p className="mt-1 text-sm text-zinc-600">预测 {predictedMinutes} 分钟，当前实际约 {actualMinutes} 分钟。</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              <Metric label="元认知开销估计" value={`${Math.round(overhead * 100)}%`} detail="目标控制在 10% 以下" />
              <Metric label="完成度自评" value={`${completionRating}/5`} detail="结束前可调整" />
            </div>
          </div>
          <div className="mt-4">
            <Field label="完成度">
              <div className="grid grid-cols-5 gap-2">
                {([1, 2, 3, 4, 5] as const).map((value) => (
                  <button
                    key={value}
                    className={`rounded-md border px-3 py-2 text-sm ${
                      completionRating === value ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-zinc-300 bg-white text-zinc-700"
                    }`}
                    onClick={() => setCompletionRating(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <Panel>
          <h2 className="text-lg font-semibold">3. 2 分钟反思</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Field label="哪里顺利">
              <TextArea value={worked} onChange={(event) => setWorked(event.target.value)} placeholder="具体到策略，不写泛泛努力。" />
            </Field>
            <Field label="哪里卡壳">
              <TextArea value={stuck} onChange={(event) => setStuck(event.target.value)} placeholder="记录证据：题、段落、概念、时间。" />
            </Field>
            <Field label="下次改什么">
              <TextArea value={nextChange} onChange={(event) => setNextChange(event.target.value)} placeholder="只写一个可执行调整。" />
            </Field>
          </div>
          <div className="mt-5 grid gap-3">
            {sessions.slice(0, 5).map((session) => (
              <article key={session.id} className="rounded-lg border border-zinc-200 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{session.templateId}</Badge>
                  <span className="text-xs text-zinc-500">{new Date(session.startedAt).toLocaleString()}</span>
                </div>
                <h3 className="mt-2 font-semibold">{session.title}</h3>
                <p className="mt-1 text-sm text-zinc-600">
                  预测 {session.predictedMinutes} 分钟，实际 {session.actualMinutes ?? "-"} 分钟，完成度 {session.completionRating ?? "-"}/5
                </p>
              </article>
            ))}
          </div>
        </Panel>

        <Panel>
          <h2 className="text-lg font-semibold">盲区面板</h2>
          <p className="mt-1 text-sm text-zinc-600">直接读取《校准记忆》的复习日志，避免主观自评独自决定结论。</p>
          <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm leading-6 text-zinc-700">{weeklyAdvice}</div>
          <div className="mt-5">
            <h3 className="text-sm font-semibold">高信心错误题</h3>
            <div className="mt-2 grid gap-2">
              {highConfidenceErrors.length === 0 ? <p className="text-sm text-zinc-500">暂无高信心错误。先在校准记忆完成几轮复习。</p> : null}
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

function useLiveCards() {
  const [cards, setCards] = useState<Card[]>([]);

  useEffect(() => {
    let mounted = true;
    async function loadCards() {
      const nextCards = await getMetaLearnDb().cards.toArray();
      if (mounted) setCards(nextCards);
    }
    const timeout = window.setTimeout(() => {
      void loadCards();
    }, 0);
    return () => {
      mounted = false;
      window.clearTimeout(timeout);
    };
  }, []);

  return cards;
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function reflectionsToMarkdown(reflections: Reflection[], sessions: LearningSession[]): string {
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  return reflections
    .map((reflection) => {
      const session = sessionById.get(reflection.sessionId);
      return `## ${session?.title ?? reflection.sessionId}\n\n- 时间：${reflection.createdAt}\n- 顺利：${reflection.worked}\n- 卡壳：${reflection.stuck}\n- 下次调整：${reflection.nextChange}\n`;
    })
    .join("\n");
}
