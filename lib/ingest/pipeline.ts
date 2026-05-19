import { createClient } from "@supabase/supabase-js";
import { chunkText } from "@/lib/rag/chunker";
import { getEmbeddings } from "@/lib/rag/embedder";
import { extractFromNote, extractFromUrl } from "./extractors/text";
import { extractFromPdf } from "./extractors/pdf";
import { extractFromYoutube } from "./extractors/youtube";
import type { Resource } from "@/lib/supabase/types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function ingestResource(resource: Resource): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("[Ingest] OPENAI_API_KEY not set — RAG ingestion disabled. Add OPENAI_API_KEY to .env.local to enable resource indexing.");
    return;
  }

  console.log(`[Ingest] Starting resource ${resource.id} type=${resource.type}`);

  let text = "";

  try {
    if (resource.type === "note" && resource.url) {
      text = await extractFromNote(resource.url);
    } else if (resource.type === "youtube" && resource.url) {
      text = await extractFromYoutube(resource.url);
    } else if (resource.type === "url" && resource.url) {
      text = await extractFromUrl(resource.url);
    } else if ((resource.type === "pdf" || resource.type === "docx") && resource.storage_path) {
      const { data, error } = await supabase.storage
        .from("learning-resources")
        .download(resource.storage_path);
      if (error || !data) throw new Error(`Storage download failed: ${error?.message}`);
      const buffer = await data.arrayBuffer();
      if (resource.type === "pdf") {
        text = await extractFromPdf(buffer);
      } else {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const mammoth = require("mammoth");
          const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
          text = result.value;
        } catch {
          text = Buffer.from(buffer).toString("utf-8").replace(/[^\x20-\x7E\n]/g, " ");
        }
      }
    }
  } catch (err) {
    console.error(`[Ingest] Text extraction failed for ${resource.id}:`, err);
    return;
  }

  if (!text || text.length < 50) {
    console.warn(`[Ingest] No usable text extracted from resource ${resource.id}`);
    return;
  }

  const chunks = chunkText(text, 400, 60);
  if (chunks.length === 0) return;

  // Embed in batches of 20
  const BATCH = 20;
  const allEmbeddings: number[][] = [];
  for (let i = 0; i < chunks.length; i += BATCH) {
    const embeddings = await getEmbeddings(chunks.slice(i, i + BATCH));
    allEmbeddings.push(...embeddings);
  }

  // Replace old chunks for this resource
  await supabase.from("resource_chunks").delete().eq("resource_id", resource.id);

  const rows = chunks.map((content, idx) => ({
    project_id: resource.project_id,
    resource_id: resource.id,
    chunk_index: idx,
    content,
    embedding: allEmbeddings[idx],
  }));

  const { error } = await supabase.from("resource_chunks").insert(rows);
  if (error) throw new Error(`Chunk insert failed: ${error.message}`);

  await supabase
    .from("resources")
    .update({ ingested_at: new Date().toISOString() })
    .eq("id", resource.id);

  console.log(`[Ingest] Done: ${chunks.length} chunks for resource ${resource.id}`);
}
