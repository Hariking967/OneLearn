import { NextRequest, NextResponse } from "next/server";
import { generateMCQ, saveMCQResult, type Difficulty } from "@/lib/chat/tools/mcq-generator";
import { searchAndEmbed } from "@/lib/chat/tools/web-search";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: topicId } = await params;

  if (!topicId) {
    return NextResponse.json({ error: "Topic ID is required" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { toolName, toolArgs } = body as {
    toolName: string;
    toolArgs?: Record<string, unknown>;
  };

  try {
    if (toolName === "generate_mcq") {
      const numQuestions = Math.min(Math.max(Number(toolArgs?.numQuestions ?? 5), 1), 20);
      const difficulty = (toolArgs?.difficulty as Difficulty) ?? "medium";
      const questions = await generateMCQ(topicId, numQuestions, difficulty);
      return NextResponse.json({ success: true, questions });
    }

    if (toolName === "save_mcq_result") {
      const { score, total, wrongAnswers } = toolArgs as {
        score: number;
        total: number;
        wrongAnswers: Array<{ question: string; userAnswer: string; correctAnswer: string }>;
      };
      await saveMCQResult(topicId, score, total, wrongAnswers ?? []);
      return NextResponse.json({ success: true });
    }

    if (toolName === "web_search") {
      const query = toolArgs?.query as string;
      if (!query?.trim()) {
        return NextResponse.json({ error: "web_search requires a query" }, { status: 400 });
      }
      const result = await searchAndEmbed(topicId, query);
      return NextResponse.json({ success: true, result });
    }

    return NextResponse.json({ error: `Unknown tool: ${toolName}` }, { status: 400 });
  } catch (error) {
    console.error("[Tool Error]", error);
    return NextResponse.json(
      { error: "Tool execution failed", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
