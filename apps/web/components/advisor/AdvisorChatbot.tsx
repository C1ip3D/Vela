"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Send, User, Sparkles, Telescope } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface CourseContext {
  name: string;
  grade: number;
  letterGrade: string;
  missingCount: number;
  courseType: string;
}

interface StudentProfile {
  name: string;
  gradeLevel: number;
  courses: CourseContext[];
}

interface PathwayData {
  pathway?: string;
  pathwayConfidence?: number;
  rigorLevel?: string;
  notes?: string;
}

interface Props {
  courses: CourseContext[];
  studentName: string;
  gradeLevel: number;
  onPathwayUpdate?: (data: PathwayData) => void;
}

const SUGGESTIONS = [
  "What career paths should I consider?",
  "Am I ready for more AP courses?",
  "How do I strengthen my college app?",
  "What should I focus on this semester?",
];

function renderMarkdown(text: string) {
  return text.split("\n").map((line, i, arr) => (
    <span key={i}>
      {line.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
        part.startsWith("**") && part.endsWith("**")
          ? <strong key={j} className="text-[#E8ECFF] font-semibold">{part.slice(2, -2)}</strong>
          : <span key={j}>{part}</span>
      )}
      {i < arr.length - 1 && <br />}
    </span>
  ));
}

export function AdvisorChatbot({ courses, studentName, gradeLevel, onPathwayUpdate }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Hi ${studentName}! I'm **Kepler**, your AI academic advisor ✦\n\nI'm here to help you map your academic path, understand your grades, and plan your future. To give you the best course recommendations, I'd love to learn more about you.\n\nWhat subjects or careers interest you most?`,
      timestamp: new Date(),
    },
  ]);
  const [apiMessages, setApiMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: text.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setError(null);

    const newApiMessages = [...apiMessages, { role: "user" as const, content: text.trim() }];
    setApiMessages(newApiMessages);

    try {
      const res = await fetch("/api/advisor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newApiMessages,
          studentProfile: { name: studentName, gradeLevel, courses },
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to get response");
      }

      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: data.reply,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      setApiMessages(prev => [...prev, { role: "assistant", content: data.reply }]);

      if (data.pathwayData && Object.keys(data.pathwayData).length > 0) {
        onPathwayUpdate?.(data.pathwayData);
      }
    } catch (err: any) {
      setError("Kepler is temporarily unavailable. Please try again.");
      setApiMessages(newApiMessages.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, apiMessages, courses, studentName, gradeLevel, onPathwayUpdate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div
      className="flex flex-col rounded-xl border border-[#1C2A45]/60 bg-[#101828]/50 backdrop-blur-sm overflow-hidden"
      style={{ minHeight: "500px", height: "calc(100vh - 284px)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#1C2A45]/40 px-4 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#818CF8]/15 border border-[#818CF8]/20">
          <Telescope size={22} className="text-[#A5B4FC]" />
        </div>
        <div>
          <p className="text-base font-semibold text-[#E8ECFF]">Kepler</p>
          <p className="text-[12px] text-[#4A5578]">AI Academic Advisor</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(16,185,129,0.5)]" />
          <span className="text-[10px] text-[#8B98B8]">Online</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              msg.role === "assistant"
                ? "bg-[#818CF8]/15 border border-[#818CF8]/20"
                : "bg-[#162032] border border-[#1C2A45]"
            }`}>
              {msg.role === "assistant"
                ? <Sparkles size={16} className="text-[#A5B4FC]" />
                : <User size={16} className="text-[#8B98B8]" />
              }
            </div>
            <div className={`max-w-[90%] rounded-xl px-4 py-3 text-[15px] leading-relaxed ${
              msg.role === "assistant"
                ? "bg-[#162032]/80 border border-[#1C2A45]/50 text-[#D4DAF0]"
                : "bg-[#818CF8]/15 border border-[#818CF8]/20 text-[#E8ECFF]"
            }`}>
              {renderMarkdown(msg.content)}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#818CF8]/15 border border-[#818CF8]/20">
              <Sparkles size={16} className="text-[#A5B4FC]" />
            </div>
            <div className="rounded-xl bg-[#162032]/80 border border-[#1C2A45]/50 px-4 py-3">
              <div className="flex gap-1">
                {[0, 150, 300].map(d => (
                  <div key={d} className="h-1.5 w-1.5 rounded-full bg-[#8B98B8] animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
            {error}
          </div>
        )}
      </div>

      {/* Suggestions (only on first message) */}
      {messages.length <= 1 && !isLoading && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => sendMessage(s)}
              className="rounded-full border border-[#1C2A45]/50 bg-[#162032]/40 px-4 py-2 text-[13px] text-[#8B98B8] hover:border-[#818CF8]/30 hover:text-[#A5B4FC] transition-all duration-200">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-[#1C2A45]/40 p-3 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask Kepler about your academic path..."
          disabled={isLoading}
          className="flex-1 rounded-lg border border-[#1C2A45]/50 bg-[#0C1220]/60 px-4 py-2.5 text-base text-[#E8ECFF] placeholder-[#4A5578] outline-none focus:border-[#818CF8]/40 focus:shadow-[0_0_8px_rgba(129,140,248,0.1)] transition-all duration-200 disabled:opacity-60"
        />
        <button type="submit" disabled={!input.trim() || isLoading}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#818CF8]/15 border border-[#818CF8]/25 text-[#A5B4FC] hover:bg-[#818CF8]/25 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
