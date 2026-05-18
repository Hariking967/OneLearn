import { NextRequest, NextResponse } from "next/server";
import { extractTextFromImage } from "@/lib/ocr/vision";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { imageBase64: string; mimeType: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { imageBase64, mimeType } = body;
  if (!imageBase64 || !mimeType) {
    return NextResponse.json({ error: "imageBase64 and mimeType required" }, { status: 400 });
  }

  try {
    const text = await extractTextFromImage(imageBase64, mimeType);
    return NextResponse.json({ text });
  } catch (err) {
    console.error("[OCR Error]", err);
    return NextResponse.json(
      { error: "OCR failed", details: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
