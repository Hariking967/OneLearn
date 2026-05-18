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
  limit: number = 5
): Promise<string> {
  try {
    const queryEmbedding = await getEmbedding(
      `Learn about this topic and its prerequisites`
    );

    // Search across all project resources + web search chunks
    const { data: chunks, error } = await supabase.rpc(
      "search_embeddings",
      {
        query_embedding: queryEmbedding,
        project_id: projectId,
        match_limit: limit,
        match_threshold: 0.7,
      }
    );

    if (error) {
      console.error("Retrieval error:", error);
      return "";
    }

    if (!chunks || chunks.length === 0) {
      return "";
    }

    // Format context
    const context = chunks
      .map(
        (chunk: any, idx: number) =>
          `[Source ${idx + 1}] ${chunk.chunk_text}`
      )
      .join("\n\n");

    return context;
  } catch (error) {
    console.error("RAG retrieval error:", error);
    return "";
  }
}

export async function semanticSearch(
  projectId: string,
  query: string,
  limit: number = 10
): Promise<RetrievedChunk[]> {
  try {
    const embedding = await getEmbedding(query);

    const { data: results, error } = await supabase.rpc(
      "search_embeddings",
      {
        query_embedding: embedding,
        project_id: projectId,
        match_limit: limit,
        match_threshold: 0.6,
      }
    );

    if (error) {
      throw error;
    }

    return (
      results?.map((result: any) => ({
        id: result.id,
        text: result.chunk_text,
        similarity: result.similarity,
        source: result.source_url || "resource",
      })) || []
    );
  } catch (error) {
    console.error("Semantic search error:", error);
    throw error;
  }
}
