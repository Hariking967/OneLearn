"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Send, Zap, Loader2, X, ChevronRight, Upload, History, ClipboardList, Search } from "lucide-react";
import { MarkdownContent } from "./MarkdownContent";

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

type DescPhase =
  | { name: "idle" }
  | { name: "settings" }
  | { name: "generating" }
  | { name: "paper"; questions: string[]; difficulty: Difficulty }
  | { name: "evaluating" };

interface TestSession {
  id: string;
  mode: "mcq" | "descriptive";
  difficulty: string;
  questions: unknown; // jsonb — Supabase returns already-parsed object, never a raw string
  score: number | null;
  max_score: number | null;
  created_at: string;
  submitted_at: string | null;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface NodeChatProps {
  topicId: string;
  topicName: string;
  initialMessages?: Message[];
  sessionId?: string;
}

export default function NodeChat({ topicId, topicName, initialMessages = [], sessionId }: NodeChatProps) {
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

  // Descriptive test state machine
  const [desc, setDesc] = useState<DescPhase>({ name: "idle" });
  const [descSettings, setDescSettings] = useState<{ difficulty: Difficulty; numQuestions: number }>({
    difficulty: "medium",
    numQuestions: 3,
  });
  const [descAnswers, setDescAnswers] = useState<Record<number, File | null>>({});
  const [ocrProgress, setOcrProgress] = useState<Record<number, "idle" | "loading" | "done">>({});

  // History panel
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Chat search
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!searchQuery) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, searchQuery]);

  useEffect(() => {
    if (showSearch) searchInputRef.current?.focus();
  }, [showSearch]);

  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter(m => m.content.toLowerCase().includes(q));
  }, [messages, searchQuery]);

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase()
        ? <mark key={i} className="bg-violet-600/40 text-violet-200 rounded px-0.5">{part}</mark>
        : part
    );
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const toolPost = (toolName: string, toolArgs?: Record<string, unknown>) =>
    fetch(`/api/topic/${topicId}/chat/tools`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolName, toolArgs }),
    });

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

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
        body: JSON.stringify({ userMessage: text, sessionId }),
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
      setMessages((prev) => prev.slice(0, -1));
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

  const generateQuiz = async () => {
    setMcq({ name: "loading" });
    setMcqAnswers({});
    try {
      const res = await toolPost("generate_mcq", {
        numQuestions: mcqSettings.numQuestions,
        difficulty: mcqSettings.difficulty,
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

    if (questions.some((q) => mcqAnswers[q.id] === undefined)) {
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
        `Q${idx + 1}: ${q.question}\nMy answer: ${label}) ${q.options[chosen]} ${correct ? "✓" : "✗"}\n` +
        (!correct ? `Correct: ${correctLabel}) ${q.options[q.correctAnswer]}\n` : "")
      );
    });

    // Save to DB (fire-and-forget)
    Promise.all([
      toolPost("save_mcq_result", { score, total: questions.length, wrongAnswers }),
      toolPost("save_test_session", {
        mode: "mcq",
        difficulty,
        questions: questions,
        score,
        maxScore: questions.length,
      }),
    ]).catch(console.error);

    const reviewPrompt =
      `[MCQ Test Results — ${topicName}]\n` +
      `Difficulty: ${difficulty} | Score: ${score}/${questions.length}\n\n` +
      resultLines.join("\n") +
      `\nPlease review my answers, explain my mistakes, and tell me what I should focus on next.`;

    setMcq({ name: "idle" });
    await sendMessage(reviewPrompt);
  };

  // ── Descriptive flow ───────────────────────────────────────────────────────

  const generateDescriptive = async () => {
    setDesc({ name: "generating" });
    setDescAnswers({});
    setOcrProgress({});
    try {
      const res = await fetch(`/api/topic/${topicId}/descriptive/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(descSettings),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Generation failed");
      const { questions } = await res.json();
      setDesc({ name: "paper", questions, difficulty: descSettings.difficulty });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setDesc({ name: "idle" });
    }
  };

  const submitDescriptive = async () => {
    if (desc.name !== "paper") return;
    const { questions, difficulty } = desc;

    for (let i = 0; i < questions.length; i++) {
      if (!descAnswers[i]) {
        setError(`Please upload an answer image for question ${i + 1}.`);
        return;
      }
    }
    setError(null);
    setDesc({ name: "evaluating" });

    const extractedAnswers: string[] = [];
    for (let i = 0; i < questions.length; i++) {
      const file = descAnswers[i]!;
      const base64 = await fileToBase64(file);
      setOcrProgress(p => ({ ...p, [i]: "loading" }));
      try {
        const res = await fetch(`/api/topic/${topicId}/descriptive/ocr`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
        });
        const { text } = await res.json();
        extractedAnswers.push(text || "[Could not read handwriting]");
      } catch {
        extractedAnswers.push("[OCR failed]");
      }
      setOcrProgress(p => ({ ...p, [i]: "done" }));
    }

    // Save test session (fire-and-forget)
    toolPost("save_test_session", {
      mode: "descriptive",
      difficulty,
      questions: questions,
    }).catch(console.error);

    const reviewPrompt =
      `[Descriptive Test Submission — ${topicName}]\nDifficulty: ${difficulty}\n\n` +
      questions.map((q, i) => `Q${i + 1}: ${q}\nMy Answer: ${extractedAnswers[i]}`).join("\n\n") +
      `\n\nPlease evaluate each of my answers:\n` +
      `- Score each out of 10\n- Point out what's correct and what's missing\n` +
      `- Give a total score and overall feedback\n` +
      `- At the very end write: TOTAL: X/${questions.length * 10}`;

    setDesc({ name: "idle" });
    await sendMessage(reviewPrompt);
  };

  // ── History ────────────────────────────────────────────────────────────────

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await toolPost("list_test_sessions");
      const { sessions: data } = await res.json();
      setSessions(data ?? []);
    } catch {}
    setHistoryLoading(false);
  };

  const openHistory = () => {
    setShowHistory(true);
    loadHistory();
  };

  const retakeSession = async (session: TestSession) => {
    // Supabase jsonb columns come back as parsed JS objects, not strings
    let qs: any[];
    if (Array.isArray(session.questions)) {
      qs = session.questions;
    } else if (typeof session.questions === "string") {
      try { qs = JSON.parse(session.questions); } catch { return; }
    } else {
      return;
    }
    if (!qs.length) return;

    if (session.mode === "mcq") {
      setMcq({ name: "quiz", questions: qs, difficulty: session.difficulty as Difficulty, numQuestions: qs.length });
    } else {
      const questions = qs.map((q: any) => (typeof q === "string" ? q : q.question ?? String(q)));
      setDesc({ name: "paper", questions, difficulty: session.difficulty as Difficulty });
    }
    setShowHistory(false);
  };

  // ── Render helpers ─────────────────────────────────────────────────────────

  const inMCQMode = mcq.name !== "idle";
  const inDescMode = desc.name !== "idle";
  const anyOverlay = inMCQMode || inDescMode;

  return (
    <div className="flex flex-col h-full bg-gray-950 relative">

      {/* ── MCQ Overlay ─────────────────────────────────────────────────────── */}
      {inMCQMode && (
        <div className="absolute inset-0 z-10 bg-gray-950 flex flex-col">
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
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {mcq.name === "settings" && (
            <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8 max-w-lg mx-auto w-full">
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-300">Difficulty</label>
                <div className="grid grid-cols-3 gap-3">
                  {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => setMcqSettings(s => ({ ...s, difficulty: d }))}
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

              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-300">
                  Questions: <span className="text-violet-400">{mcqSettings.numQuestions}</span>
                </label>
                <input
                  type="range" min={3} max={15}
                  value={mcqSettings.numQuestions}
                  onChange={e => setMcqSettings(s => ({ ...s, numQuestions: Number(e.target.value) }))}
                  className="w-full accent-violet-600"
                />
                <div className="flex justify-between text-xs text-gray-600"><span>3</span><span>15</span></div>
              </div>

              <button
                onClick={generateQuiz}
                className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium flex items-center justify-center gap-2"
              >
                Generate Quiz <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

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

          {mcq.name === "quiz" && (
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
              <div className="flex items-center justify-between text-xs text-gray-500 px-2">
                <span>{Object.keys(mcqAnswers).length}/{mcq.questions.length} answered</span>
                <span className="capitalize text-violet-400">{mcq.difficulty}</span>
              </div>

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
                          onClick={() => setMcqAnswers(a => ({ ...a, [q.id]: optIdx }))}
                          className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all flex items-center gap-3 ${
                            selected
                              ? "bg-violet-950 border-violet-600 text-violet-100"
                              : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500"
                          }`}
                        >
                          <span className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 ${
                            selected ? "bg-violet-600 border-violet-600 text-white" : "border-gray-600 text-gray-500"
                          }`}>{label}</span>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {error && (
                <div className="px-4 py-3 rounded-xl bg-red-950 border border-red-800 text-red-400 text-sm">{error}</div>
              )}

              <button
                onClick={submitQuiz}
                className="w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold flex items-center justify-center gap-2"
              >
                Submit Answers
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Descriptive Test Overlay ─────────────────────────────────────────── */}
      {inDescMode && (
        <div className="absolute inset-0 z-10 bg-gray-950 flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900 shrink-0">
            <h2 className="font-semibold text-gray-100">
              {desc.name === "settings" && "Descriptive Test Settings"}
              {desc.name === "generating" && "Generating Question Paper…"}
              {desc.name === "paper" && `Question Paper — ${topicName}`}
              {desc.name === "evaluating" && "Processing Answers…"}
            </h2>
            {(desc.name === "settings" || desc.name === "paper") && (
              <button
                onClick={() => { setDesc({ name: "idle" }); setDescAnswers({}); }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {desc.name === "settings" && (
            <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8 max-w-lg mx-auto w-full">
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-300">Difficulty</label>
                <div className="grid grid-cols-3 gap-3">
                  {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDescSettings(s => ({ ...s, difficulty: d }))}
                      className={`py-3 rounded-xl border text-sm font-medium capitalize transition-all ${
                        descSettings.difficulty === d
                          ? "bg-violet-600 border-violet-500 text-white"
                          : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-300">
                  Questions: <span className="text-violet-400">{descSettings.numQuestions}</span>
                </label>
                <input
                  type="range" min={1} max={8}
                  value={descSettings.numQuestions}
                  onChange={e => setDescSettings(s => ({ ...s, numQuestions: Number(e.target.value) }))}
                  className="w-full accent-violet-600"
                />
                <div className="flex justify-between text-xs text-gray-600"><span>1</span><span>8</span></div>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-xs text-gray-500 leading-relaxed">
                <p className="font-medium text-gray-400 mb-1">How it works</p>
                <p>Questions are generated from the topic. Upload a photo of your handwritten answer for each question. The AI will read your handwriting and evaluate your responses.</p>
              </div>

              <button
                onClick={generateDescriptive}
                className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium flex items-center justify-center gap-2"
              >
                Generate Questions <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {(desc.name === "generating" || desc.name === "evaluating") && (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                <span className="text-sm">
                  {desc.name === "generating" ? "Generating questions…" : "Reading your handwriting and evaluating…"}
                </span>
                {desc.name === "evaluating" && Object.keys(ocrProgress).length > 0 && (
                  <div className="mt-2 space-y-1 text-xs text-gray-600">
                    {Object.entries(ocrProgress).map(([i, state]) => (
                      <div key={i} className="flex items-center gap-2">
                        {state === "loading" && <Loader2 className="w-3 h-3 animate-spin text-violet-500" />}
                        {state === "done" && <span className="text-green-500">✓</span>}
                        <span>Q{Number(i) + 1} — {state === "loading" ? "reading…" : "done"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {desc.name === "paper" && (
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
              <p className="text-xs text-gray-500 px-2">
                Write your answers on paper, photograph each one, and upload below.
                <span className="text-violet-400 ml-1">{desc.difficulty} difficulty</span>
              </p>

              {desc.questions.map((q, i) => (
                <div key={i} className="bg-gray-900 rounded-2xl border border-gray-800 p-5 space-y-4">
                  <p className="text-sm font-medium text-gray-100 leading-relaxed">
                    <span className="text-violet-400 mr-2">Q{i + 1}.</span>{q}
                  </p>
                  <label className="block">
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={e => setDescAnswers(a => ({ ...a, [i]: e.target.files?.[0] ?? null }))}
                    />
                    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all text-sm ${
                      descAnswers[i]
                        ? "bg-violet-950 border-violet-700 text-violet-200"
                        : "bg-gray-800 border-gray-700 border-dashed text-gray-500 hover:border-gray-500 hover:text-gray-400"
                    }`}>
                      <Upload className="w-4 h-4 shrink-0" />
                      {descAnswers[i] ? descAnswers[i]!.name : "Upload answer image"}
                    </div>
                  </label>
                </div>
              ))}

              {error && (
                <div className="px-4 py-3 rounded-xl bg-red-950 border border-red-800 text-red-400 text-sm">{error}</div>
              )}

              <button
                onClick={submitDescriptive}
                className="w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold flex items-center justify-center gap-2"
              >
                Submit for AI Evaluation
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── History Side Panel ───────────────────────────────────────────────── */}
      {showHistory && (
        <div className="absolute inset-0 z-20 flex">
          <div className="flex-1" onClick={() => setShowHistory(false)} />
          <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col h-full shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
              <h3 className="font-semibold text-gray-100 text-sm">Test History</h3>
              <button onClick={() => setShowHistory(false)} className="p-1 text-gray-400 hover:text-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {historyLoading && (
                <div className="flex items-center gap-2 text-gray-500 text-sm py-4 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                </div>
              )}
              {!historyLoading && sessions.length === 0 && (
                <p className="text-gray-600 text-sm text-center py-4">No tests taken yet.</p>
              )}
              {sessions.map(session => {
                const date = new Date(session.created_at).toLocaleDateString();
                const scoreText = session.score !== null && session.max_score !== null
                  ? `${session.score}/${session.max_score}`
                  : "Not submitted";
                return (
                  <div key={session.id} className="bg-gray-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${
                          session.mode === "mcq"
                            ? "bg-blue-950 text-blue-400"
                            : "bg-amber-950 text-amber-400"
                        }`}>
                          {session.mode === "mcq" ? "MCQ" : "Descriptive"}
                        </span>
                        <span className="ml-2 text-xs text-gray-500 capitalize">{session.difficulty}</span>
                      </div>
                      <span className="text-xs text-gray-600">{date}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">{scoreText}</span>
                      <button
                        onClick={() => retakeSession(session)}
                        className="px-3 py-1.5 rounded-lg bg-violet-900 hover:bg-violet-800 text-violet-200 text-xs font-medium transition-colors"
                      >
                        Retake
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Search bar ───────────────────────────────────────────────────────── */}
      {showSearch && (
        <div className="px-4 pt-3 pb-1 border-b border-gray-800 bg-gray-900 shrink-0 flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-gray-500 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search messages…"
            className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-600 outline-none"
          />
          {searchQuery && (
            <span className="text-xs text-gray-600 shrink-0">
              {filteredMessages.length} result{filteredMessages.length !== 1 ? "s" : ""}
            </span>
          )}
          <button
            onClick={() => { setShowSearch(false); setSearchQuery(""); }}
            className="text-gray-600 hover:text-gray-300 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Chat messages ────────────────────────────────────────────────────── */}
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
        ) : filteredMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            No messages match "{searchQuery}"
          </div>
        ) : (
          filteredMessages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} ${msg.role === "user" ? "message-enter-user" : "message-enter-ai"}`}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-violet-950 border border-violet-800 flex items-center justify-center mr-2 mt-0.5 shrink-0 animate-node-pulse">
                  <Zap className="w-3.5 h-3.5 text-violet-400" />
                </div>
              )}
              <div
                className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-violet-600 text-white rounded-br-sm whitespace-pre-wrap"
                    : "bg-gray-800 text-gray-100 rounded-bl-sm"
                }`}
              >
                {msg.content ? (
                  msg.role === "assistant" ? (
                    searchQuery
                      ? <span className="whitespace-pre-wrap">{highlightText(msg.content, searchQuery)}</span>
                      : <MarkdownContent content={msg.content} />
                  ) : (
                    searchQuery ? highlightText(msg.content, searchQuery) : msg.content
                  )
                ) : (
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

      {/* Error (chat area, not in overlay) */}
      {error && !anyOverlay && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-red-950 border border-red-800 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* ── Input area ───────────────────────────────────────────────────────── */}
      <div className="border-t border-gray-800 bg-gray-900 px-4 py-3 space-y-2 shrink-0">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setMcq({ name: "settings" })}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs font-medium transition-colors disabled:opacity-40 flex items-center gap-1.5"
          >
            <ClipboardList className="w-3.5 h-3.5" /> Take Quiz
          </button>
          <button
            onClick={() => setDesc({ name: "settings" })}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs font-medium transition-colors disabled:opacity-40 flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" /> Descriptive Test
          </button>
          <button
            onClick={openHistory}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs font-medium transition-colors disabled:opacity-40 flex items-center gap-1.5"
          >
            <History className="w-3.5 h-3.5" /> History
          </button>
          <button
            onClick={() => setShowSearch(s => !s)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5 ${
              showSearch
                ? "bg-violet-950 border-violet-800 text-violet-300"
                : "bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300"
            }`}
          >
            <Search className="w-3.5 h-3.5" /> Search
          </button>
        </div>

        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything… (Enter to send, Shift+Enter for newline)"
            disabled={isLoading}
            className="flex-1 resize-none bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent disabled:opacity-50 leading-relaxed max-h-32"
            onInput={e => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = `${Math.min(t.scrollHeight, 128)}px`;
            }}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="p-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-40 shrink-0"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
