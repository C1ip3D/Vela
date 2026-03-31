"use client";
import { useState, useCallback } from "react";
import { ScoreInputRow } from "./ScoreInputRow";
import { calculateSimulation } from "@/lib/engines/simulation";
import { percentageToLetter, letterToGpaPoints, formatGpa, gradeColor } from "@/lib/utils";
import { Sparkles, Plus, X } from "lucide-react";

interface Assignment {
  id: string;
  title: string;
  pointsPossible: number;
  dueDate?: string;
  weightCategory: { id: string; name: string; weight: number };
  submission: { score: number | null; missing: boolean; late: boolean; excused: boolean; gradedAt: string | null };
}

interface Props {
  courseId: string;
  courseName: string;
  courseType: string;
  categories: Array<{ id: string; name: string; weight: number }>;
  assignments: Assignment[];
  baseGrade: number;
}

export function SimulationPanel({ courseId, courseName, courseType, categories, assignments, baseGrade }: Props) {
  const [isSimMode, setIsSimMode] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [placeholders, setPlaceholders] = useState<Array<{ id: string; title: string; weightCategoryId: string; pointsPossible: number; projectedScore: number }>>([]);
  const [newPH, setNewPH] = useState({ title: "", weightCategoryId: categories[0]?.id ?? "", pointsPossible: 100, projectedScore: 85 });
  const [showAddPH, setShowAddPH] = useState(false);

  const handleChange = useCallback((id: string, score: number) => {
    setOverrides((prev) => {
      const orig = assignments.find((a) => a.id === id)?.submission.score ?? 0;
      if (score === orig) { const next = { ...prev }; delete next[id]; return next; }
      return { ...prev, [id]: score };
    });
  }, [assignments]);

  const handleReset = useCallback((id: string) => {
    setOverrides((prev) => { const next = { ...prev }; delete next[id]; return next; });
  }, []);

  const resetAll = () => { setOverrides({}); setPlaceholders([]); };

  const addPlaceholder = () => {
    if (!newPH.title.trim()) return;
    setPlaceholders((prev) => [...prev, { ...newPH, id: `ph-${Date.now()}` }]);
    setNewPH((p) => ({ ...p, title: "" }));
    setShowAddPH(false);
  };

  // Build simulation inputs
  const simAssignments = assignments.map((a) => ({
    id: a.id, title: a.title, pointsPossible: a.pointsPossible,
    weightCategoryId: a.weightCategory.id,
    score: a.submission.score, missing: a.submission.missing, excused: a.submission.excused,
  }));

  const simResult = calculateSimulation({ categories, assignments: simAssignments, overrides, placeholders, courseType });
  const baseLetter = percentageToLetter(baseGrade);
  const baseGpa = letterToGpaPoints(baseLetter, courseType);
  const projGpa = simResult.projectedGpaPoints;
  const gpaDelta = projGpa - baseGpa;
  const gradeDelta = simResult.projectedPercentage - baseGrade;

  // Effective score map for display
  const effectiveScores: Record<string, number> = {};
  for (const a of assignments) {
    effectiveScores[a.id] = overrides[a.id] !== undefined ? overrides[a.id] : (a.submission.score ?? 0);
  }

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex items-center justify-between rounded-xl border border-[#1F2D4A] bg-[#141C33] p-4">
        <div className="flex items-center gap-3">
          <Sparkles size={16} className={isSimMode ? "text-blue-400" : "text-[#475569]"} />
          <div>
            <p className="text-sm font-medium text-[#E2E8F0]">{isSimMode ? "What-If Mode Active" : "What-If Simulator"}</p>
            <p className="text-xs text-[#94A3B8]">{isSimMode ? "Editing scores below. Changes don't affect your real grade." : "Toggle to simulate grade scenarios."}</p>
          </div>
        </div>
        <label className="relative inline-flex cursor-pointer items-center">
          <input type="checkbox" checked={isSimMode} onChange={(e) => { setIsSimMode(e.target.checked); if (!e.target.checked) resetAll(); }} className="sr-only peer" />
          <div className="w-10 h-6 bg-[#1A2340] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#94A3B8] after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-white border border-[#2A3F66]" />
        </label>
      </div>

      {/* Simulation projection banner */}
      {isSimMode && (Object.keys(overrides).length > 0 || placeholders.length > 0) && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-[#94A3B8]">Base</p>
              <p className={`font-mono text-2xl font-bold ${gradeColor(baseLetter)}`}>{baseLetter}</p>
              <p className="font-mono text-sm text-[#94A3B8]">{baseGrade.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-xs text-[#94A3B8]">Projected</p>
              <p className={`font-mono text-2xl font-bold ${gradeColor(simResult.projectedLetter)}`}>{simResult.projectedLetter}</p>
              <p className="font-mono text-sm text-[#94A3B8]">{simResult.projectedPercentage.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-xs text-[#94A3B8]">Grade Δ</p>
              <p className={`font-mono text-2xl font-bold ${gradeDelta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {gradeDelta >= 0 ? "+" : ""}{gradeDelta.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-[#94A3B8]">GPA Δ</p>
              <p className={`font-mono text-2xl font-bold ${gpaDelta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {gpaDelta >= 0 ? "+" : ""}{gpaDelta.toFixed(2)}
              </p>
            </div>
          </div>
          {/* Category breakdown */}
          <div className="mt-3 pt-3 border-t border-[#1F2D4A] grid grid-cols-2 gap-2 sm:grid-cols-3">
            {simResult.categoryBreakdown.map((cat) => (
              <div key={cat.id} className="text-xs">
                <span className="text-[#94A3B8]">{cat.name}</span>
                <span className="font-mono text-[#E2E8F0] ml-2">{cat.average.toFixed(1)}%</span>
                <span className="text-[#475569] ml-1">({Math.round(cat.weight * 100)}%)</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={resetAll} className="text-xs text-[#94A3B8] hover:text-[#E2E8F0] transition-colors">Reset all</button>
          </div>
        </div>
      )}

      {/* Assignment list */}
      <div className="space-y-2">
        {assignments.map((a) => (
          <ScoreInputRow
            key={a.id}
            assignment={a}
            simulatedScore={effectiveScores[a.id]}
            isSimMode={isSimMode}
            onChange={handleChange}
            onReset={handleReset}
          />
        ))}
      </div>

      {/* Add placeholder */}
      {isSimMode && (
        <div>
          {showAddPH ? (
            <div className="rounded-lg border border-blue-500/30 bg-[#141C33] p-3 space-y-2">
              <p className="text-xs font-medium text-[#E2E8F0]">Add Future Assignment</p>
              <input
                type="text" placeholder="Assignment title"
                value={newPH.title}
                onChange={(e) => setNewPH((p) => ({ ...p, title: e.target.value }))}
                className="w-full rounded bg-[#1A2340] border border-[#1F2D4A] px-2 py-1.5 text-sm text-[#E2E8F0] focus:outline-none focus:border-blue-500"
              />
              <div className="grid grid-cols-3 gap-2">
                <select value={newPH.weightCategoryId} onChange={(e) => setNewPH((p) => ({ ...p, weightCategoryId: e.target.value }))}
                  className="rounded bg-[#1A2340] border border-[#1F2D4A] px-2 py-1.5 text-xs text-[#E2E8F0] focus:outline-none focus:border-blue-500">
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input type="number" placeholder="Max pts" value={newPH.pointsPossible}
                  onChange={(e) => setNewPH((p) => ({ ...p, pointsPossible: Number(e.target.value) }))}
                  className="rounded bg-[#1A2340] border border-[#1F2D4A] px-2 py-1.5 text-xs text-[#E2E8F0] font-mono focus:outline-none focus:border-blue-500" />
                <input type="number" placeholder="Your score" value={newPH.projectedScore}
                  onChange={(e) => setNewPH((p) => ({ ...p, projectedScore: Number(e.target.value) }))}
                  className="rounded bg-[#1A2340] border border-[#1F2D4A] px-2 py-1.5 text-xs text-[#E2E8F0] font-mono focus:outline-none focus:border-blue-500" />
              </div>
              <div className="flex gap-2">
                <button onClick={addPlaceholder} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors">Add</button>
                <button onClick={() => setShowAddPH(false)} className="text-xs text-[#94A3B8] hover:text-[#E2E8F0] transition-colors">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddPH(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#2A3F66] py-2.5 text-sm text-[#94A3B8] hover:border-blue-500/50 hover:text-blue-400 transition-all">
              <Plus size={14} /> Add future assignment
            </button>
          )}

          {/* Placeholder list */}
          {placeholders.map((ph) => (
            <div key={ph.id} className="flex items-center justify-between rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 mt-2">
              <span className="text-sm text-[#E2E8F0]">{ph.title}</span>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-blue-300">{ph.projectedScore}/{ph.pointsPossible}</span>
                <button onClick={() => setPlaceholders((p) => p.filter((x) => x.id !== ph.id))} className="text-[#475569] hover:text-rose-400 transition-colors"><X size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
