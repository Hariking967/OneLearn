import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { deepseekStreamText } from "@/lib/ai/deepseek-client";

const serviceSupabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch all user projects + topics
  const { data: projects } = await serviceSupabase
    .from("projects")
    .select("id, name, main_topic")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!projects?.length) {
    return new Response("You have no projects yet. Create your first project to get a personalised study recommendation!", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const projectIds = projects.map((p: any) => p.id);

  // Topics across all projects
  const { data: topics } = await serviceSupabase
    .from("topics")
    .select("id, name, status, project_id")
    .in("project_id", projectIds);

  // Recent quiz scores (last 14 days)
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentScores } = await serviceSupabase
    .from("assessment_results")
    .select("topic_id, score, max_score, mode, created_at")
    .in("topic_id", (topics ?? []).map((t: any) => t.id))
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);

  // Wrong answers (shows weak areas)
  const { data: wrongAnswers } = await serviceSupabase
    .from("wrong_answers")
    .select("topic_id, question")
    .in("topic_id", (topics ?? []).map((t: any) => t.id))
    .order("created_at", { ascending: false })
    .limit(10);

  // Build context for AI
  const projectMap = new Map(projects.map((p: any) => [p.id, p.name]));
  const topicMap = new Map((topics ?? []).map((t: any) => [t.id, t]));

  const inProgress = (topics ?? []).filter((t: any) => t.status === "unlocked").slice(0, 5);
  const done = (topics ?? []).filter((t: any) => t.status === "done").length;
  const total = (topics ?? []).length;

  const wrongTopicNames = [...new Set(
    (wrongAnswers ?? [])
      .map((w: any) => topicMap.get(w.topic_id)?.name)
      .filter(Boolean)
  )].slice(0, 3);

  const scoreLines = (recentScores ?? []).slice(0, 5).map((s: any) => {
    const topic = topicMap.get(s.topic_id);
    if (!topic || s.max_score === 0) return null;
    const pct = Math.round((s.score / s.max_score) * 100);
    return `${topic.name}: ${pct}% (${s.mode})`;
  }).filter(Boolean);

  const prompt = `You are a personal AI study coach for a student using OneLearn.

STUDENT OVERVIEW (today: ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}):
- Projects: ${projects.map((p: any) => p.name).join(", ")}
- Overall progress: ${done}/${total} topics completed
- Currently unlocked (in-progress): ${inProgress.map((t: any) => `${t.name} (in ${projectMap.get(t.project_id) ?? "unknown"})`).join(", ") || "none"}
${scoreLines.length ? `- Recent quiz scores: ${scoreLines.join(", ")}` : ""}
${wrongTopicNames.length ? `- Struggling with: ${wrongTopicNames.join(", ")}` : ""}

Write a short, energetic, personalised study digest (4-6 sentences). Include:
1. A motivating opener referencing their progress
2. ONE specific topic they should focus on today and WHY (pick from unlocked topics or struggling areas)
3. A concrete tip for studying that topic
4. An encouraging closing line

Tone: friendly, direct, like a smart friend who's also a great teacher. No bullet points — flowing paragraphs only. Keep it under 100 words.`;

  const sseStream = await deepseekStreamText({
    messages: [{ role: "user", content: prompt }],
    temperature: 0.8,
    maxTokens: 200,
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

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
