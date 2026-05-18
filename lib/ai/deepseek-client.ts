// OpenRouter key takes priority — if it's set, always use OpenRouter
const OPENROUTER_KEY = process.env.OPENROUTER_DEEPSEEK_API_KEY;
const USE_OPENROUTER = !!OPENROUTER_KEY;
const DEEPSEEK_API_KEY = OPENROUTER_KEY || process.env.DEEPSEEK_API_KEY;

const DEEPSEEK_BASE_URL = USE_OPENROUTER
  ? "https://openrouter.ai/api/v1/chat/completions"
  : "https://api.deepseek.com/chat/completions";

// OpenRouter requires provider/model format; DeepSeek direct API uses bare model name
const DEFAULT_MODEL = USE_OPENROUTER ? "deepseek/deepseek-chat" : "deepseek-chat";

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface CompletionOptions {
  model?: string;
  messages: Message[];
  tools?: ToolDefinition[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export async function deepseekStreamText(options: CompletionOptions) {
  if (!DEEPSEEK_API_KEY) {
    throw new Error("No LLM API key configured. Set OPENROUTER_DEEPSEEK_API_KEY in .env.local");
  }
  const {
    model = DEFAULT_MODEL,
    messages,
    tools,
    systemPrompt,
    temperature = 0.7,
    maxTokens = 2000,
  } = options;

  const payload: Record<string, unknown> = {
    model,
    messages: systemPrompt
      ? [{ role: "system", content: systemPrompt }, ...messages]
      : messages,
    temperature,
    max_tokens: maxTokens,
    stream: true,
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  try {
    const response = await fetch(DEEPSEEK_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `DeepSeek API error: ${response.status} ${error}`
      );
    }

    if (!response.body) {
      throw new Error("No response body from DeepSeek API");
    }

    return response.body;
  } catch (error) {
    console.error("DeepSeek streaming error:", error);
    throw error;
  }
}

export async function deepseekCompletion(
  options: CompletionOptions
): Promise<string> {
  if (!DEEPSEEK_API_KEY) {
    throw new Error("No LLM API key configured. Set OPENROUTER_DEEPSEEK_API_KEY in .env.local");
  }
  const {
    model = DEFAULT_MODEL,
    messages,
    tools,
    systemPrompt,
    temperature = 0.7,
    maxTokens = 2000,
  } = options;

  const payload: Record<string, unknown> = {
    model,
    messages: systemPrompt
      ? [{ role: "system", content: systemPrompt }, ...messages]
      : messages,
    temperature,
    max_tokens: maxTokens,
    stream: false,
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  try {
    const response = await fetch(DEEPSEEK_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `DeepSeek API error: ${response.status} ${error}`
      );
    }

    const data = (await response.json()) as any;

    if (!data.choices || !data.choices[0]?.message?.content) {
      throw new Error("Invalid response structure from DeepSeek API");
    }

    return data.choices[0].message.content;
  } catch (error) {
    console.error("DeepSeek completion error:", error);
    throw error;
  }
}

export async function deepseekWithTools(
  options: CompletionOptions & { onToolCall?: (tool: ToolCall) => Promise<string> }
): Promise<string> {
  const { onToolCall, ...completionOptions } = options;
  const { messages: initialMessages } = completionOptions;
  let messages = [...initialMessages];

  let iteration = 0;
  const maxIterations = 10;

  while (iteration < maxIterations) {
    iteration++;

    const payload: Record<string, unknown> = {
      model: completionOptions.model || DEFAULT_MODEL,
      messages,
      temperature: completionOptions.temperature || 0.7,
      max_tokens: completionOptions.maxTokens || 2000,
      stream: false,
    };

    if (completionOptions.systemPrompt) {
      messages = [
        { role: "system", content: completionOptions.systemPrompt },
        ...initialMessages,
      ];
      payload.messages = messages;
    }

    if (completionOptions.tools && completionOptions.tools.length > 0) {
      payload.tools = completionOptions.tools;
    }

    try {
      const response = await fetch(DEEPSEEK_BASE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(
          `DeepSeek API error: ${response.status} ${error}`
        );
      }

      const data = (await response.json()) as any;
      const message = data.choices[0]?.message;

      if (!message) {
        throw new Error("No message in response");
      }

      // Check for tool calls
      if (message.tool_calls && message.tool_calls.length > 0 && onToolCall) {
        messages.push({
          role: "assistant",
          content: message.content || "",
        });

        for (const toolCall of message.tool_calls) {
          const result = await onToolCall(toolCall);
          messages.push({
            role: "user",
            content: `Tool result for ${toolCall.function.name}: ${result}`,
          });
        }

        continue;
      }

      return message.content || "";
    } catch (error) {
      console.error("DeepSeek tool call error:", error);
      throw error;
    }
  }

  throw new Error("Max tool iterations reached");
}
