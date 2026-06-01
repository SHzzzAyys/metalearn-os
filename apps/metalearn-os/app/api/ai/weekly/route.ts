import { summarizeWeeklyReport, weeklySummarySchema } from "@metalearn/ai";
import type { ReviewLog } from "@metalearn/core";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    logs?: ReviewLog[];
    weakTags?: string[];
    recommendation?: string;
  };

  return NextResponse.json({
    provider: "local-schema-checked",
    result: weeklySummarySchema.parse(
      summarizeWeeklyReport({
        logs: body.logs ?? [],
        weakTags: body.weakTags ?? [],
        recommendation: body.recommendation ?? "先完成几次校准提取，累积足够证据。"
      })
    )
  });
}

