import { createClient } from "@supabase/supabase-js";
import { getEmbedding } from "./embedder";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export interface RetrievedChunk {
  id: string;
  text: string;
  similarity: number;
  source: string;
}

export async function getRAGContext(
  projectId: string,
  topicId: string,
  limit: number = 5,
  query?: string
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) return "";

  try {
    const searchQuery = query?.trim() || "key concepts definitions examples";
    const queryEmbedding = await getEmbedding(searchQuery);

    const { data: chunks, error } = await supabase.rpc("search_embeddings", {
      query_embedding: queryEmbedding,
      project_id: projectId,
      match_limit: limit,
      match_threshold: 0.55,
    });

    if (error || !chunks?.length) return "";

    return chunks
      .map((c: any, i: number) => `[Resource ${i + 1}]: ${c.chunk_text}`)
      .join("\n\n");
  } catch (err) {
    console.warn("[RAG] retrieval failed:", err);
    return "";
  }
}

export async function semanticSearch(
  projectId: string,
  query: string,
  limit: number = 10
): Promise<RetrievedChunk[]> {
  if (!process.env.OPENAI_API_KEY) return [];

  try {
    const embedding = await getEmbedding(query);

    const { data: results, error } = await supabase.rpc("search_embeddings", {
      query_embedding: embedding,
      project_id: projectId,
      match_limit: limit,
      match_threshold: 0.6,
    });

    if (error) throw error;

    return (results ?? []).map((result: any) => ({
      id: result.id,
      text: result.chunk_text,
      similarity: result.similarity,
      source: result.source_url || "resource",
    }));
  } catch (err) {
    console.error("[Semantic search error]", err);
    return [];
  }
}
