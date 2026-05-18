import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deepseekStreamText } from "@/lib/ai/deepseek-client";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const serviceSupabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project } = await serviceSupabase
    .from("projects")
    .select("name, main_topic")
    .eq("id", projectId)
    .single();
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: topics } = await serviceSupabase
    .from("topics")
    .select("id, name, description, status")
    .eq("project_id", projectId)
    .order("created_at");

  if (!topics?.length) return NextResponse.json({ error: "No topics" }, { status: 400 });

  const topicIds = topics.map((t: any) => t.id);

  const [{ data: memories }, { data: assessments }] = await Promise.all([
    serviceSupabase.from("topic_memory").select("topic_id, summary").in("topic_id", topicIds),
    serviceSupabase.from("assessment_results").select("topic_id, mode, score, max_score").in("topic_id", topicIds),
  ]);

  const memoryMap = new Map((memories ?? []).map((m: any) => [m.topic_id, m.summary]));
  const assessMap = new Map<string, any[]>();
  for (const a of (assessments ?? [])) {
    if (!assessMap.has(a.topic_id)) assessMap.set(a.topic_id, []);
    assessMap.get(a.topic_id)!.push(a);
  }

  const done = topics.filter((t: any) => t.status === "done").length;
  const unlocked = topics.filter((t: any) => t.status === "unlocked").length;
  const locked = topics.filter((t: any) => t.status === "locked").length;

  const topicDetails = topics.map((t: any) => {
    const mem = memoryMap.get(t.id);
    const tests = assessMap.get(t.id) ?? [];
    const avgScore = tests.length
      ? tests.reduce((s: number, a: any) => s + (a.score / a.max_score), 0) / tests.length
      : null;
    return (
      `- [${t.status.toUpperCase()}] ${t.name}: ${mem ?? "No sessions yet."}` +
      (avgScore !== null ? ` (avg test score: ${Math.round(avgScore * 100)}%)` : "")
    );
  }).join("\n");

  const prompt = `You are reviewing a student's learning progress for the project "${project.name}" (main goal: ${project.main_topic ?? project.name}).

Topics (${done}/${topics.length} completed, ${unlocked} in progress, ${locked} locked):
${topicDetails}

Write a structured project summary in markdown with these sections:
1. **Overall Progress** — 1-2 sentences on where the student stands
2. **Strengths** — what they've clearly mastered
3. **Gaps & Weak Areas** — specific concepts that need work
4. **Recommended Next Steps** — 3 concrete actions
5. **Estimated Completion** — rough estimate based on pace

Also output at the very end, on its own line:
PROGRESS_SCORE: <number 0-100>
(Your honest assessment of overall mastery, not just completion percentage)`;

  const sseStream = await deepseekStreamText({
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
    maxTokens: 1200,
  });

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = "";

  const readable = new ReadableStream({
    async start(controller) {
      const reader = sseStream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              const text: string = parsed.choices?.[0]?.delta?.content ?? "";
              if (text) controller.enqueue(encoder.encode(text));
            } catch {}
          }
        }
      } finally {
        reader.releaseLock();
      }
      controller.close();
    },
  });

  return new NextResponse(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
