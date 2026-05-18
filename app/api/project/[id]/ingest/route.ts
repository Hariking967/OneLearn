import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ingestResource } from "@/lib/ingest/pipeline";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { resourceId } = await request.json();
  if (!resourceId) return NextResponse.json({ error: "resourceId required" }, { status: 400 });

  const { data: resource, error } = await supabase
    .from("resources")
    .select("*")
    .eq("id", resourceId)
    .eq("project_id", projectId)
    .single();

  if (error || !resource) return NextResponse.json({ error: "Resource not found" }, { status: 404 });

  // Fire-and-forget — client doesn't wait for ingestion to complete
  ingestResource(resource as any).catch(console.error);

  return NextResponse.json({ status: "ingestion_started" });
}
