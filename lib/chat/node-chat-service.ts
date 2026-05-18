import { createClient } from "@supabase/supabase-js";
import { deepseekStreamText, deepseekCompletion, type ToolDefinition, type Message } from "@/lib/ai/deepseek-client";
import { getRAGContext } from "@/lib/rag/retriever";
import { generateMCQ } from "./tools/mcq-generator";
import { searchAndEmbed } from "./tools/web-search";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function buildChatContext(topicId: string): Promise<string> {
  try {
    const { data: topic, error: topicError } = await supabase
      .from("topics")
      .select("name, project_id, description")
      .eq("id", topicId)
      .single();

    if (topicError || !topic) throw new Error("Topic not found");

    // Run all independent lookups in parallel
    const [allDescendants, ownMemory, ragContext] = await Promise.all([
      getAllDescendants(topicId),
      supabase.from("topic_memory").select("summary").eq("topic_id", topicId).single(),
      getRAGContext(topic.project_id, topicId, 5).catch(() => ""),
    ]);

    // Fetch memory summaries for ALL descendants (what the student learned in prerequisite topics)
    const childMemories = await getChildrenMemories(allDescendants.map((c) => c.id));

    let context = `# Current Topic: ${topic.name}\n`;
    if (topic.description) context += `${topic.description}\n\n`;

    if (allDescendants.length > 0) {
      context += `## Prerequisite Topics (all concepts the student should know):\n`;
      allDescendants.forEach((child) => {
        const mem = childMemories.get(child.id);
        context += `- **${child.name}**`;
        if (mem) context += ` — ${mem}`;
        context += "\n";
      });
      context += "\n";
    }

    if (ownMemory.data?.summary) {
      context += `## Prior Session Memory (what was covered in previous sessions on THIS topic):\n`;
      context += ownMemory.data.summary + "\n\n";
    }

    if (ragContext) {
      context += `## Relevant Resources:\n${ragContext}\n\n`;
    }

    return context;
  } catch (error) {
    console.error("[Chat Context Error]", error);
    return "";
  }
}

async function getAllDescendants(topicId: string): Promise<Array<{ id: string; name: string }>> {
  const { data: edges } = await supabase
    .from("topic_edges")
    .select("child_id")
    .eq("parent_id", topicId);

  if (!edges?.length) return [];

  const childIds = edges.map((e: { child_id: string }) => e.child_id);
  const { data: directChildren } = await supabase
    .from("topics")
    .select("id, name")
    .in("id", childIds);

  if (!directChildren?.length) return [];

  const result = [...directChildren] as Array<{ id: string; name: string }>;
  for (const child of directChildren) {
    const deeper = await getAllDescendants(child.id);
    result.push(...deeper);
  }
  return result;
}

async function getChildrenMemories(childIds: string[]): Promise<Map<string, string>> {
  if (!childIds.length) return new Map();

  const { data } = await supabase
    .from("topic_memory")
    .select("topic_id, summary")
    .in("topic_id", childIds);

  const map = new Map<string, string>();
  (data ?? []).forEach((row: { topic_id: string; summary: string }) => {
    map.set(row.topic_id, row.summary);
  });
  return map;
}


export const CHAT_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "generate_mcq",
      description: "Generate a multiple-choice quiz based on this topic and its concepts. Results are created on-demand.",
      parameters: {
        type: "object",
        properties: {
          numQuestions: {
            type: "number",
            description: "Number of questions to generate (1-10, default 5)",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for additional learning resources on a specific topic and add them to your knowledge base.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query to find additional resources",
          },
        },
        required: ["query"],
      },
    },
  },
];

export async function streamNodeChat(
  topicId: string,
  messages: Message[],
  userMessage: string
): Promise<ReadableStream<Uint8Array>> {
  const context = await buildChatContext(topicId);

  // Extract topic name from context header for the system prompt
  const topicNameMatch = context.match(/^# Current Topic: (.+)$/m)
  const topicLabel = topicNameMatch?.[1] ?? topicId

  const systemPrompt = `You are an expert tutor helping a student learn "${topicLabel}".

${context}

You have access to tools:
1. **generate_mcq**: Create quiz questions to test understanding
2. **web_search**: Find additional learning resources on the web

Guide the student through this topic. Suggest tools when useful:
- Suggest generate_mcq when the student has learned enough and should test themselves
- Suggest web_search if the student asks for more resources or deeper coverage

Be conversational, clear, and encouraging.`;

  const allMessages: Message[] = [...messages, { role: "user", content: userMessage }];

  try {
    const stream = await deepseekStreamText({
      systemPrompt,
      messages: allMessages,
      tools: CHAT_TOOLS,
      temperature: 0.7,
      maxTokens: 2000,
    });

    if (!stream) {
      throw new Error("No stream returned from DeepSeek");
    }

    return stream;
  } catch (error) {
    console.error("[Stream Chat Error]", error);
    throw error;
  }
}

export async function saveChatMessage(
  topicId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  if (!topicId || !content) {
    throw new Error("topicId and content are required");
  }

  try {
    const { error } = await supabase.from("chat_messages").insert({
      topic_id: topicId,
      role,
      content,
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error("[Save Message Error]", error);
    throw error;
  }
}

export async function updateNodeMemory(
  topicId: string,
  summary: string
): Promise<void> {
  if (!topicId || !summary) {
    throw new Error("topicId and summary are required");
  }

  try {
    const { error } = await supabase.from("topic_memory").upsert({
      topic_id: topicId,
      summary,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      throw error;
    }

    console.log(`[Node Memory] Updated for topic ${topicId}`);
  } catch (error) {
    console.error("[Update Memory Error]", error);
    throw error;
  }
}

/**
 * Summarise recent chat and persist to topic_memory so parent topics can reference it.
 * Called fire-and-forget after each assistant response.
 */
export async function refreshTopicMemory(topicId: string): Promise<void> {
  try {
    const [{ data: topic }, recentMessages] = await Promise.all([
      supabase.from("topics").select("name").eq("id", topicId).single(),
      getNodeChatHistory(topicId, 20),
    ]);

    if (!topic || recentMessages.length < 2) return;

    const transcript = recentMessages
      .map((m) => `${m.role === "user" ? "Student" : "Tutor"}: ${m.content}`)
      .join("\n");

    const summary = await deepseekCompletion({
      messages: [
        {
          role: "user",
          content: `Summarise what the student has learned about "${topic.name}" from this conversation in 2-3 sentences. Focus on concepts covered and any gaps. Be concise.\n\n${transcript}`,
        },
      ],
      temperature: 0.3,
      maxTokens: 200,
    });

    if (summary) {
      await supabase.from("topic_memory").upsert({
        topic_id: topicId,
        summary,
        updated_at: new Date().toISOString(),
      });
      console.log(`[Memory] Updated for topic ${topicId}`);
    }
  } catch (error) {
    console.error("[Memory Refresh Error]", error);
  }
}

export async function getNodeChatHistory(
  topicId: string,
  limit: number = 50
): Promise<Message[]> {
  if (!topicId || typeof topicId !== "string") {
    throw new Error("topicId must be a non-empty string");
  }

  try {
    const { data: messages, error } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("topic_id", topicId)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) {
      throw error;
    }

    return (messages || []).map((m: any) => ({
      role: m.role,
      content: m.content,
    }));
  } catch (error) {
    console.error("[Get Chat History Error]", error);
    return [];
  }
}

export async function generateTopicSummary(topicId: string): Promise<string> {
  if (!topicId || typeof topicId !== "string") {
    throw new Error("topicId must be a non-empty string");
  }

  try {
    // Get topic name
    const { data: topic } = await supabase
      .from("topics")
      .select("name")
      .eq("id", topicId)
      .single();

    if (!topic) {
      throw new Error("Topic not found");
    }

    // Get chat history
    const messages = await getNodeChatHistory(topicId, 100);

    if (messages.length === 0) {
      return "No learning session history yet.";
    }

    // Summarize using DeepSeek
    const conversationText = messages
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    const summary = await deepseekCompletion({
      messages: [
        {
          role: "user",
          content: `Summarize the following learning session about "${topic.name}" in 2-3 sentences:\n\n${conversationText}`,
        },
      ],
      temperature: 0.5,
      maxTokens: 500,
    });

    return summary;
  } catch (error) {
    console.error("[Summary Generation Error]", error);
    return "Failed to generate summary";
  }
}
