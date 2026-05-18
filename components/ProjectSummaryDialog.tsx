"use client";

import { useState } from "react";
import { FileText, X, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  projectId: string;
  projectName: string;
  onProgressScore?: (score: number) => void;
}

export function ProjectSummaryDialog({ projectId, projectName, onProgressScore }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setText("");
    setLoading(true);
    try {
      const res = await fetch(`/api/project/${projectId}/summary`);
      if (!res.ok || !res.body) throw new Error("Failed to generate summary");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setText(full);
      }

      const match = full.match(/PROGRESS_SCORE:\s*(\d+)/);
      if (match && onProgressScore) onProgressScore(Number(match[1]));
    } catch {
      setText("Failed to generate summary. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    generate();
  };

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpen}
        className="border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 text-xs"
      >
        <FileText className="w-3.5 h-3.5 mr-1.5" />
        Project Summary
      </Button>
    );
  }

  const displayText = text.replace(/\n*PROGRESS_SCORE:\s*\d+\s*$/, "").trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <h2 className="font-semibold text-gray-100">Project Summary — {projectName}</h2>
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading && !displayText && (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Generating summary…
            </div>
          )}
          {displayText && (
            <div className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
              {displayText}
              {loading && <span className="animate-pulse text-violet-400">▌</span>}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-800 flex justify-end shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={generate}
            disabled={loading}
            className="border-gray-700 bg-gray-800 text-gray-300 text-xs gap-1.5"
          >
            {loading
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <RefreshCw className="w-3 h-3" />}
            Regenerate
          </Button>
        </div>
      </div>
    </div>
  );
}
