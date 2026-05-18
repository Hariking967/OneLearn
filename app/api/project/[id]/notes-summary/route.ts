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

  // Fetch all resources for this project
  const { data: resources, error: resError } = await serviceSupabase
    .from("resources")
    .select("id, label, type, url")
    .eq("project_id", projectId)
    .order("created_at");

  if (resError || !resources?.length) {
    return NextResponse.json({ error: "No resources found" }, { status: 400 });
  }

  // Fetch all ingested chunks for this project (up to 60 — enough for a good summary)
  const { data: chunks } = await serviceSupabase
    .from("resource_chunks")
    .select("resource_id, content")
    .eq("project_id", projectId)
    .order("chunk_index")
    .limit(60);

  // Group chunks by resource_id
  const chunksByResource = new Map<string, string[]>();
  for (const chunk of (chunks ?? [])) {
    if (!chunksByResource.has(chunk.resource_id)) chunksByResource.set(chunk.resource_id, []);
    chunksByResource.get(chunk.resource_id)!.push(chunk.content);
  }

  // Build the corpus for each resource
  const sections: string[] = [];
  for (const r of resources) {
    const resourceChunks = chunksByResource.get(r.id);
    if (resourceChunks?.length) {
      // Use indexed content
      const text = resourceChunks.join(" ").slice(0, 4000);
      sections.push(`### ${r.label} (${r.type})\n${text}`);
    } else if (r.type === "note" && r.url) {
      // Notes store their content directly in the url field
      sections.push(`### ${r.label} (note)\n${r.url.slice(0, 4000)}`);
    } else {
      // Not yet ingested — mention it exists
      sections.push(`### ${r.label} (${r.type})\n[Content not yet indexed]`);
    }
  }

  if (sections.length === 0) {
    return NextResponse.json({ error: "No content to summarise" }, { status: 400 });
  }

  const prompt = `You are summarising a student's learning resources for a project.

Here are the resources:

${sections.join("\n\n")}

Write a clear, well-structured summary in markdown with these sections:
1. **Key Concepts** — the main ideas and definitions covered across all resources
2. **Important Details** — notable facts, formulas, examples, or methods
3. **Connections** — how the resources relate to each other (if applicable)
4. **Quick Reference** — a compact bullet-point cheat sheet of the most important points

Be concise but thorough. Focus on what a student would need to remember.`;

  const sseStream = await deepseekStreamText({
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    maxTokens: 1500,
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
