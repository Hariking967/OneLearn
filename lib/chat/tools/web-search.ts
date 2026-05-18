import { createClient } from "@supabase/supabase-js";
import { chunkText } from "@/lib/rag/chunker";
import { getEmbedding } from "@/lib/rag/embedder";

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

if (!TAVILY_API_KEY) {
  console.warn("TAVILY_API_KEY is not set. Web search will be disabled.");
}

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  rawContent?: string;
}

export async function webSearch(query: string): Promise<SearchResult[]> {
  if (!TAVILY_API_KEY) {
    throw new Error("TAVILY_API_KEY is not configured");
  }

  if (!query || typeof query !== "string" || query.trim().length === 0) {
    throw new Error("Search query must be a non-empty string");
  }

  try {
    console.log(`[Web Search] Searching for: "${query}"`);

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        include_answer: true,
        max_results: 5,
        search_depth: "basic",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Tavily API error: ${response.status} ${error}`);
    }

    const data = (await response.json()) as any;

    if (!data.results || !Array.isArray(data.results)) {
      console.warn("No results from Tavily API");
      return [];
    }

    const results: SearchResult[] = data.results.map((result: any) => ({
      title: result.title || "Untitled",
      url: result.url || "",
      content: result.content || "",
      rawContent: result.raw_content,
    }));

    console.log(`[Web Search] Found ${results.length} results`);
    return results;
  } catch (error) {
    console.error("[Web Search Error]", error);
    throw error;
  }
}

export async function embedAndStoreSearchResults(
  topicId: string,
  query: string,
  results: SearchResult[]
): Promise<number> {
  if (!topicId || typeof topicId !== "string") {
    throw new Error("topicId must be a non-empty string");
  }

  if (!query || typeof query !== "string") {
    throw new Error("query must be a non-empty string");
  }

  if (!Array.isArray(results)) {
    throw new Error("results must be an array");
  }

  try {
    console.log(
      `[Embedding] Processing ${results.length} search results for topic ${topicId}`
    );

    const chunks: Array<{
      topic_id: string;
      search_query: string;
      chunk_text: string;
      embedding: number[];
    }> = [];

    for (const result of results) {
      // Combine title and content for better context
      const fullText = `${result.title}\n\nSource: ${result.url}\n\n${result.content || result.rawContent || ""}`;

      if (!fullText || fullText.trim().length === 0) {
        console.warn(`Skipping empty result for: ${result.title}`);
        continue;
      }

      // Split into chunks
      const textChunks = chunkText(fullText, 512, 50);

      for (const chunk of textChunks) {
        if (chunk.trim().length === 0) continue;

        try {
          const embedding = await getEmbedding(chunk);
          chunks.push({
            topic_id: topicId,
            search_query: query,
            chunk_text: chunk,
            embedding,
          });
        } catch (embeddingError) {
          console.error(`Failed to embed chunk for topic ${topicId}:`, embeddingError);
          // Continue with other chunks
        }
      }
    }

    if (chunks.length === 0) {
      console.warn("No chunks to store");
      return 0;
    }

    console.log(`[Embedding] Storing ${chunks.length} chunks`);

    // Insert in batches to avoid payload size limits
    const BATCH_SIZE = 100;
    let totalInserted = 0;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const { error, count } = await supabase
        .from("web_search_chunks")
        .insert(batch);

      if (error) {
        throw new Error(`Failed to store batch: ${error.message}`);
      }

      totalInserted += count || 0;
    }

    console.log(`[Embedding] Successfully stored ${totalInserted} chunks`);
    return totalInserted;
  } catch (error) {
    console.error("[Embedding Storage Error]", error);
    throw error;
  }
}

export async function searchAndEmbed(
  topicId: string,
  query: string
): Promise<{ resultsCount: number; chunksStored: number }> {
  if (!topicId || !query) {
    throw new Error("topicId and query are required");
  }

  try {
    console.log(`[Search & Embed] Starting for topic ${topicId}: "${query}"`);

    // Search for results
    const results = await webSearch(query);

    if (results.length === 0) {
      console.log("[Search & Embed] No results found");
      return { resultsCount: 0, chunksStored: 0 };
    }

    // Embed and store
    const chunksStored = await embedAndStoreSearchResults(topicId, query, results);

    console.log(
      `[Search & Embed] Complete: ${results.length} results, ${chunksStored} chunks stored`
    );

    return { resultsCount: results.length, chunksStored };
  } catch (error) {
    console.error("[Search & Embed Error]", error);
    throw error;
  }
}

export async function clearSearchHistory(topicId: string): Promise<number> {
  if (!topicId || typeof topicId !== "string") {
    throw new Error("topicId must be a non-empty string");
  }

  try {
    const { count, error } = await supabase
      .from("web_search_chunks")
      .delete()
      .eq("topic_id", topicId);

    if (error) {
      throw error;
    }

    return count || 0;
  } catch (error) {
    console.error("[Clear Search History Error]", error);
    throw error;
  }
}
