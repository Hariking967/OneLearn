const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const EMBED_URL = "https://api.openai.com/v1/embeddings";
const EMBED_MODEL = "text-embedding-3-small"; // 1536 dims

export async function getEmbedding(text: string): Promise<number[]> {
  if (!text?.trim()) throw new Error("Cannot embed empty text");
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");

  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: text.slice(0, 8192) }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI embedding error ${res.status}: ${err}`);
  }

  const data = await res.json() as { data: Array<{ embedding: number[] }> };
  const embedding = data.data?.[0]?.embedding;
  if (!Array.isArray(embedding)) throw new Error("Invalid embedding response");
  return embedding;
}

export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");
  if (texts.length === 0) return [];

  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts.map(t => t.slice(0, 8192)) }),
  });

  if (!res.ok) throw new Error(`OpenAI embedding batch error ${res.status}`);

  const data = await res.json() as { data: Array<{ embedding: number[]; index: number }> };
  const sorted = data.data.sort((a, b) => a.index - b.index);
  return sorted.map(d => d.embedding);
}
