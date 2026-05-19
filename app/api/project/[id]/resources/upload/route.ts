import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

interface UploadResponse {
  success: true;
  resource: { id: string; url: string; storage_path: string };
  message: string;
}

interface UploadError {
  error: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<UploadResponse | UploadError>> {
  const { id: projectId } = await params;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "file is required" },
        { status: 400 }
      );
    }

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "application/msword",
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `File type ${file.type} is not supported` },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const fileName = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
    const storagePath = `projects/${projectId}/resources/${fileName}`;

    console.log(`[Upload] Uploading to ${storagePath}`);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("learning-resources")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("learning-resources")
      .getPublicUrl(storagePath);

    // Create resource record
    const { data: resource, error: dbError } = await supabase
      .from("resources")
      .insert({
        project_id: projectId,
        type: file.type.includes("pdf")
          ? "pdf"
          : file.type.includes("word") || file.type.includes("document")
            ? "docx"
            : "text",
        url: urlData.publicUrl,
        storage_path: storagePath,
        ingest_status: "pending",
      })
      .select()
      .single();

    if (dbError) {
      throw dbError;
    }

    // Fire background ingestion without blocking the response
    setImmediate(async () => {
      const adminSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        process.env.SUPABASE_SERVICE_ROLE_KEY || ""
      );
      try {
        await adminSupabase.from("resources").update({ ingest_status: "indexing" }).eq("id", resource.id);
        const { ingestResource } = await import("@/lib/ingest/pipeline");
        await ingestResource(resource);
        await adminSupabase.from("resources").update({ ingest_status: "done", ingested_at: new Date().toISOString() }).eq("id", resource.id);
      } catch (e) {
        console.error("[Auto-ingest failed]", e);
        await adminSupabase.from("resources").update({ ingest_status: "error" }).eq("id", resource.id);
      }
    });

    return NextResponse.json<UploadResponse>({
      success: true,
      resource: {
        id: resource.id,
        url: resource.url,
        storage_path: storagePath,
      },
      message: `Successfully uploaded "${file.name}" to project`,
    });
  } catch (error) {
    console.error("[Upload Error]", error);
    const errorMsg = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json<UploadError>(
      { error: `Upload failed: ${errorMsg}` },
      { status: 500 }
    );
  }
}
