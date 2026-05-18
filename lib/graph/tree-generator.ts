import { deepseekCompletion } from "@/lib/ai/deepseek-client";

export interface TreeNode {
  id: string;
  name: string;
  level: number;
  prerequisites: TreeNode[];
}

export interface GeneratedTree {
  targetTopic: string;
  root: TreeNode;
}

export async function generateTreeFromTopic(
  targetTopic: string
): Promise<GeneratedTree> {
  if (!targetTopic || typeof targetTopic !== "string") {
    throw new Error("targetTopic must be a non-empty string");
  }

  const systemPrompt = `You are an expert in creating prerequisite learning paths for any topic.
When given a topic, generate a complete hierarchical tree of prerequisites where:
- Root node is the target topic (level 0)
- Each level below contains direct prerequisites for the level above
- Leaves have no prerequisites (foundational concepts)
- Each topic gets a unique lowercase slug ID with underscores (e.g., "linear_algebra")
- All node IDs must be unique across the entire tree

Return ONLY valid JSON, no markdown, no explanation, no code blocks.`;

  const userPrompt = `Generate a prerequisite tree for: "${targetTopic}"

Return this exact JSON structure:
{
  "targetTopic": "string (exact same as input)",
  "root": {
    "id": "unique_lowercase_slug",
    "name": "Exact Topic Name",
    "level": 0,
    "prerequisites": [
      {
        "id": "prereq_slug",
        "name": "Prerequisite Name",
        "level": 1,
        "prerequisites": [
          {
            "id": "base_slug",
            "name": "Base Concept",
            "level": 2,
            "prerequisites": []
          }
        ]
      }
    ]
  }
}

Requirements:
- Root must be level 0
- Each child must have level = parent.level + 1
- All prerequisite IDs must be unique and use only lowercase a-z, numbers, and underscores
- Maximum 4 levels deep (0-3)
- Each node can have 1-5 children max
- Prerequisites array must be present even if empty (for leaves)
- Names must be clear, specific topic names`;

  try {
    const response = await deepseekCompletion({
      messages: [{ role: "user", content: userPrompt }],
      systemPrompt,
      temperature: 0.5,
      maxTokens: 3000,
    });

    // Extract JSON from response (handle wrapped responses)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(
        `No valid JSON found in response. Response was: ${response.substring(0, 200)}`
      );
    }

    let tree: GeneratedTree;
    try {
      tree = JSON.parse(jsonMatch[0]);
    } catch (e) {
      throw new Error(`Failed to parse JSON: ${(e as Error).message}`);
    }

    // Validate tree structure
    validateTree(tree);

    return tree;
  } catch (error) {
    console.error("Tree generation error:", error);
    throw error;
  }
}

function validateTree(tree: any): asserts tree is GeneratedTree {
  if (!tree || typeof tree !== "object") {
    throw new Error("Tree must be an object");
  }

  if (!tree.targetTopic || typeof tree.targetTopic !== "string") {
    throw new Error("Tree must have a targetTopic string");
  }

  if (!tree.root || typeof tree.root !== "object") {
    throw new Error("Tree must have a root node");
  }

  const ids = new Set<string>();

  function validateNode(node: any, expectedLevel: number): asserts node is TreeNode {
    // Check required fields
    if (!node || typeof node !== "object") {
      throw new Error("Node must be an object");
    }

    if (!node.id || typeof node.id !== "string") {
      throw new Error(`Node missing or invalid id. Node: ${JSON.stringify(node).substring(0, 100)}`);
    }

    if (!node.name || typeof node.name !== "string") {
      throw new Error(`Node ${node.id} missing or invalid name`);
    }

    if (typeof node.level !== "number") {
      throw new Error(`Node ${node.id} missing or invalid level`);
    }

    if (!Array.isArray(node.prerequisites)) {
      throw new Error(`Node ${node.id} prerequisites must be an array`);
    }

    // Check constraints
    if (node.level !== expectedLevel) {
      throw new Error(
        `Invalid level for ${node.name}: expected ${expectedLevel}, got ${node.level}`
      );
    }

    if (node.level > 3) {
      throw new Error(`Tree too deep at ${node.name}. Max depth is 4 levels (0-3).`);
    }

    if (ids.has(node.id)) {
      throw new Error(`Duplicate node id: ${node.id}`);
    }
    ids.add(node.id);

    // Validate ID format
    if (!/^[a-z0-9_]+$/.test(node.id)) {
      throw new Error(
        `Node id "${node.id}" must contain only lowercase letters, numbers, and underscores`
      );
    }

    // Check prerequisites count
    if (node.prerequisites.length > 5) {
      throw new Error(
        `Node ${node.id} has too many prerequisites (${node.prerequisites.length}, max 5)`
      );
    }

    // Validate children
    for (const child of node.prerequisites) {
      validateNode(child, node.level + 1);
    }
  }

  validateNode(tree.root, 0);
}

export function flattenTree(root: TreeNode): TreeNode[] {
  const nodes: TreeNode[] = [];

  function traverse(node: TreeNode) {
    nodes.push({
      ...node,
      prerequisites: [], // Don't include prerequisites in flattened version
    });

    for (const child of node.prerequisites) {
      traverse(child);
    }
  }

  traverse(root);
  return nodes;
}

export function getTreeStats(root: TreeNode): {
  totalNodes: number;
  maxDepth: number;
  nodesByLevel: Record<number, number>;
} {
  let maxDepth = 0;
  const nodesByLevel: Record<number, number> = {};

  function traverse(node: TreeNode) {
    nodesByLevel[node.level] = (nodesByLevel[node.level] || 0) + 1;
    maxDepth = Math.max(maxDepth, node.level);

    for (const child of node.prerequisites) {
      traverse(child);
    }
  }

  traverse(root);

  return {
    totalNodes: flattenTree(root).length,
    maxDepth,
    nodesByLevel,
  };
}
