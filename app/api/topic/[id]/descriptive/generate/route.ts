import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deepseekCompletion } from "@/lib/ai/deepseek-client";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const serviceSupabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: topicId } = await params;

  const { numQuestions = 3, difficulty = "medium" } = await request.json().catch(() => ({}));

  const { data: topic } = await serviceSupabase
    .from("topics")
    .select("name, description")
    .eq("id", topicId)
    .single();

  if (!topic) return NextResponse.json({ error: "Topic not found" }, { status: 404 });

  const { data: edges } = await serviceSupabase
    .from("topic_edges")
    .select("child_id")
    .eq("parent_id", topicId);

  let childNames = "";
  if (edges?.length) {
    const { data: children } = await serviceSupabase
      .from("topics")
      .select("name")
      .in("id", edges.map((e: any) => e.child_id));
    childNames = children?.map((c: any) => c.name).join(", ") ?? "";
  }

  const { data: memory } = await serviceSupabase
    .from("topic_memory")
    .select("summary")
    .eq("topic_id", topicId)
    .single();

  const difficultyGuide: Record<string, string> = {
    easy: "Conceptual and definitional questions. Short answers expected.",
    medium: "Application and explanation questions. 3-5 sentence answers expected.",
    hard: "Analysis, derivation, and edge-case questions. Detailed answers with examples expected.",
  };

  const prompt = `Generate exactly ${numQuestions} descriptive exam questions for the topic "${topic.name}".
${topic.description ? `Topic description: ${topic.description}` : ""}
${childNames ? `Prerequisite concepts: ${childNames}` : ""}
${memory?.summary ? `What the student has already covered: ${memory.summary}` : ""}

Difficulty: ${String(difficulty).toUpperCase()} — ${difficultyGuide[String(difficulty)] ?? difficultyGuide.medium}

Return ONLY a JSON array of question strings:
["Question 1?", "Question 2?", "Question 3?"]

Rules:
- Exactly ${numQuestions} questions
- Questions should require written explanations, not single-word answers
- Vary the types: explain, compare, derive, apply, analyse
- No true/false, no MCQ — descriptive only`;

  const raw = await deepseekCompletion({
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    maxTokens: 1000,
  });

  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1) {
    return NextResponse.json({ error: "AI returned invalid format" }, { status: 500 });
  }

  let questions: string[];
  try {
    questions = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return NextResponse.json({ error: "Failed to parse questions" }, { status: 500 });
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json({ error: "No questions generated" }, { status: 500 });
  }

  return NextResponse.json({ questions });
}
