"use client";
import { useState, useEffect, useRef, use } from "react";
import { useIC } from "@/contexts/InfiniteCampusContext";
import { useCourses } from "@/hooks/useCourses";
import {
  ChevronDown, ChevronRight, Clock, AlertTriangle,
  MoreVertical, Pencil, MinusCircle, RotateCcw, X, Check, Calculator, Plus,
} from "lucide-react";

interface Assignment {
  id: string;
  name: string;
  pointsPossible: number;
  score: number | null;
  grade: string | null;
  submittedAt: string | null;
  missing: boolean;
  late: boolean;
  dueAt: string | null;
}

interface AssignmentGroup {
  id: string;
  name: string;
  weight: number;
  score: number | null;
  assignments: Assignment[];
}

// What-if modification types
interface WhatIfMod {
  editedScore?: number;
  dropped?: boolean;
}

interface NewAssignment {
  id: string;
  groupId: string;
  name: string;
  pointsPossible: number;
  score: number | null;
}

function gradeColor(_grade: number): string {
  return "text-emerald-400";
}

// Recalculate group score with what-if mods
function calcGroupScore(assignments: Assignment[], mods: Record<string, WhatIfMod>): number | null {
  const active = assignments.filter((a) => !mods[a.id]?.dropped);
  // Include overridden, missing (counts as 0), or normally scored assignments
  const scored = active.filter((a) => {
    const mod = mods[a.id];
    if (mod?.editedScore !== undefined) return true;
    if (a.missing) return true; // missing = 0, matches IC behavior
    return a.score !== null && a.pointsPossible > 0;
  });

  if (scored.length === 0) return null;

  let totalEarned = 0;
  let totalPossible = 0;
  for (const a of scored) {
    const mod = mods[a.id];
    const score = mod?.editedScore !== undefined ? mod.editedScore : (a.score ?? 0);
    totalEarned += score;
    totalPossible += a.pointsPossible;
  }

  return totalPossible > 0 ? (totalEarned / totalPossible) * 100 : null;
}

function toAssignment(n: NewAssignment): Assignment {
  return { id: n.id, name: n.name, pointsPossible: n.pointsPossible, score: n.score, grade: null, submittedAt: null, missing: false, late: false, dueAt: null };
}

// Recalculate course grade with weighted groups
function calcCourseGrade(groups: AssignmentGroup[], mods: Record<string, WhatIfMod>): number | null {
  const hasWeights = groups.some((g) => g.weight > 0);

  if (hasWeights) {
    let weightedSum = 0;
    let totalWeight = 0;
    for (const g of groups) {
      const score = calcGroupScore(g.assignments, mods);
      if (score !== null && g.weight > 0) {
        weightedSum += score * g.weight;
        totalWeight += g.weight;
      }
    }
    return totalWeight > 0 ? weightedSum / totalWeight : null;
  } else {
    // No weights — equal weight for all groups
    const scores: number[] = [];
    for (const g of groups) {
      const score = calcGroupScore(g.assignments, mods);
      if (score !== null) scores.push(score);
    }
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  }
}

// Three-dot dropdown menu component
function AssignmentMenu({
  assignmentId,
  hasMod,
  isDropped,
  isNew,
  onEdit,
  onDrop,
  onUndrop,
  onReset,
}: {
  assignmentId: string;
  hasMod: boolean;
  isDropped: boolean;
  isNew?: boolean;
  onEdit: () => void;
  onDrop: () => void;
  onUndrop: () => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className={`relative ${open ? "z-50" : "z-10"}`} ref={menuRef}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="p-1.5 rounded-md hover:bg-[#1C2A45]/60 transition-colors"
      >
        <MoreVertical size={20} className="text-[#4A5578]" />
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-[100] w-60 rounded-xl border border-[#3e3f42] bg-[#2A2B2E] shadow-xl overflow-hidden animate-fade-in text-base text-left">
          <button
            onClick={() => { onEdit(); setOpen(false); }}
            className="w-full flex items-center justify-between px-5 py-4 text-[#E8ECFF] hover:bg-[#3A3B3E] transition-colors"
          >
            Edit Score
            <Pencil size={18} className="text-[#8B98B8]" />
          </button>
          {!isNew && (
            <>
              <div className="h-px bg-[#3e3f42] w-full" />
              <button
                onClick={() => { isDropped ? onUndrop() : onDrop(); setOpen(false); }}
                className="w-full flex items-center justify-between px-5 py-4 text-[#E8ECFF] hover:bg-[#3A3B3E] transition-colors"
              >
                {isDropped ? "Undrop Assignment" : "Drop Assignment"}
                <MinusCircle size={18} className="text-[#8B98B8]" />
              </button>
              <div className="h-px bg-[#3e3f42] w-full" />
              <button
                onClick={() => { if (hasMod) { onReset(); setOpen(false); } }}
                disabled={!hasMod}
                className={`w-full flex items-center justify-between px-5 py-4 transition-colors ${hasMod ? "text-[#E8ECFF] hover:bg-[#3A3B3E]" : "text-[#8B98B8] opacity-50 cursor-not-allowed"}`}
              >
                Reset Assignment
                <RotateCcw size={18} className="text-[#8B98B8]" />
              </button>
            </>
          )}
          {isNew && (
            <>
              <div className="h-px bg-[#3e3f42] w-full" />
              <button
                onClick={() => { onReset(); setOpen(false); }}
                className="w-full flex items-center justify-between px-5 py-4 text-rose-400 hover:bg-[#3A3B3E] transition-colors"
              >
                Delete Assignment
                <X size={18} className="text-rose-400" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Three-dot dropdown menu for category header
function CategoryMenu({
  hasAnyCategoryMod,
  onAddAssignment,
  onResetCategory,
  onOpenChange,
}: {
  hasAnyCategoryMod: boolean;
  onAddAssignment: () => void;
  onResetCategory: () => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const setOpenWithNotify = (v: boolean) => { setOpen(v); onOpenChange?.(v); };
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenWithNotify(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className={`relative ${open ? "z-50" : "z-10"}`} ref={menuRef}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpenWithNotify(!open); }}
        className="p-1.5 rounded-md hover:bg-[#1C2A45]/60 transition-colors"
      >
        <MoreVertical size={20} className="text-[#4A5578]" />
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-[100] w-56 rounded-xl border border-[#3e3f42] bg-[#2A2B2E] shadow-xl overflow-hidden animate-fade-in text-base text-left">
          <button
            onClick={() => { onAddAssignment(); setOpenWithNotify(false); }}
            className="w-full flex items-center justify-between px-5 py-4 text-[#E8ECFF] hover:bg-[#3A3B3E] transition-colors"
          >
            Add Assignment
            <Plus size={18} className="text-[#8B98B8]" />
          </button>
          <div className="h-px bg-[#3e3f42] w-full" />
          <button
            onClick={() => { if (hasAnyCategoryMod) { onResetCategory(); setOpenWithNotify(false); } }}
            disabled={!hasAnyCategoryMod}
            className={`w-full flex items-center justify-between px-5 py-4 transition-colors ${hasAnyCategoryMod ? "text-[#E8ECFF] hover:bg-[#3A3B3E]" : "text-[#8B98B8] opacity-50 cursor-not-allowed"}`}
          >
            Reset Category
            <RotateCcw size={18} className="text-[#8B98B8]" />
          </button>
        </div>
      )}
    </div>
  );
}

// Three-dot dropdown menu for the Hero section
function HeroMenu({
  hasAnyMod,
  onResetAll,
  onOpenCalculator,
}: {
  hasAnyMod: boolean;
  onResetAll: () => void;
  onOpenCalculator: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="p-1.5 rounded-md hover:bg-[#1C2A45]/60 transition-colors"
      >
        <MoreVertical size={20} className="text-[#E8ECFF]" />
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-64 rounded-xl border border-[#3e3f42] bg-[#2A2B2E] shadow-xl overflow-hidden animate-fade-in">
          <button
            onClick={() => { setOpen(false); onOpenCalculator(); }}
            className="w-full flex items-center justify-between px-5 py-3.5 text-sm text-[#E8ECFF] hover:bg-[#3A3B3E] transition-colors"
          >
            Final Grade Calculator
            <Calculator size={16} className="text-[#8B98B8]" />
          </button>

          <div className="h-px bg-[#3e3f42] w-full" />

          <button
            onClick={() => { if (hasAnyMod) { onResetAll(); setOpen(false); } }}
            disabled={!hasAnyMod}
            className={`w-full flex items-center justify-between px-5 py-3.5 text-sm transition-colors ${hasAnyMod
              ? "text-[#E8ECFF] hover:bg-[#3A3B3E]"
              : "text-[#8B98B8] opacity-50 cursor-not-allowed"
              }`}
          >
            Reset Everything
            <RotateCcw size={16} className={hasAnyMod ? "text-[#8B98B8]" : "text-[#8B98B8]"} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function CourseDetailPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const { session, isConnected } = useIC();
  const { courses } = useCourses();
  const course = courses.find((c) => c.id === courseId);
  const [groups, setGroups] = useState<AssignmentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [openCategoryMenu, setOpenCategoryMenu] = useState<string | null>(null);

  // What-if state
  const [mods, setMods] = useState<Record<string, WhatIfMod>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editTotal, setEditTotal] = useState("");
  const [newAssignments, setNewAssignments] = useState<NewAssignment[]>([]);

  const hasAnyMod = Object.keys(mods).length > 0 || newAssignments.some((n) => n.score !== null);

  // Calculator state
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [calcGoal, setCalcGoal] = useState("90");
  const [calcWeight, setCalcWeight] = useState("10");

  useEffect(() => {
    if (!isConnected || !session) {
      setGroups([]);
      setLoading(false);
      return;
    }

    async function fetchICGroups() {
      try {
        const res = await fetch("/api/ic/assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            authToken: session!.authToken,
            baseUrl: session!.baseUrl,
            appName: session!.appName,
            courseId,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setGroups(data.groups);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchICGroups();
  }, [session, isConnected, courseId]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // What-if handlers
  const handleEdit = (assignmentId: string, currentScore: number | null, pointsPossible: number) => {
    setEditingId(assignmentId);
    setEditValue(currentScore != null ? String(currentScore) : "");
    setEditTotal(String(pointsPossible));
  };

  const confirmEdit = (assignmentId: string) => {
    const val = parseFloat(editValue);
    if (assignmentId.startsWith("new-")) {
      const total = parseFloat(editTotal);
      const validTotal = !isNaN(total) && total > 0 ? total : undefined;
      if (!isNaN(val) && val >= 0) {
        setNewAssignments((prev) => prev.map((n) => n.id === assignmentId ? { ...n, score: val, ...(validTotal !== undefined ? { pointsPossible: validTotal } : {}) } : n));
      } else {
        setNewAssignments((prev) => prev.filter((n) => n.id !== assignmentId));
      }
    } else if (!isNaN(val) && val >= 0) {
      const originalScore = groups.flatMap((g) => g.assignments).find((a) => a.id === assignmentId)?.score;
      if (originalScore !== null && originalScore !== undefined && val === originalScore) {
        setMods((prev) => {
          const next = { ...prev };
          const existing = next[assignmentId];
          if (!existing || !existing.dropped) {
            delete next[assignmentId];
          } else {
            const { editedScore: _removed, ...rest } = existing;
            next[assignmentId] = rest;
          }
          return next;
        });
      } else {
        setMods((prev) => ({
          ...prev,
          [assignmentId]: { ...prev[assignmentId], editedScore: val, dropped: false },
        }));
      }
    }
    setEditingId(null);
    setEditValue("");
    setEditTotal("");
  };

  const cancelEdit = () => {
    if (editingId?.startsWith("new-")) {
      setNewAssignments((prev) => {
        const na = prev.find((n) => n.id === editingId);
        return na?.score === null ? prev.filter((n) => n.id !== editingId) : prev;
      });
    }
    setEditingId(null);
    setEditValue("");
    setEditTotal("");
  };

  const handleDrop = (assignmentId: string) => {
    if (assignmentId.startsWith("new-")) {
      setNewAssignments((prev) => prev.filter((n) => n.id !== assignmentId));
      return;
    }
    setMods((prev) => ({
      ...prev,
      [assignmentId]: { ...prev[assignmentId], dropped: true },
    }));
  };

  const handleUndrop = (assignmentId: string) => {
    setMods((prev) => {
      const next = { ...prev };
      const existing = next[assignmentId];
      if (!existing?.editedScore) {
        delete next[assignmentId];
      } else {
        next[assignmentId] = { ...existing, dropped: false };
      }
      return next;
    });
  };

  const handleReset = (assignmentId: string) => {
    if (assignmentId.startsWith("new-")) {
      setNewAssignments((prev) => prev.filter((n) => n.id !== assignmentId));
      return;
    }
    setMods((prev) => {
      const next = { ...prev };
      delete next[assignmentId];
      return next;
    });
  };

  const handleResetAll = () => {
    setMods({});
    setNewAssignments([]);
    setEditingId(null);
  };

  const handleAddAssignment = (groupId: string) => {
    const groupNew = newAssignments.filter((n) => n.groupId === groupId);
    let num = 1;
    while (groupNew.some((n) => n.name === `New Assignment #${num}`)) num++;
    const id = `new-${Date.now()}`;
    setNewAssignments((prev) => [...prev, { id, groupId, name: `New Assignment #${num}`, pointsPossible: 100, score: null }]);
    setEditingId(id);
    setEditValue("");
    setExpandedGroups((prev) => new Set([...prev, groupId]));
  };

  const handleResetCategory = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (group) {
      setMods((prev) => {
        const next = { ...prev };
        group.assignments.forEach((a) => delete next[a.id]);
        return next;
      });
    }
    setNewAssignments((prev) => prev.filter((n) => n.groupId !== groupId));
  };

  // Calculate what-if course grade (augment groups with confirmed new assignments)
  const augmentedGroups = groups.map((g) => ({
    ...g,
    assignments: [...g.assignments, ...newAssignments.filter((n) => n.groupId === g.id && n.score !== null).map(toAssignment)],
  }));
  const whatIfCourseGrade = hasAnyMod ? calcCourseGrade(augmentedGroups, mods) : null;

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-[#818CF8]/30 border-t-[#818CF8] animate-spin" />
            <p className="text-sm text-[#8B98B8]">Loading course details...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1 p-6 animate-fade-in max-w-3xl mx-auto w-full">
        {/* Course Grade Hero */}
        <div className="relative z-20 rounded-xl border border-[#1C2A45]/60 bg-[#282828] backdrop-blur-sm px-6 py-5 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#fcfcfc]">{course?.name || "Course"}</h2>
              <p className="text-sm text-[#A0A0A0] mt-1.5 flex items-center gap-1.5">
                updated recently <Clock size={12} className="text-[#A0A0A0]" />
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Grade display */}
              {hasAnyMod && whatIfCourseGrade != null ? (
                <div className="flex items-center gap-4">
                  {/* Difference Indicator */}
                  {course?.currentGrade != null && (() => {
                    const diff = whatIfCourseGrade - course.currentGrade;
                    if (Math.abs(diff) < 0.01) return null;
                    const isPositive = diff > 0;
                    return (
                      <span className={`font-mono text-xl font-bold ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                        {isPositive ? "+" : ""}{diff.toFixed(2)}%
                      </span>
                    );
                  })()}
                  <div className="text-right flex flex-col items-end">
                    <span className={`font-mono text-4xl font-bold ${gradeColor(whatIfCourseGrade)}`}>
                      {whatIfCourseGrade.toFixed(2)}%
                    </span>
                  </div>
                </div>
              ) : course?.currentGrade != null ? (
                <span className={`font-mono text-4xl font-bold ${gradeColor(course.currentGrade)}`}>
                  {course.currentGrade.toFixed(2)}%
                </span>
              ) : (
                <span className="text-2xl text-[#4A5578]">No grade</span>
              )}

              {/* Hero three-dot menu */}
              <HeroMenu
                hasAnyMod={hasAnyMod}
                onResetAll={handleResetAll}
                onOpenCalculator={() => setIsCalcOpen(true)}
              />
            </div>
          </div>
        </div>

        {/* Assignment Groups */}
        <div className="flex flex-col gap-4 relative z-10">
          {groups.map((group) => {
            const isExpanded = expandedGroups.has(group.id);
            const groupNewAssignments = newAssignments.filter((n) => n.groupId === group.id);
            const groupScoredNew = groupNewAssignments.filter((n) => n.score !== null).map(toAssignment);
            const allGroupAssignments = [...group.assignments, ...groupScoredNew];
            const groupHasMods = group.assignments.some((a) => mods[a.id]) || groupScoredNew.length > 0;
            const hasAnyCategoryMod = group.assignments.some((a) => mods[a.id]) || groupNewAssignments.length > 0;
            const origGroupScore = calcGroupScore(group.assignments, {});
            const modifiedGroupScore = groupHasMods ? calcGroupScore(allGroupAssignments, mods) : null;
            const groupScore = modifiedGroupScore ?? origGroupScore ?? group.score;
            const groupDelta = (groupHasMods && modifiedGroupScore != null && origGroupScore != null)
              ? modifiedGroupScore - origGroupScore
              : null;

            return (
              <div
                key={group.id}
                className={`relative rounded-xl border border-[#1C2A45]/60 bg-[#101828]/50 backdrop-blur-sm transition-all duration-300 ${openCategoryMenu === group.id ? "z-20" : "z-0"}`}
              >
                {/* Group header */}
                <div
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between px-6 py-5 hover:bg-[#162032]/60 transition-colors duration-200 cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#1C2A45]/80 border border-[#253A5E]/60">
                      {isExpanded ? (
                        <ChevronDown size={38} className="text-[#818CF8]" />
                      ) : (
                        <ChevronRight size={38} className="text-[#8B98B8]" />
                      )}
                    </div>
                    <div className="text-left">
                      <p className="text-base font-medium text-[#E8ECFF]">{group.name}</p>
                      {group.weight > 0 && (
                        <p className="text-xs text-[#4A5578] mt-0.5">{group.weight}%</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    {groupDelta != null && Math.abs(groupDelta) >= 0.01 && (
                      <span className={`font-mono text-sm font-semibold ${groupDelta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {groupDelta >= 0 ? "+" : ""}{groupDelta.toFixed(2)}%
                      </span>
                    )}
                    {groupScore != null ? (
                      <span className={`font-mono text-lg font-semibold ${gradeColor(groupScore)}`}>
                        {groupScore.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-[#4A5578]">—</span>
                    )}
                    <CategoryMenu
                      hasAnyCategoryMod={hasAnyCategoryMod}
                      onAddAssignment={() => handleAddAssignment(group.id)}
                      onResetCategory={() => handleResetCategory(group.id)}
                      onOpenChange={(o) => setOpenCategoryMenu(o ? group.id : null)}
                    />
                  </div>
                </div>

                {/* Expanded assignments */}
                {isExpanded && (
                  <div className="border-t border-[#1C2A45]/40 bg-[#0C1420]/40">
                    {group.assignments.length === 0 && groupNewAssignments.length === 0 ? (
                      <p className="px-6 py-4 text-sm text-[#4A5578]">No assignments in this group</p>
                    ) : (
                      <>
                      {groupNewAssignments.map((na) => {
                        const isEditing = editingId === na.id;
                        return (
                          <div key={na.id} className="flex items-center justify-between px-6 py-4 border-b border-[#1C2A45]/20 last:border-b-0 hover:bg-[#131D30]/50 transition-colors duration-150">
                            <div className="flex-1 min-w-0 mr-4">
                              <p className="text-base font-medium truncate text-[#C8D0E8]">{na.name}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {isEditing ? (
                                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="number"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") confirmEdit(na.id);
                                      if (e.key === "Escape") cancelEdit();
                                    }}
                                    className="w-20 px-3 py-1.5 rounded-md bg-[#1C2A45] border border-[#253A5E] text-base text-[#E8ECFF] font-mono text-center focus:outline-none focus:border-[#818CF8]"
                                    autoFocus
                                    step="any"
                                    min="0"
                                  />
                                  <span className="text-sm text-[#8B98B8]">/</span>
                                  <input
                                    type="number"
                                    value={editTotal}
                                    onChange={(e) => setEditTotal(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") confirmEdit(na.id);
                                      if (e.key === "Escape") cancelEdit();
                                    }}
                                    className="w-20 px-3 py-1.5 rounded-md bg-[#1C2A45] border border-[#253A5E] text-base text-[#E8ECFF] font-mono text-center focus:outline-none focus:border-[#818CF8]"
                                    step="any"
                                    min="1"
                                  />
                                  <button onClick={() => confirmEdit(na.id)} className="p-1.5 rounded hover:bg-emerald-500/20 transition-colors">
                                    <Check size={18} className="text-emerald-400" />
                                  </button>
                                  <button onClick={cancelEdit} className="p-1.5 rounded hover:bg-rose-500/20 transition-colors">
                                    <X size={18} className="text-rose-400" />
                                  </button>
                                </div>
                              ) : (
                                <div className="text-right">
                                  {na.score != null ? (
                                    <div className="flex flex-col items-end">
                                      <span className="font-mono text-base font-semibold text-[#818CF8]">
                                        {na.score}/{na.pointsPossible}
                                      </span>
                                      <p className="font-mono text-sm text-[#818CF8]/70">
                                        {((na.score / na.pointsPossible) * 100).toFixed(2)}%
                                      </p>
                                    </div>
                                  ) : (
                                    <span className="text-sm text-[#4A5578]">—</span>
                                  )}
                                </div>
                              )}
                              {!isEditing && (
                                <AssignmentMenu
                                  assignmentId={na.id}
                                  hasMod={true}
                                  isDropped={false}
                                  isNew={true}
                                  onEdit={() => handleEdit(na.id, na.score, na.pointsPossible)}
                                  onDrop={() => handleDrop(na.id)}
                                  onUndrop={() => {}}
                                  onReset={() => handleReset(na.id)}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {group.assignments.map((assignment) => {
                        const mod = mods[assignment.id];
                        const isDropped = mod?.dropped === true;
                        const isEdited = mod?.editedScore !== undefined;
                        const hasMod = isDropped || isEdited;
                        const isEditing = editingId === assignment.id;
                        const displayScore = mod?.editedScore !== undefined ? mod.editedScore : assignment.score;

                        return (
                          <div
                            key={assignment.id}
                            className={`flex items-center justify-between px-6 py-4 border-b border-[#1C2A45]/20 last:border-b-0 transition-colors duration-150 ${isDropped
                              ? "bg-[#0C1420]/60"
                              : "hover:bg-[#131D30]/50"
                              }`}
                          >
                            <div className="flex-1 min-w-0 mr-4">
                              <div className="flex items-center gap-2">
                                <p className={`text-base font-medium truncate ${isDropped ? "text-[#4A5578] line-through" : "text-[#C8D0E8]"}`}>
                                  {assignment.name}
                                </p>
                                {assignment.missing && !isDropped && (
                                  <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
                                    <AlertTriangle size={12} /> Missing
                                  </span>
                                )}
                                {assignment.late && !assignment.missing && !isDropped && (
                                  <span className="text-xs text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded-full">
                                    Late
                                  </span>
                                )}
                              </div>
                              {assignment.dueAt && (
                                <p className={`flex items-center gap-1.5 text-[13px] mt-1 ${isDropped ? "text-[#4A5578]/60" : "text-[#8B98B8]"}`}>
                                  <Clock size={12} />
                                  Due {new Date(assignment.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </p>
                              )}
                            </div>

                            {/* Score + menu */}
                            <div className="flex items-center gap-2 shrink-0">
                              {isEditing ? (
                                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="number"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") confirmEdit(assignment.id);
                                      if (e.key === "Escape") cancelEdit();
                                    }}
                                    className="w-20 px-3 py-1.5 rounded-md bg-[#1C2A45] border border-[#253A5E] text-base text-[#E8ECFF] font-mono text-center focus:outline-none focus:border-[#818CF8]"
                                    autoFocus
                                    step="any"
                                    min="0"
                                  />
                                  <span className="text-sm text-[#8B98B8]">/ {assignment.pointsPossible}</span>
                                  <button onClick={() => confirmEdit(assignment.id)} className="p-1.5 rounded hover:bg-emerald-500/20 transition-colors">
                                    <Check size={18} className="text-emerald-400" />
                                  </button>
                                  <button onClick={cancelEdit} className="p-1.5 rounded hover:bg-rose-500/20 transition-colors">
                                    <X size={18} className="text-rose-400" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-4">
                                  {/* Percentage Change Indicator (Left side) */}
                                  {isEdited && !isDropped && assignment.score != null && displayScore != null && (() => {
                                    const origPct = (assignment.score / assignment.pointsPossible) * 100;
                                    const newPct = (displayScore / assignment.pointsPossible) * 100;
                                    const diff = newPct - origPct;
                                    if (Math.abs(diff) < 0.01) return null;
                                    const isPositive = diff > 0;
                                    return (
                                      <div className={`font-mono text-sm font-semibold ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                                        {isPositive ? "+" : ""}{diff.toFixed(2)}%
                                      </div>
                                    );
                                  })()}

                                  <div className="text-right">
                                    {displayScore != null ? (
                                      <div className="flex flex-col items-end">
                                        <span className={`font-mono text-base font-semibold ${isEdited ? "text-[#818CF8]" : isDropped ? "text-[#4A5578] line-through" : "text-emerald-400"}`}>
                                          {displayScore}/{assignment.pointsPossible}
                                        </span>
                                        {displayScore != null && assignment.pointsPossible > 0 && (
                                          <div className="flex flex-col items-end gap-0.5 mt-0.5">
                                            <p className={`font-mono text-sm ${isEdited ? "text-[#818CF8]/70" : isDropped ? "text-[#4A5578]/70 line-through" : "text-[#8B98B8]"} ${isDropped ? "line-through" : ""}`}>
                                              {((displayScore / assignment.pointsPossible) * 100).toFixed(2)}%
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-sm text-[#4A5578]">—</span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {!isEditing && (
                                <AssignmentMenu
                                  assignmentId={assignment.id}
                                  hasMod={hasMod}
                                  isDropped={isDropped}
                                  onEdit={() => handleEdit(assignment.id, displayScore, assignment.pointsPossible)}
                                  onDrop={() => handleDrop(assignment.id)}
                                  onUndrop={() => handleUndrop(assignment.id)}
                                  onReset={() => handleReset(assignment.id)}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {groups.length === 0 && !loading && (
            <div className="text-center py-12 text-[#4A5578]">
              <p className="text-lg">No assignment groups found</p>
              <p className="text-sm mt-1">
                {isConnected
                  ? "Infinite Campus did not return any assignment data for this course."
                  : "Connect Infinite Campus in Settings to view your assignments."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Final Grade Calculator Modal */}
      {isCalcOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#090C15]/80 backdrop-blur-sm px-4">
          <div className="bg-[#101828] border border-[#1C2A45] rounded-xl p-6 w-full max-w-sm animate-fade-in shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold text-[#E8ECFF]">Final Grade Calculator</h3>
              <button onClick={() => setIsCalcOpen(false)} className="text-[#8B98B8] hover:text-[#E8ECFF]">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#8B98B8] mb-1.5">Desired Grade (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={calcGoal}
                    onChange={(e) => setCalcGoal(e.target.value)}
                    className="w-full bg-[#1C2A45]/50 border border-[#253A5E] rounded-md px-3 py-2 text-[#E8ECFF] placeholder-[#4A5578] focus:outline-none focus:border-[#818CF8]"
                    placeholder="e.g. 90"
                  />
                  <span className="absolute right-3 top-2.5 text-[#4A5578]">%</span>
                </div>
              </div>

              <div>
                <label className="block text-sm text-[#8B98B8] mb-1.5">Final Exam Weight (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="0.1"
                    value={calcWeight}
                    onChange={(e) => setCalcWeight(e.target.value)}
                    className="w-full bg-[#1C2A45]/50 border border-[#253A5E] rounded-md px-3 py-2 text-[#E8ECFF] placeholder-[#4A5578] focus:outline-none focus:border-[#818CF8]"
                    placeholder="e.g. 15"
                  />
                  <span className="absolute right-3 top-2.5 text-[#4A5578]">%</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-[#1C2A45]/40">
              {(() => {
                const goal = parseFloat(calcGoal);
                const weightPerc = parseFloat(calcWeight);
                const current = hasAnyMod && whatIfCourseGrade != null ? whatIfCourseGrade : course?.currentGrade;

                if (!isNaN(goal) && !isNaN(weightPerc) && current != null && weightPerc > 0) {
                  const weight = weightPerc / 100;
                  const required = (goal - (current * (1 - weight))) / weight;

                  return (
                    <div className="text-center">
                      <p className="text-sm text-[#8B98B8] mb-1">You need a</p>
                      <p className={`text-3xl font-bold font-mono my-2 ${required > 100 ? "text-rose-400" : required <= 0 ? "text-emerald-400" : "text-[#818CF8]"
                        }`}>
                        {required.toFixed(2)}%
                      </p>
                      <p className="text-sm text-[#8B98B8]">
                        on the final to get {goal}% overall
                      </p>
                    </div>
                  );
                } else {
                  return <p className="text-center text-sm text-[#4A5578] py-4">Enter valid numbers to calculate</p>;
                }
              })()}
            </div>

            <button
              onClick={() => setIsCalcOpen(false)}
              className="w-full mt-6 bg-[#818CF8] hover:bg-[#A5B4FC] text-[#090C15] font-medium py-2 rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
