"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { clamp, gradeColor, percentageToLetter } from "@/lib/utils";
import { RotateCcw, AlertTriangle } from "lucide-react";

interface Assignment {
  id: string;
  title: string;
  pointsPossible: number;
  dueDate?: string;
  weightCategory: { id: string; name: string; weight: number };
  submission: { score: number | null; missing: boolean; late: boolean; excused: boolean; gradedAt: string | null };
}

interface Props {
  assignment: Assignment;
  simulatedScore: number;
  isSimMode: boolean;
  onChange: (assignmentId: string, score: number) => void;
  onReset: (assignmentId: string) => void;
}

export function ScoreInputRow({ assignment, simulatedScore, isSimMode, onChange, onReset }: Props) {
  const { submission: sub, pointsPossible: max } = assignment;
  const realScore = sub.score;
  const isOverridden = isSimMode && realScore !== simulatedScore;
  const [inputVal, setInputVal] = useState(String(simulatedScore));
  const [inputError, setInputError] = useState<"over" | "negative" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputVal(String(simulatedScore));
    setInputError(null);
  }, [simulatedScore]);

  const commit = useCallback((raw: string) => {
    const parsed = parseFloat(raw);
    if (isNaN(parsed) || raw.trim() === "") { setInputVal(String(simulatedScore)); setInputError(null); return; }
    const clamped = clamp(parsed, 0, max);
    setInputVal(String(clamped));
    setInputError(null);
    onChange(assignment.id, clamped);
  }, [simulatedScore, max, assignment.id, onChange]);

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setInputVal(String(val));
    setInputError(null);
    onChange(assignment.id, val);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInputVal(raw);
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      if (parsed > max) setInputError("over");
      else if (parsed < 0) setInputError("negative");
      else setInputError(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { commit(inputVal); inputRef.current?.blur(); }
    if (e.key === "Escape") { onReset(assignment.id); }
    const step = e.shiftKey ? 5 : 1;
    if (e.key === "ArrowUp") { e.preventDefault(); const n = clamp((parseFloat(inputVal) || 0) + step, 0, max); setInputVal(String(n)); onChange(assignment.id, n); }
    if (e.key === "ArrowDown") { e.preventDefault(); const n = clamp((parseFloat(inputVal) || 0) - step, 0, max); setInputVal(String(n)); onChange(assignment.id, n); }
  };

  const pct = Math.round((simulatedScore / max) * 100);
  const letter = percentageToLetter(pct);
  const scoreDelta = simulatedScore - (realScore ?? 0);
  const borderClass = inputError === "over" ? "border-amber-400" : inputError === "negative" ? "border-rose-500" : isOverridden ? "border-blue-500" : "border-[#1F2D4A]";

  return (
    <div className={`rounded-lg p-3 border transition-all duration-150 ${isOverridden ? "border-blue-500/30 bg-blue-500/5" : "border-[#1F2D4A] bg-[#141C33]"} ${!isSimMode && sub.missing ? "border-l-2 border-l-amber-400" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-[#E2E8F0] truncate">{assignment.title}</span>
          {sub.missing && <span className="text-xs text-amber-400 flex items-center gap-0.5"><AlertTriangle size={10}/>Missing</span>}
          {sub.late && !sub.missing && <span className="text-xs text-amber-400">Late</span>}
          {sub.excused && <span className="text-xs text-[#94A3B8]">Excused</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-[#475569]">{assignment.weightCategory.name} · {Math.round(assignment.weightCategory.weight * 100)}%</span>
          {assignment.dueDate && <span className="text-xs text-[#475569]">{assignment.dueDate}</span>}
        </div>
      </div>

      {/* Controls */}
      {isSimMode ? (
        <div className="flex items-center gap-3">
          <input
            type="range" min={0} max={max} step={1} value={simulatedScore}
            onChange={handleSlider}
            className="flex-1 h-1.5 cursor-pointer rounded-full"
            style={{ background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${pct}%, #1F2D4A ${pct}%)` }}
          />
          <div className="relative">
            <input
              ref={inputRef}
              type="number" min={0} max={max} value={inputVal}
              onChange={handleInputChange}
              onBlur={() => commit(inputVal)}
              onKeyDown={handleKeyDown}
              className={`w-20 rounded-md border bg-[#1A2340] px-2 py-1 text-center font-mono text-sm text-[#E2E8F0] focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors ${borderClass}`}
            />
            {inputError === "over" && (
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-[#1A2340] border border-amber-400/30 px-2 py-1 text-xs text-amber-400 shadow-xl z-10">Max {max}</div>
            )}
          </div>
          <span className={`w-10 text-right font-mono text-sm ${gradeColor(letter)}`}>{pct}%</span>
          {isOverridden && (
            <button onClick={() => onReset(assignment.id)} className="text-[#475569] hover:text-[#94A3B8] transition-colors" title="Reset (Esc)">
              <RotateCcw size={12} />
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex-1 mr-4">
            <div className="h-1 w-full overflow-hidden rounded-full bg-[#1F2D4A]">
              <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <span className="font-mono text-sm text-[#94A3B8]">
            {realScore !== null ? `${realScore} / ${max}` : "—"}
          </span>
          <span className={`ml-3 font-mono text-sm font-medium ${gradeColor(letter)}`}>{realScore !== null ? `${pct}%` : ""}</span>
        </div>
      )}

      {/* Delta row */}
      {isSimMode && isOverridden && (
        <div className="mt-2 flex items-center gap-4 border-t border-[#1F2D4A]/50 pt-2 text-xs">
          <span className="text-[#475569]">Real: <span className="font-mono text-[#94A3B8]">{realScore !== null ? realScore : "—"}</span></span>
          <span className="text-[#475569]">Sim: <span className="font-mono text-blue-300">{simulatedScore}</span></span>
          <span className={`font-mono ml-auto ${scoreDelta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {scoreDelta >= 0 ? "+" : ""}{scoreDelta.toFixed(0)} pts
          </span>
        </div>
      )}
    </div>
  );
}
