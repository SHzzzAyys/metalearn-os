import { generateFallbackSocraticQuestions, socraticResponseSchema } from "@metalearn/ai";
import type { LearningTemplateId } from "@metalearn/core";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    concept?: string;
    explanation?: string;
    templateId?: LearningTemplateId;
  };

  if (!body.concept || !body.explanation || !body.templateId) {
    return NextResponse.json({ error: "concept, explanation, and templateId are required" }, { status: 400 });
  }

  const response = generateFallbackSocraticQuestions({
    concept: body.concept,
    explanation: body.explanation,
    templateId: body.templateId
  });

  return NextResponse.json({
    provider: "local-schema-checked",
    noDirectAnswer: true,
    result: socraticResponseSchema.parse(response)
  });
}

