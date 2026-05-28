"use client";

import { useState } from "react";
import { Brain, X, ChevronRight, CheckCircle, XCircle, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReviewCard {
  id: string;
  topicName: string;
  question: string;
  userAnswer: string;
  correctAnswer: string;
}

interface Props {
  projectId: string;
}

type Phase = "idle" | "loading" | "review" | "done";

export function SpacedReviewDialog({ projectId }: Props) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const [unsure, setUnsure] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setPhase("loading");
    setError(null);
    try {
      const res = await fetch(`/api/project/${projectId}/review`);
      if (!res.ok) throw new Error("Failed to load review cards");
      const { cards: data } = await res.json();
      if (!data?.length) {
        setError("No wrong answers to review yet. Take some quizzes first!");
        setPhase("idle");
        return;
      }
      setCards(data);
      setIndex(0);
      setFlipped(false);
      setKnown(0);
      setUnsure(0);
      setPhase("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setPhase("idle");
    }
  };

  const handleOpen = () => {
    setOpen(true);
    load();
  };

  const flip = () => setFlipped(f => !f);

  const next = (gotIt: boolean) => {
    if (gotIt) setKnown(k => k + 1);
    else setUnsure(u => u + 1);

    if (index + 1 >= cards.length) {
      setPhase("done");
    } else {
      setIndex(i => i + 1);
      setFlipped(false);
    }
  };

  const restart = () => {
    setIndex(0);
    setFlipped(false);
    setKnown(0);
    setUnsure(0);
    setPhase("review");
    // Re-shuffle
    setCards(c => {
      const copy = [...c];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    });
  };

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpen}
        className="border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 text-xs gap-1.5"
      >
        <Brain className="w-3.5 h-3.5" />
        Review
      </Button>
    );
  }

  const card = cards[index];
  const total = cards.length;
  const pct = total > 0 ? Math.round((index / total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg mx-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-violet-400" />
            <h2 className="font-semibold text-gray-100 text-sm">Spaced Review</h2>
          </div>
          <button onClick={() => setOpen(false)} className="p-1 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-6 space-y-5">
          {/* Loading */}
          {phase === "loading" && (
            <div className="flex flex-col items-center gap-3 py-8 text-gray-500">
              <Loader2 className="w-7 h-7 animate-spin text-violet-500" />
              <span className="text-sm">Loading your wrong answers…</span>
            </div>
          )}

          {/* Error */}
          {phase === "idle" && error && (
            <div className="text-center py-8 text-gray-500 text-sm">{error}</div>
          )}

          {/* Review card */}
          {phase === "review" && card && (
            <>
              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{index + 1} / {total}</span>
                  <span className="text-violet-400">{card.topicName}</span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>

              {/* Card */}
              <div
                className="bg-gray-800 rounded-2xl border border-gray-700 p-6 min-h-36 cursor-pointer select-none transition-colors hover:border-gray-600"
                onClick={flip}
              >
                {!flipped ? (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Question</p>
                    <p className="text-gray-100 text-sm leading-relaxed">{card.question}</p>
                    <p className="text-xs text-gray-600 mt-4">Tap to reveal answer</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-red-400 uppercase tracking-wider mb-1">Your previous answer</p>
                      <p className="text-gray-400 text-sm line-through">{card.userAnswer}</p>
                    </div>
                    <div>
                      <p className="text-xs text-green-400 uppercase tracking-wider mb-1">Correct answer</p>
                      <p className="text-gray-100 text-sm font-medium leading-relaxed">{card.correctAnswer}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons (only visible after flip) */}
              {flipped && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => next(false)}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl bg-red-950 border border-red-900 text-red-300 text-sm font-medium hover:bg-red-900 transition-colors"
                  >
                    <XCircle className="w-4 h-4" /> Still unsure
                  </button>
                  <button
                    onClick={() => next(true)}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl bg-green-950 border border-green-900 text-green-300 text-sm font-medium hover:bg-green-900 transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" /> Got it!
                  </button>
                </div>
              )}

              {!flipped && (
                <button
                  onClick={flip}
                  className="w-full py-3 rounded-xl bg-gray-800 border border-gray-700 text-gray-400 text-sm hover:text-gray-200 hover:border-gray-600 transition-colors flex items-center justify-center gap-2"
                >
                  Reveal Answer <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </>
          )}

          {/* Done screen */}
          {phase === "done" && (
            <div className="text-center py-6 space-y-5">
              <div className="text-4xl font-bold text-violet-400">
                {Math.round((known / total) * 100)}%
              </div>
              <p className="text-gray-300 text-sm">
                {known} known · {unsure} still unsure out of {total} cards
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={restart}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-gray-300 text-sm hover:bg-gray-700 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" /> Redo all
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm transition-colors"
                >
                  Done <CheckCircle className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
