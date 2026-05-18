"use client";

import { useState } from "react";
import { BookMarked, X, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  projectId: string;
}

export function NotesSummaryDialog({ projectId }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setText("");
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/project/${projectId}/notes-summary`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to generate summary");
      }
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setText(full);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
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
        variant="ghost"
        size="sm"
        onClick={handleOpen}
        className="h-7 px-2 text-gray-500 hover:text-violet-400 hover:bg-gray-800 text-xs gap-1.5"
        title="AI summary of all resources"
      >
        <BookMarked className="w-3.5 h-3.5" />
        Summarise
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            <BookMarked className="w-4 h-4 text-violet-400" />
            <h2 className="font-semibold text-gray-100">Notes Summary</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={generate}
              disabled={loading}
              className="h-7 px-2 text-gray-500 hover:text-gray-200 text-xs gap-1.5"
            >
              {loading
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <RefreshCw className="w-3 h-3" />}
              Regenerate
            </Button>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading && !text && (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Reading your resources and summarising…
            </div>
          )}
          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-950 border border-red-800 text-red-400 text-sm">
              {error}
            </div>
          )}
          {text && (
            <div className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
              {text}
              {loading && <span className="animate-pulse text-violet-400">▌</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
