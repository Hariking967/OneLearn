import { NextRequest, NextResponse } from "next/server";
import { generateMCQ, saveMCQResult, type Difficulty } from "@/lib/chat/tools/mcq-generator";
import { searchAndEmbed } from "@/lib/chat/tools/web-search";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const serviceSupabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    if (toolName === "save_test_session") {
      const { mode, difficulty, questions, answers, score, maxScore, review } = toolArgs as any;
      const { error } = await serviceSupabase.from("test_sessions").insert({
        topic_id: topicId,
        mode: mode ?? "mcq",
        difficulty: difficulty ?? "medium",
        questions: questions,
        answers: answers ?? null,
        score: score ?? null,
        max_score: maxScore ?? null,
        review: review ?? null,
        submitted_at: score !== undefined ? new Date().toISOString() : null,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (toolName === "list_test_sessions") {
      const { data, error } = await serviceSupabase
        .from("test_sessions")
        .select("id, mode, difficulty, questions, score, max_score, created_at, submitted_at")
        .eq("topic_id", topicId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ sessions: data ?? [] });
    }

    if (toolName === "get_test_session") {
      const { sessionId } = toolArgs as { sessionId: string };
      const { data, error } = await serviceSupabase
        .from("test_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();
      if (error || !data) return NextResponse.json({ error: "Session not found" }, { status: 404 });
      return NextResponse.json({ session: data });
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
