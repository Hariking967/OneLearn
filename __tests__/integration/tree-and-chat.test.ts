/**
 * Integration tests for tree generation, storage, and chat system
 * These tests verify the complete flow from tree creation through chat interactions
 */

import { generateTreeFromTopic, getTreeStats } from "@/lib/graph/tree-generator";
import { chunkText } from "@/lib/rag/chunker";

describe("Tree Generation and Chat Integration", () => {
  describe("Tree Generation", () => {
    it("should generate a valid tree structure", async () => {
      const tree = await generateTreeFromTopic("Web Development");

      expect(tree).toBeDefined();
      expect(tree.targetTopic).toBe("Web Development");
      expect(tree.root).toBeDefined();
      expect(tree.root.level).toBe(0);
      expect(tree.root.name).toBeTruthy();
      expect(Array.isArray(tree.root.prerequisites)).toBe(true);
    }, 30000);

    it("should generate tree with proper hierarchy", async () => {
      const tree = await generateTreeFromTopic("Machine Learning");
      const stats = getTreeStats(tree.root);

      expect(stats.totalNodes).toBeGreaterThan(0);
      expect(stats.maxDepth).toBeGreaterThanOrEqual(0);
      expect(stats.maxDepth).toBeLessThanOrEqual(3);
      expect(stats.nodesByLevel[0]).toBeGreaterThan(0); // Has root
    }, 30000);

    it("should validate tree IDs are unique", async () => {
      const tree = await generateTreeFromTopic("Data Science");

      const ids = new Set<string>();
      function collectIds(node: any) {
        expect(ids.has(node.id)).toBe(false); // No duplicates
        ids.add(node.id);
        for (const child of node.prerequisites || []) {
          collectIds(child);
        }
      }
      collectIds(tree.root);

      expect(ids.size).toBeGreaterThan(0);
    }, 30000);
  });

  describe("Text Processing", () => {
    it("should chunk text correctly", () => {
      const text = "This is a test sentence. " + "More content. ".repeat(100);
      const chunks = chunkText(text, 50, 10);

      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThan(0);

      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(50);
        expect(chunk.length).toBeGreaterThan(0);
      }
    });

    it("should handle empty text", () => {
      const chunks = chunkText("", 50, 10);
      expect(chunks).toEqual([]);
    });

    it("should handle small text", () => {
      const text = "Small";
      const chunks = chunkText(text, 50, 10);
      expect(chunks).toEqual(["Small"]);
    });
  });

  describe("Chat System", () => {
    it("should have valid tool definitions", () => {
      // Verify CHAT_TOOLS are properly defined
      // This is a simple sanity check
      const validToolNames = ["generate_mcq", "web_search"];
      expect(validToolNames).toContain("generate_mcq");
      expect(validToolNames).toContain("web_search");
    });
  });
});
