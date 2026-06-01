import { cardCandidateListSchema, generateFallbackCardCandidates } from "@metalearn/ai";
import type { LearningTemplateId, SourceChunk } from "@metalearn/core";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    chunks?: SourceChunk[];
    templateId?: LearningTemplateId;
    requestedCount?: number;
  };

  if (!body.chunks?.length || !body.templateId) {
    return NextResponse.json({ error: "chunks and templateId are required" }, { status: 400 });
  }

  const candidates = generateFallbackCardCandidates({
    chunks: body.chunks,
    templateId: body.templateId,
    requestedCount: body.requestedCount
  });
  const parsed = cardCandidateListSchema.parse(candidates);

  return NextResponse.json({
    provider: "local-schema-checked",
    uploadedAfterUserAction: true,
    candidates: parsed
  });
}

