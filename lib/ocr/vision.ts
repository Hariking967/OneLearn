import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Extract handwritten text and math from an image.
 * Tries pix2tex first (if PIX2TEX_API_URL is set), then falls back to Claude Vision.
 */
export async function extractTextFromImage(
  imageBase64: string,
  mimeType: string
): Promise<string> {
  const pix2texUrl = process.env.PIX2TEX_API_URL;
  if (pix2texUrl) {
    try {
      const bytes = Buffer.from(imageBase64, "base64");
      const form = new FormData();
      form.append("file", new Blob([bytes], { type: mimeType }), "image.png");

      const res = await fetch(`${pix2texUrl}/predict`, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const data = await res.json() as { latex?: string };
        if (data.latex?.trim()) return data.latex.trim();
      }
    } catch {
      // pix2tex not available — fall through to Claude Vision
    }
  }

  // Normalise MIME type — phone cameras often produce image/heic which Claude doesn't accept
  const safeMime = (mimeType.startsWith("image/jpeg") || mimeType.startsWith("image/png") || mimeType.startsWith("image/webp") || mimeType.startsWith("image/gif"))
    ? mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif"
    : "image/jpeg";

  const response = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: safeMime, data: imageBase64 },
          },
          {
            type: "text",
            text: `You are an expert handwriting transcription system for student exam answers.

Your task: Transcribe EXACTLY what is written in this handwritten answer image.

Instructions:
1. Read every word carefully — do not skip any content
2. Preserve the student's exact words (do NOT correct spelling, grammar, or content)
3. Preserve paragraph structure and line breaks
4. For numbered/bulleted lists, preserve numbering and indentation
5. For mathematical expressions, convert to LaTeX: inline math → $expression$, display equations → $$expression$$
6. For diagrams or drawings, write [Diagram: brief description]
7. For illegible/unclear parts, write [illegible]
8. Return ONLY the transcribed text — no preamble, no commentary, no "Here is the transcription:"

Transcription:`,
          },
        ],
      },
    ],
  });

  const block = response.content.find(b => b.type === "text");
  return block?.type === "text" ? block.text.trim() : "";
}
