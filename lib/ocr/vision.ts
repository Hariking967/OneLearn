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

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: imageBase64 },
          },
          {
            type: "text",
            text: "Extract ALL text and mathematical notation from this handwritten answer image. Preserve the structure. Use LaTeX notation for any formulas (wrap in $ or $$). Return ONLY the extracted content, nothing else.",
          },
        ],
      },
    ],
  });

  const block = response.content.find(b => b.type === "text");
  return block?.type === "text" ? block.text.trim() : "";
}
