import { createClient } from "@supabase/supabase-js";
import type { TreeNode } from "./tree-generator";
import { flattenTree } from "./tree-generator";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

interface TopicRow {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  parent_id?: string | null;
  level: number;
  status: "locked" | "unlocked" | "done";
  created_at?: string;
}

export async function storeTreeInDatabase(
  projectId: string,
  rootNode: TreeNode,
  targetTopicDescription?: string
): Promise<{ topicIds: Record<string, string>; totalInserted: number }> {
  if (!projectId || typeof projectId !== "string") {
    throw new Error("projectId must be a non-empty string");
  }

  if (!rootNode || typeof rootNode !== "object") {
    throw new Error("rootNode must be a valid TreeNode object");
  }

  try {
    // Build mapping of logical IDs to database IDs
    const idMapping: Record<string, string> = {};
    const topicsToInsert: TopicRow[] = [];
    const flatNodes = flattenTree(rootNode);

    // Create database IDs (UUID-like but deterministic based on project + logical ID)
    function generateDatabaseId(projectId: string, logicalId: string): string {
      // Simple deterministic ID generation
      return `${projectId.substring(0, 8)}-${logicalId.substring(0, 8)}-${Math.random().toString(36).substring(2, 8)}`;
    }

    // First pass: create ID mappings
    for (const node of flatNodes) {
      idMapping[node.id] = generateDatabaseId(projectId, node.id);
    }

    // Second pass: build topic rows with parent references
    for (const node of flatNodes) {
      let parentId: string | null = null;

      // Find parent by looking for a node that has this node in its prerequisites
      for (const potentialParent of flatNodes) {
        if (
          potentialParent.prerequisites.some((child) => child.id === node.id)
        ) {
          parentId = idMapping[potentialParent.id];
          break;
        }
      }

      topicsToInsert.push({
        id: idMapping[node.id],
        project_id: projectId,
        name: node.name,
        description:
          node.level === 0 ? targetTopicDescription : undefined,
        parent_id: parentId,
        level: node.level,
        status: parentId ? "locked" : "unlocked", // Root starts unlocked
      });
    }

    if (topicsToInsert.length === 0) {
      throw new Error("No topics to insert");
    }

    // Delete existing topics for this project (full replacement)
    const { error: deleteError } = await supabase
      .from("topics")
      .delete()
      .eq("project_id", projectId);

    if (deleteError) {
      throw new Error(`Failed to delete existing topics: ${deleteError.message}`);
    }

    // Insert all topics in a single batch
    const { data: insertedTopics, error: insertError } = await supabase
      .from("topics")
      .insert(topicsToInsert)
      .select();

    if (insertError) {
      throw new Error(`Failed to insert topics: ${insertError.message}`);
    }

    if (!insertedTopics || insertedTopics.length === 0) {
      throw new Error("No topics were inserted");
    }

    // Verify all topics were inserted
    if (insertedTopics.length !== topicsToInsert.length) {
      console.warn(
        `Expected ${topicsToInsert.length} topics but got ${insertedTopics.length}`
      );
    }

    return {
      topicIds: idMapping,
      totalInserted: insertedTopics.length,
    };
  } catch (error) {
    console.error("Tree storage error:", error);
    throw error;
  }
}

export async function getTopicTree(projectId: string): Promise<TreeNode | null> {
  if (!projectId || typeof projectId !== "string") {
    throw new Error("projectId must be a non-empty string");
  }

  try {
    const { data: topics, error } = await supabase
      .from("topics")
      .select("*")
      .eq("project_id", projectId)
      .order("level", { ascending: true });

    if (error) {
      throw error;
    }

    if (!topics || topics.length === 0) {
      return null;
    }

    const topicList = topics

    // Find root node
    const root = topicList.find((t) => t.level === 0);
    if (!root) {
      throw new Error("No root topic found");
    }

    // Build tree structure
    function buildTree(topicId: string): TreeNode {
      const topic = topicList.find((t) => t.id === topicId);
      if (!topic) {
        throw new Error(`Topic ${topicId} not found`);
      }

      const children = topicList.filter((t) => t.parent_id === topicId);

      return {
        id: topic.id,
        name: topic.name,
        level: topic.level,
        prerequisites: children.map((child) => buildTree(child.id)),
      };
    }

    return buildTree(root.id);
  } catch (error) {
    console.error("Error fetching topic tree:", error);
    throw error;
  }
}

export async function deleteProjectTree(projectId: string): Promise<number> {
  if (!projectId || typeof projectId !== "string") {
    throw new Error("projectId must be a non-empty string");
  }

  try {
    const { count, error } = await supabase
      .from("topics")
      .delete()
      .eq("project_id", projectId);

    if (error) {
      throw error;
    }

    return count || 0;
  } catch (error) {
    console.error("Error deleting project tree:", error);
    throw error;
  }
}
