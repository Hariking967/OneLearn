import { createClient } from "@supabase/supabase-js";
import { deepseekCompletion } from "@/lib/ai/deepseek-client";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export interface MCQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number; // 0-3 index
  explanation: string;
}

export type Difficulty = "easy" | "medium" | "hard";

export async function generateMCQ(
  topicId: string,
  numQuestions: number = 5,
  difficulty: Difficulty = "medium"
): Promise<MCQuestion[]> {
  if (!topicId) throw new Error("topicId is required");
  if (numQuestions < 1 || numQuestions > 20) throw new Error("numQuestions must be 1–20");

  // Fetch topic (no level column)
  const { data: topic, error: topicError } = await supabase
    .from("topics")
    .select("name, description, project_id")
    .eq("id", topicId)
    .single();

  if (topicError || !topic) throw new Error(`Topic ${topicId} not found`);

  // Get ALL descendant topic names for richer context
  const descendants = await getAllDescendants(topicId);
  const descendantNames = descendants.map((d) => d.name).join(", ");

  // Recent chat history (correct table name)
  const { data: chatHistory } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("topic_id", topicId)
    .order("created_at", { ascending: false })
    .limit(20);

  const chatContext = (chatHistory ?? [])
    .reverse()
    .map((m: { role: string; content: string }) => `${m.role === "user" ? "Student" : "Tutor"}: ${m.content}`)
    .join("\n");

  const difficultyGuide = {
    easy: "Focus on definitions, basic concepts, and straightforward recall.",
    medium: "Include application questions and require understanding of how concepts relate.",
    hard: "Test deep understanding, edge cases, common misconceptions, and require analysis.",
  }[difficulty];

  const systemPrompt = `You are an expert educational assessment writer.
Generate exactly ${numQuestions} multiple-choice questions.
Difficulty: ${difficulty.toUpperCase()} — ${difficultyGuide}
Rules:
- 4 options each, exactly one correct
- Options must be plausible (no obviously wrong distractors)
- Include a clear 1-sentence explanation
- Return ONLY a valid JSON array, no markdown, no extra text`;

  const userPrompt = `Topic: "${topic.name}"
${topic.description ? `Description: ${topic.description}` : ""}
${descendantNames ? `Related prerequisite concepts: ${descendantNames}` : ""}
${chatContext ? `\nRecent learning session:\n${chatContext}` : ""}

Output format (JSON array only):
[
  {
    "question": "...",
    "options": ["A text", "B text", "C text", "D text"],
    "correctAnswer": 0,
    "explanation": "..."
  }
]`;

  const raw = await deepseekCompletion({
    messages: [{ role: "user", content: userPrompt }],
    systemPrompt,
    temperature: 0.6,
    maxTokens: 3000,
  });

  // Extract JSON array robustly
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("No JSON array found in MCQ response");

  let parsed: unknown[];
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch (e) {
    throw new Error(`Failed to parse MCQ JSON: ${(e as Error).message}`);
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Empty or invalid MCQ array returned");
  }

  return parsed.map((q: any, idx: number) => {
    if (!q.question || !Array.isArray(q.options) || q.options.length !== 4) {
      throw new Error(`Question ${idx + 1} has invalid structure`);
    }
    const correct = Number(q.correctAnswer);
    if (isNaN(correct) || correct < 0 || correct > 3) {
      throw new Error(`Question ${idx + 1} has invalid correctAnswer`);
    }
    const options = q.options.map(String);
    const correctText = options[correct];
    // Fisher-Yates shuffle so the correct answer isn't always option A
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    return {
      id: `mcq-${Date.now()}-${idx}`,
      question: q.question,
      options,
      correctAnswer: options.indexOf(correctText),
      explanation: q.explanation ?? "",
    };
  });
}

async function getAllDescendants(topicId: string): Promise<Array<{ id: string; name: string }>> {
  const { data: edges } = await supabase
    .from("topic_edges")
    .select("child_id")
    .eq("parent_id", topicId);

  if (!edges?.length) return [];

  const childIds = edges.map((e: { child_id: string }) => e.child_id);
  const { data: children } = await supabase
    .from("topics")
    .select("id, name")
    .in("id", childIds);

  if (!children?.length) return [];

  const result = [...children] as Array<{ id: string; name: string }>;
  for (const child of children) {
    const deeper = await getAllDescendants(child.id);
    result.push(...deeper);
  }
  return result;
}

export async function saveMCQResult(
  topicId: string,
  score: number,
  total: number,
  wrongAnswers: Array<{ question: string; userAnswer: string; correctAnswer: string }>
): Promise<void> {
  await supabase.from("assessment_results").insert({
    topic_id: topicId,
    mode: "mcq",
    score,
    max_score: total,
    created_at: new Date().toISOString(),
  });

  if (wrongAnswers.length > 0) {
    await supabase.from("wrong_answers").insert(
      wrongAnswers.map((w) => ({
        topic_id: topicId,
        question: w.question,
        user_answer: w.userAnswer,
        correct_answer: w.correctAnswer,
      }))
    );
  }
}
