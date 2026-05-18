"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import TopicTree from "@/components/TopicTree";
import NodeChat from "@/components/NodeChat";

interface Topic {
  id: string;
  name: string;
  level: number;
  parent_id?: string;
  status: "locked" | "unlocked" | "done";
}

export default function ProjectLearnPage() {
  const { id } = useParams();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/project/${id}/generate-tree`);

        if (!response.ok) {
          if (response.status === 404) {
            setError("No learning tree found. Create one first.");
          } else {
            setError("Failed to load topics");
          }
          return;
        }

        const data = await response.json();

        if (data.topics && Array.isArray(data.topics)) {
          setTopics(data.topics);

          // Select root topic by default
          const rootTopic = data.topics.find((t: Topic) => t.level === 0);
          if (rootTopic) {
            setSelectedTopic(rootTopic);
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        setError(`Error loading topics: ${errorMsg}`);
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchTopics();
    }
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading your learning path...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center text-red-600">
          <p className="text-xl font-semibold mb-2">⚠️ Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar: Tree */}
      <div className="w-1/4 border-r border-gray-300 bg-white p-4 overflow-y-auto">
        <h1 className="text-2xl font-bold mb-4">Learning Path</h1>
        <TopicTree
          topics={topics}
          selectedTopicId={selectedTopic?.id}
          onSelectTopic={(topicId) => {
            const topic = topics.find((t) => t.id === topicId);
            if (topic) {
              setSelectedTopic(topic);
            }
          }}
        />
      </div>

      {/* Main: Chat */}
      <div className="flex-1 p-4">
        {selectedTopic ? (
          <NodeChat topicId={selectedTopic.id} topicName={selectedTopic.name} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>Select a topic to start learning</p>
          </div>
        )}
      </div>
    </div>
  );
}
