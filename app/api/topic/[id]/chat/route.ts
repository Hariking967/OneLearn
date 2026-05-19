import { NextRequest, NextResponse } from "next/server";
import {
  streamNodeChat,
  saveChatMessage,
  getNodeChatHistory,
  refreshTopicMemory,
} from "@/lib/chat/node-chat-service";

interface ChatRequest {
  userMessage: string;
  messageHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  sessionId?: string;
}

interface ChatError {
  error: string;
  details?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response | NextResponse<ChatError>> {
  const { id: topicId } = await params;

  try {
    let body: ChatRequest;
    try {
      body = (await request.json()) as ChatRequest;
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const { userMessage, messageHistory, sessionId } = body;

    if (!userMessage?.trim()) {
      return NextResponse.json({ error: "userMessage is required" }, { status: 400 });
    }
    if (!topicId) {
      return NextResponse.json({ error: "Topic ID is required" }, { status: 400 });
    }

    console.log(`[Chat API] topic=${topicId} msg="${userMessage.slice(0, 60)}"`);

    await saveChatMessage(topicId, "user", userMessage, sessionId);

    const messages =
      messageHistory?.length ? messageHistory : await getNodeChatHistory(topicId, 20);

    // Returns the raw SSE ReadableStream from the LLM
    const sseStream = await streamNodeChat(topicId, messages, userMessage);

    // Transform: parse SSE → emit plain text chunks
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let fullResponse = "";
    let buffer = "";

    const readable = new ReadableStream({
      async start(controller) {
        const reader = sseStream.getReader();
        let pendingToolCalls: Array<{ id: string; name: string; argumentsStr: string }> = [];

        const flush = (text: string) => {
          if (!text) return;
          fullResponse += text;
          controller.enqueue(encoder.encode(text));
        };

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
                const delta = parsed.choices?.[0]?.delta;
                const finishReason = parsed.choices?.[0]?.finish_reason;

                if (delta?.content) flush(delta.content);

                if (delta?.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    const idx = tc.index ?? 0;
                    if (!pendingToolCalls[idx]) {
                      pendingToolCalls[idx] = { id: tc.id ?? "", name: tc.function?.name ?? "", argumentsStr: "" };
                    }
                    if (tc.function?.name) pendingToolCalls[idx].name = tc.function.name;
                    if (tc.function?.arguments) pendingToolCalls[idx].argumentsStr += tc.function.arguments;
                  }
                }

                if (finishReason === "tool_calls" && pendingToolCalls.length > 0) {
                  for (const tc of pendingToolCalls) {
                    let args: Record<string, unknown> = {};
                    try { args = JSON.parse(tc.argumentsStr); } catch {}

                    if (tc.name === "web_search") {
                      const query = String(args.query ?? "");
                      flush(`\n\n🔍 Searching: "${query}"…\n`);
                      try {
                        const { searchAndEmbed } = await import("@/lib/chat/tools/web-search");
                        const summary = await searchAndEmbed(topicId, query);
                        flush(`\n${summary}\n`);
                      } catch (e) {
                        flush(`\n(Search failed: ${e instanceof Error ? e.message : "unknown"})\n`);
                      }
                    }

                    if (tc.name === "generate_mcq") {
                      flush(`\n\n[TOOL:generate_mcq]\n`);
                    }
                  }
                  pendingToolCalls = [];
                }
              } catch {
                // skip malformed SSE lines
              }
            }
          }

          // Flush remaining buffer
          if (buffer.startsWith("data: ")) {
            const data = buffer.slice(6).trim();
            if (data && data !== "[DONE]") {
              try {
                const parsed = JSON.parse(data);
                const text: string = parsed.choices?.[0]?.delta?.content ?? "";
                if (text) flush(text);
              } catch {}
            }
          }
        } finally {
          reader.releaseLock();
        }

        if (fullResponse) {
          try {
            await saveChatMessage(topicId, "assistant", fullResponse, sessionId);
            refreshTopicMemory(topicId).catch(console.error);
          } catch (e) {
            console.error("[Chat API] Failed to save assistant message:", e);
          }
        }
        controller.close();
      },
    });

    return new NextResponse(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("[Chat Error]", error);
    return NextResponse.json<ChatError>(
      {
        error: "Failed to process chat message",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
