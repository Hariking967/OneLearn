import { NextRequest, NextResponse } from "next/server";
import { generateTreeFromTopic, getTreeStats } from "@/lib/graph/tree-generator";
import { storeTreeInDatabase } from "@/lib/graph/tree-store";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

interface RequestBody {
  targetTopic: string;
  description?: string;
}

interface SuccessResponse {
  success: true;
  projectId: string;
  targetTopic: string;
  stats: {
    totalNodes: number;
    maxDepth: number;
    nodesByLevel: Record<number, number>;
  };
  message: string;
}

interface ErrorResponse {
  error: string;
  details?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  const { id: projectId } = await params;

  try {
    // Validate project exists and belongs to user
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, user_id, name")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Parse request body
    let body: RequestBody;
    try {
      body = (await request.json()) as RequestBody;
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const { targetTopic, description } = body;

    // Validate input
    if (!targetTopic || typeof targetTopic !== "string" || targetTopic.trim().length === 0) {
      return NextResponse.json(
        { error: "targetTopic is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    // Generate tree
    console.log(`[Tree Generation] Starting for project ${projectId}: ${targetTopic}`);
    const tree = await generateTreeFromTopic(targetTopic);

    // Get statistics
    const stats = getTreeStats(tree.root);
    console.log(
      `[Tree Generation] Generated tree with ${stats.totalNodes} nodes, max depth ${stats.maxDepth}`
    );

    // Store in database
    console.log(`[Tree Storage] Storing tree for project ${projectId}`);
    const { totalInserted } = await storeTreeInDatabase(
      projectId,
      tree.root,
      description
    );

    return NextResponse.json<SuccessResponse>({
      success: true,
      projectId,
      targetTopic: tree.targetTopic,
      stats,
      message: `Successfully generated and stored tree for "${targetTopic}" with ${totalInserted} topics`,
    });
  } catch (error) {
    console.error("[Tree Generation Error]", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json<ErrorResponse>(
      {
        error: "Failed to generate tree",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check tree status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: projectId } = await params;

  try {
    const { data: topics, error } = await supabase
      .from("topics")
      .select("id, name, level, parent_id, status")
      .eq("project_id", projectId)
      .order("level", { ascending: true });

    if (error) {
      throw error;
    }

    if (!topics || topics.length === 0) {
      return NextResponse.json(
        { message: "No topics found for this project" },
        { status: 404 }
      );
    }

    const stats = {
      totalTopics: topics.length,
      levels: [...new Set(topics.map((t) => t.level))].sort(),
      statuses: topics.reduce(
        (acc, t) => {
          acc[t.status] = (acc[t.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
    };

    return NextResponse.json({
      projectId,
      topics,
      stats,
    });
  } catch (error) {
    console.error("[Tree Status Error]", error);
    return NextResponse.json(
      { error: "Failed to fetch tree status" },
      { status: 500 }
    );
  }
}
