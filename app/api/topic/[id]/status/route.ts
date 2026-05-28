import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const serviceSupabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: topicId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { status } = await request.json();
  if (!["locked", "unlocked", "done"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { error } = await serviceSupabase
    .from("topics")
    .update({ status })
    .eq("id", topicId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // When marking done, auto-unlock any child topics that now have ALL parents done
  if (status === "done") {
    const { data: childEdges } = await serviceSupabase
      .from("topic_edges")
      .select("child_id")
      .eq("parent_id", topicId);

    if (childEdges?.length) {
      for (const edge of childEdges) {
        // Get all parents of this child
        const { data: parentEdges } = await serviceSupabase
          .from("topic_edges")
          .select("parent_id")
          .eq("child_id", edge.child_id);

        if (!parentEdges?.length) continue;

        const parentIds = parentEdges.map((e: any) => e.parent_id);
        const { data: parents } = await serviceSupabase
          .from("topics")
          .select("id, status")
          .in("id", parentIds);

        const allParentsDone = parents?.every((p: any) => p.status === "done");
        if (allParentsDone) {
          await serviceSupabase
            .from("topics")
            .update({ status: "unlocked" })
            .eq("id", edge.child_id)
            .eq("status", "locked"); // only unlock if currently locked
        }
      }
    }
  }

  return NextResponse.json({ success: true });
}
