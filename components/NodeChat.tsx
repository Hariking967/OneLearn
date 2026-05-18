"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Zap, Loader2, X, ChevronRight } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface MCQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

type Difficulty = "easy" | "medium" | "hard";

type MCQPhase =
  | { name: "idle" }
  | { name: "settings" }
  | { name: "loading" }
  | { name: "quiz"; questions: MCQuestion[]; difficulty: Difficulty; numQuestions: number }
  | { name: "submitting" };

// ─── Component ───────────────────────────────────────────────────────────────

interface NodeChatProps {
  topicId: string;
  topicName: string;
  initialMessages?: Message[];
}

export default function NodeChat({ topicId, topicName, initialMessages = [] }: NodeChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // MCQ state machine
  const [mcq, setMcq] = useState<MCQPhase>({ name: "idle" });
  const [mcqSettings, setMcqSettings] = useState<{ difficulty: Difficulty; numQuestions: number }>({
    difficulty: "medium",
    numQuestions: 5,
  });
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, number>>({});

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Chat send ──────────────────────────────────────────────────────────────

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/topic/${topicId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userMessage: text }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.details || err.error || "Chat request failed");
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: assistantText };
          return updated;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setMessages((prev) => prev.slice(0, -1)); // remove the optimistic user message
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSend = () => {
    const text = input.trim();
    setInput("");
    sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── MCQ flow ───────────────────────────────────────────────────────────────

  const startMCQ = () => setMcq({ name: "settings" });

  const generateQuiz = async () => {
    setMcq({ name: "loading" });
    setMcqAnswers({});
    try {
      const res = await fetch(`/api/topic/${topicId}/chat/tools`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolName: "generate_mcq",
          toolArgs: { numQuestions: mcqSettings.numQuestions, difficulty: mcqSettings.difficulty },
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.details || err.error || "Failed to generate quiz");
      }
      const { questions } = await res.json();
      setMcq({ name: "quiz", questions, difficulty: mcqSettings.difficulty, numQuestions: mcqSettings.numQuestions });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Quiz generation failed");
      setMcq({ name: "idle" });
    }
  };

  const submitQuiz = async () => {
    if (mcq.name !== "quiz") return;
    const { questions, difficulty } = mcq;

    const answered = questions.filter((q) => mcqAnswers[q.id] !== undefined);
    if (answered.length < questions.length) {
      setError("Please answer all questions before submitting.");
      return;
    }

    setError(null);
    setMcq({ name: "submitting" });

    let score = 0;
    const wrongAnswers: Array<{ question: string; userAnswer: string; correctAnswer: string }> = [];
    const resultLines: string[] = [];

    questions.forEach((q, idx) => {
      const chosen = mcqAnswers[q.id];
      const correct = chosen === q.correctAnswer;
      if (correct) score++;
      else {
        wrongAnswers.push({
          question: q.question,
          userAnswer: q.options[chosen],
          correctAnswer: q.options[q.correctAnswer],
        });
      }
      const label = ["A", "B", "C", "D"][chosen];
      const correctLabel = ["A", "B", "C", "D"][q.correctAnswer];
      resultLines.push(
        `Q${idx + 1}: ${q.question}\n` +
        `My answer: ${label}) ${q.options[chosen]} ${correct ? "✓" : "✗"}\n` +
        (!correct ? `Correct: ${correctLabel}) ${q.options[q.correctAnswer]}\n` : "")
      );
    });

    // Save result to DB (fire-and-forget)
    fetch(`/api/topic/${topicId}/chat/tools`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toolName: "save_mcq_result",
        toolArgs: { score, total: questions.length, wrongAnswers },
      }),
    }).catch(console.error);

    // Send results to chat for LLM review
    const reviewPrompt =
      `[MCQ Test Results — ${topicName}]\n` +
      `Difficulty: ${difficulty} | Score: ${score}/${questions.length}\n\n` +
      resultLines.join("\n") +
      `\nPlease review my answers, explain my mistakes, and tell me what I should focus on next.`;

    setMcq({ name: "idle" });
    await sendMessage(reviewPrompt);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const inQuizMode = mcq.name === "settings" || mcq.name === "loading" || mcq.name === "quiz" || mcq.name === "submitting";

  return (
    <div className="flex flex-col h-full bg-gray-950 relative">

      {/* MCQ Overlay */}
      {inQuizMode && (
        <div className="absolute inset-0 z-10 bg-gray-950 flex flex-col">
          {/* Overlay header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900 shrink-0">
            <h2 className="font-semibold text-gray-100">
              {mcq.name === "settings" && "Quiz Settings"}
              {mcq.name === "loading" && "Generating Quiz…"}
              {mcq.name === "quiz" && `Quiz — ${topicName}`}
              {mcq.name === "submitting" && "Submitting…"}
            </h2>
            {(mcq.name === "settings" || mcq.name === "quiz") && (
              <button
                onClick={() => { setMcq({ name: "idle" }); setMcqAnswers({}); }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Settings form */}
          {mcq.name === "settings" && (
            <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8 max-w-lg mx-auto w-full">
              {/* Difficulty */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-300">Difficulty</label>
                <div className="grid grid-cols-3 gap-3">
                  {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => setMcqSettings((s) => ({ ...s, difficulty: d }))}
                      className={`py-3 rounded-xl border text-sm font-medium capitalize transition-all ${
                        mcqSettings.difficulty === d
                          ? "bg-violet-600 border-violet-500 text-white"
                          : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Number of questions */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-300">
                  Number of questions: <span className="text-violet-400">{mcqSettings.numQuestions}</span>
                </label>
                <input
                  type="range"
                  min={3}
                  max={15}
                  value={mcqSettings.numQuestions}
                  onChange={(e) => setMcqSettings((s) => ({ ...s, numQuestions: Number(e.target.value) }))}
                  className="w-full accent-violet-600"
                />
                <div className="flex justify-between text-xs text-gray-600">
                  <span>3</span><span>15</span>
                </div>
              </div>

              <button
                onClick={generateQuiz}
                className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium flex items-center justify-center gap-2 transition-colors"
              >
                Generate Quiz <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Loading */}
          {(mcq.name === "loading" || mcq.name === "submitting") && (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                <span className="text-sm">
                  {mcq.name === "loading" ? "Generating questions…" : "Sending results for review…"}
                </span>
              </div>
            </div>
          )}

          {/* Quiz questions */}
          {mcq.name === "quiz" && (
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
              {/* Progress */}
              <div className="flex items-center justify-between text-xs text-gray-500 px-2">
                <span>{Object.keys(mcqAnswers).length}/{mcq.questions.length} answered</span>
                <span className="capitalize text-violet-400">{mcq.difficulty}</span>
              </div>

              {/* Questions */}
              {mcq.questions.map((q, qIdx) => (
                <div key={q.id} className="bg-gray-900 rounded-2xl border border-gray-800 p-5 space-y-4">
                  <p className="text-sm font-medium text-gray-100 leading-relaxed">
                    <span className="text-violet-400 mr-2">Q{qIdx + 1}.</span>{q.question}
                  </p>
                  <div className="space-y-2">
                    {q.options.map((opt, optIdx) => {
                      const label = ["A", "B", "C", "D"][optIdx];
                      const selected = mcqAnswers[q.id] === optIdx;
                      return (
                        <button
                          key={optIdx}
                          onClick={() => setMcqAnswers((a) => ({ ...a, [q.id]: optIdx }))}
                          className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all flex items-center gap-3 ${
                            selected
                              ? "bg-violet-950 border-violet-600 text-violet-100"
                              : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500"
                          }`}
                        >
                          <span className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 ${
                            selected ? "bg-violet-600 border-violet-600 text-white" : "border-gray-600 text-gray-500"
                          }`}>
                            {label}
                          </span>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Error */}
              {error && (
                <div className="px-4 py-3 rounded-xl bg-red-950 border border-red-800 text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                onClick={submitQuiz}
                className="w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                Submit Answers
              </button>
            </div>
          )}
        </div>
      )}

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
            <div className="w-12 h-12 rounded-full bg-violet-950 border border-violet-800 flex items-center justify-center">
              <Zap className="w-5 h-5 text-violet-400" />
            </div>
            <p className="text-sm text-center">
              {initialMessages.length === 0
                ? <><span className="text-violet-400 font-medium">{topicName}</span> — ask anything to start</>
                : <>Welcome back — continue learning <span className="text-violet-400 font-medium">{topicName}</span></>
              }
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-violet-950 border border-violet-800 flex items-center justify-center mr-2 mt-0.5 shrink-0">
                  <Zap className="w-3.5 h-3.5 text-violet-400" />
                </div>
              )}
              <div
                className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-violet-600 text-white rounded-br-sm"
                    : "bg-gray-800 text-gray-100 rounded-bl-sm"
                }`}
              >
                {msg.content || (
                  <span className="inline-flex gap-1 items-center py-0.5">
                    <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </span>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error (chat area) */}
      {error && mcq.name === "idle" && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-red-950 border border-red-800 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-gray-800 bg-gray-900 px-4 py-3 space-y-2 shrink-0">
        <div className="flex gap-2">
          <button
            onClick={startMCQ}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Take Quiz
          </button>
        </div>
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything… (Enter to send, Shift+Enter for newline)"
            disabled={isLoading}
            className="flex-1 resize-none bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent disabled:opacity-50 leading-relaxed max-h-32"
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = `${Math.min(t.scrollHeight, 128)}px`;
            }}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="p-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
