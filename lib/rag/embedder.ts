const EMBEDDING_API_KEY = process.env.ANTHROPIC_API_KEY;
const EMBEDDING_MODEL = "claude-opus-4-1";

interface EmbeddingResponse {
  embedding: number[];
}

export async function getEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error("Cannot embed empty text");
  }

  try {
    const response = await fetch(
      "https://api.anthropic.com/v1/messages/batch/embed",
      {
        method: "POST",
        headers: {
          "x-api-key": EMBEDDING_API_KEY || "",
          "content-type": "application/json",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-opus-4-1",
          input: text,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Embedding API error: ${response.status} ${error}`
      );
    }

    const data = await response.json() as any;

    if (data.embedding && Array.isArray(data.embedding)) {
      return data.embedding;
    }

    throw new Error("Invalid embedding response structure");
  } catch (error) {
    console.error("Embedding error:", error);
    throw error;
  }
}

export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map((text) => getEmbedding(text)));
}
