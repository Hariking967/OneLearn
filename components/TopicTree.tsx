"use client";

import React, { useEffect, useState, useCallback } from "react";

interface Topic {
  id: string;
  name: string;
  level: number;
  parent_id?: string;
  status: "locked" | "unlocked" | "done";
}

interface TreeProps {
  topics: Topic[];
  selectedTopicId?: string;
  onSelectTopic: (topicId: string) => void;
}

export default function TopicTree({ topics, selectedTopicId, onSelectTopic }: TreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const toggleNode = useCallback((topicId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });
  }, []);

  // Find root node
  const root = topics.find((t) => t.level === 0);

  if (!root) {
    return <div className="p-4 text-gray-500">No topics available</div>;
  }

  const renderNode = (topicId: string, depth: number = 0): JSX.Element => {
    const topic = topics.find((t) => t.id === topicId);
    if (!topic) return <></>;

    const children = topics.filter((t) => t.parent_id === topicId);
    const hasChildren = children.length > 0;
    const isExpanded = expandedNodes.has(topicId);
    const isSelected = selectedTopicId === topicId;

    const statusColors = {
      done: "bg-green-100 text-green-900 border-green-300",
      unlocked: "bg-blue-100 text-blue-900 border-blue-300",
      locked: "bg-gray-100 text-gray-600 border-gray-300",
    };

    return (
      <div key={topicId} style={{ marginLeft: `${depth * 20}px` }} className="mb-1">
        <div className="flex items-center gap-2">
          {hasChildren && (
            <button
              onClick={() => toggleNode(topicId)}
              className="w-6 h-6 flex items-center justify-center hover:bg-gray-200 rounded"
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              <span className="text-sm">{isExpanded ? "▼" : "▶"}</span>
            </button>
          )}
          {!hasChildren && <div className="w-6" />}

          <button
            onClick={() => onSelectTopic(topicId)}
            className={`flex-1 px-3 py-2 rounded border text-sm text-left transition ${statusColors[topic.status]} ${
              isSelected ? "ring-2 ring-offset-1 ring-purple-500" : ""
            }`}
            disabled={topic.status === "locked"}
          >
            <span className="font-medium">{topic.name}</span>
            <span className="text-xs ml-2 opacity-75">(L{topic.level})</span>
          </button>
        </div>

        {isExpanded && hasChildren && (
          <div>
            {children.map((child) => renderNode(child.id, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="border rounded-lg p-4 bg-white max-h-96 overflow-y-auto">
      <h2 className="font-bold text-lg mb-3">Learning Path</h2>
      {renderNode(root.id)}
    </div>
  );
}
