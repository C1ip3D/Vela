"use client";
import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Zap, X, Check, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { WeightTemplate, saveLocalWeightTemplates } from "@/hooks/useClassroomCourses";

// ── Built-in category presets ──────────────────────────────────────────────

const BUILT_IN_PRESETS = [
  {
    id: "p_standard",
    name: "Tests / Homework",
    emoji: "📝",
    categories: [
      { name: "Tests", weight: 0.6, dropLowest: 0 },
      { name: "Homework", weight: 0.4, dropLowest: 1 },
    ],
  },
  {
    id: "p_sciencelab",
    name: "Science Lab Heavy",
    emoji: "🧪",
    categories: [
      { name: "Labs", weight: 0.4, dropLowest: 0 },
      { name: "Tests", weight: 0.45, dropLowest: 0 },
      { name: "Homework", weight: 0.15, dropLowest: 0 },
    ],
  },
  {
    id: "p_humanities",
    name: "Humanities / English",
    emoji: "📖",
    categories: [
      { name: "Essays", weight: 0.5, dropLowest: 0 },
      { name: "Reading Responses", weight: 0.3, dropLowest: 0 },
      { name: "Participation", weight: 0.2, dropLowest: 0 },
    ],
  },
  {
    id: "p_project",
    name: "Project Based",
    emoji: "🗂️",
    categories: [
      { name: "Projects", weight: 0.55, dropLowest: 0 },
      { name: "Quizzes", weight: 0.3, dropLowest: 0 },
      { name: "Participation", weight: 0.15, dropLowest: 0 },
    ],
  },
];

// ── Types ──────────────────────────────────────────────────────────────────

interface EditableCategory {
  id: string;         // local UI id
  name: string;
  weightPct: number;  // 0–100 (percent)
  dropLowest: number;
}

interface WeightCategoryEditorProps {
  courseId: string;
  courseName: string;
  initialTemplates?: WeightTemplate[];
  /** Called when the user saves a valid set of categories */
  onSave: (templates: WeightTemplate[]) => void;
  /** Called when modal is dismissed without saving */
  onClose?: () => void;
  /** If true, shows as an inline panel rather than a modal overlay */
  inline?: boolean;
  /** User-defined presets fetched from the server */
  userPresets?: { id: string; name: string; categories: Omit<WeightTemplate, "id">[] }[];
  onSaveAsPreset?: (name: string, categories: Omit<WeightTemplate, "id">[]) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

let idCounter = 0;
function nextId() {
  return `cat_${++idCounter}_${Date.now()}`;
}

function totalWeight(categories: EditableCategory[]): number {
  return categories.reduce((s, c) => s + c.weightPct, 0);
}

function toTemplates(categories: EditableCategory[]): WeightTemplate[] {
  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    weight: c.weightPct / 100,
    dropLowest: c.dropLowest,
  }));
}

// ── Component ──────────────────────────────────────────────────────────────

export function WeightCategoryEditor({
  courseId,
  courseName,
  initialTemplates = [],
  onSave,
  onClose,
  inline = false,
  userPresets = [],
  onSaveAsPreset,
}: WeightCategoryEditorProps) {
  const [categories, setCategories] = useState<EditableCategory[]>(() => {
    if (initialTemplates.length > 0) {
      return initialTemplates.map((t) => ({
        id: t.id || nextId(),
        name: t.name,
        weightPct: Math.round(t.weight * 100),
        dropLowest: t.dropLowest,
      }));
    }
    // Default: two empty rows
    return [
      { id: nextId(), name: "", weightPct: 60, dropLowest: 0 },
      { id: nextId(), name: "", weightPct: 40, dropLowest: 0 },
    ];
  });

  const [saved, setSaved] = useState(false);
  const [showPresetsPanel, setShowPresetsPanel] = useState(categories[0]?.name === "");
  const [presetSaveName, setPresetSaveName] = useState("");
  const [showPresetSaveInput, setShowPresetSaveInput] = useState(false);

  const total = totalWeight(categories);
  const isValid = Math.abs(total - 100) <= 0.5 && categories.every((c) => c.name.trim());

  // ── Category mutations ───────────────────────────────────────────────────

  function updateCategory(id: string, field: keyof EditableCategory, value: string | number) {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  }

  function addCategory() {
    setCategories((prev) => [
      ...prev,
      { id: nextId(), name: "", weightPct: 0, dropLowest: 0 },
    ]);
  }

  function removeCategory(id: string) {
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }

  function distributeEvenly() {
    const each = Math.floor(100 / categories.length);
    const remainder = 100 - each * categories.length;
    setCategories((prev) =>
      prev.map((c, i) => ({
        ...c,
        weightPct: i === 0 ? each + remainder : each,
      }))
    );
  }

  function applyPreset(preset: { categories: { name: string; weight: number; dropLowest: number }[] }) {
    setCategories(
      preset.categories.map((c) => ({
        id: nextId(),
        name: c.name,
        weightPct: Math.round(c.weight * 100),
        dropLowest: c.dropLowest,
      }))
    );
    setShowPresetsPanel(false);
  }

  function handleSave() {
    if (!isValid) return;
    const templates = toTemplates(categories);
    saveLocalWeightTemplates(courseId, templates); // persist to localStorage
    onSave(templates);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleSavePreset() {
    if (!presetSaveName.trim() || !onSaveAsPreset) return;
    onSaveAsPreset(
      presetSaveName.trim(),
      categories.map((c) => ({ name: c.name, weight: c.weightPct / 100, dropLowest: c.dropLowest }))
    );
    setPresetSaveName("");
    setShowPresetSaveInput(false);
  }

  // ── Color coding for weight bars ─────────────────────────────────────────
  const COLORS = [
    "#818CF8", "#34D399", "#F59E0B", "#F87171", "#60A5FA", "#A78BFA", "#FB923C",
  ];

  // ── Render ───────────────────────────────────────────────────────────────

  const editorContent = (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-[#E8ECFF]">
            Set Up Grade Categories
          </h3>
          <p className="text-xs text-[#8B98B8] mt-0.5 max-w-xs">
            {courseName} — define how each category is weighted so Vela can
            calculate your grade accurately.
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-[#4A5578] hover:text-[#E8ECFF] transition-colors ml-4 flex-shrink-0"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Presets toggle */}
      <button
        onClick={() => setShowPresetsPanel((v) => !v)}
        className="flex items-center justify-between w-full rounded-lg border border-[#818CF8]/30 bg-[#818CF8]/8 px-4 py-2.5 text-sm text-[#A5B4FC] hover:bg-[#818CF8]/15 transition-all"
      >
        <span className="flex items-center gap-2">
          <Zap size={14} />
          Apply a preset template
        </span>
        {showPresetsPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {/* Presets panel */}
      {showPresetsPanel && (
        <div className="rounded-xl border border-[#1C2A45]/60 bg-[#0C1220]/60 p-3 space-y-2 animate-fade-in">
          <p className="text-[10px] uppercase tracking-wider text-[#4A5578] font-medium px-1">
            Built-in
          </p>
          <div className="grid grid-cols-2 gap-2">
            {BUILT_IN_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                className="text-left rounded-lg border border-[#1C2A45]/60 bg-[#101828]/60 px-3 py-2.5 hover:border-[#818CF8]/40 hover:bg-[#162032]/60 transition-all group"
              >
                <p className="text-sm">{preset.emoji}</p>
                <p className="text-xs font-medium text-[#C8D0E8] mt-1 group-hover:text-[#E8ECFF]">
                  {preset.name}
                </p>
                <p className="text-[10px] text-[#4A5578] mt-0.5">
                  {preset.categories.map((c) => `${c.name} ${Math.round(c.weight * 100)}%`).join(" · ")}
                </p>
              </button>
            ))}
          </div>

          {userPresets.length > 0 && (
            <>
              <p className="text-[10px] uppercase tracking-wider text-[#4A5578] font-medium px-1 pt-2">
                Your Presets
              </p>
              <div className="grid grid-cols-2 gap-2">
                {userPresets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => applyPreset({ categories: preset.categories.map(c => ({ name: c.name, weight: c.weight, dropLowest: c.dropLowest })) })}
                    className="text-left rounded-lg border border-[#818CF8]/20 bg-[#818CF8]/5 px-3 py-2.5 hover:border-[#818CF8]/40 hover:bg-[#818CF8]/10 transition-all"
                  >
                    <p className="text-xs font-medium text-[#A5B4FC]">
                      {preset.name}
                    </p>
                    <p className="text-[10px] text-[#4A5578] mt-0.5">
                      {preset.categories.map((c) => `${c.name} ${Math.round(c.weight * 100)}%`).join(" · ")}
                    </p>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Weight visualization bar */}
      {categories.length > 0 && total > 0 && (
        <div className="h-2 rounded-full overflow-hidden flex gap-0.5">
          {categories.map((c, i) => (
            <div
              key={c.id}
              style={{
                width: `${(c.weightPct / Math.max(total, 100)) * 100}%`,
                backgroundColor: COLORS[i % COLORS.length],
                transition: "width 0.3s ease",
              }}
              className="h-full rounded-full"
            />
          ))}
          {total < 100 && (
            <div
              style={{ width: `${100 - total}%` }}
              className="h-full rounded-full bg-[#1C2A45]"
            />
          )}
        </div>
      )}

      {/* Categories list */}
      <div className="space-y-2">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_80px_64px_32px] gap-2 px-1">
          <p className="text-[10px] uppercase tracking-wider text-[#4A5578]">Category</p>
          <p className="text-[10px] uppercase tracking-wider text-[#4A5578] text-center">Weight %</p>
          <p className="text-[10px] uppercase tracking-wider text-[#4A5578] text-center">Drop ↓</p>
          <div />
        </div>

        {categories.map((cat, i) => (
          <div
            key={cat.id}
            className="grid grid-cols-[1fr_80px_64px_32px] gap-2 items-center"
          >
            {/* Color dot + name */}
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <input
                type="text"
                value={cat.name}
                onChange={(e) => updateCategory(cat.id, "name", e.target.value)}
                placeholder="e.g. Tests"
                className="w-full rounded-md border border-[#1C2A45]/50 bg-[#0C1220]/60 px-3 py-1.5 text-sm text-[#E8ECFF] placeholder-[#4A5578] outline-none focus:border-[#818CF8]/50 transition-all"
              />
            </div>

            {/* Weight % input */}
            <div className="relative">
              <input
                type="number"
                min={0}
                max={100}
                value={cat.weightPct}
                onChange={(e) =>
                  updateCategory(cat.id, "weightPct", Number(e.target.value))
                }
                className="w-full rounded-md border border-[#1C2A45]/50 bg-[#0C1220]/60 px-3 py-1.5 text-sm text-[#E8ECFF] text-center outline-none focus:border-[#818CF8]/50 transition-all"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#4A5578]">
                %
              </span>
            </div>

            {/* Drop lowest */}
            <input
              type="number"
              min={0}
              max={10}
              value={cat.dropLowest}
              onChange={(e) =>
                updateCategory(cat.id, "dropLowest", Number(e.target.value))
              }
              className="rounded-md border border-[#1C2A45]/50 bg-[#0C1220]/60 px-3 py-1.5 text-sm text-[#E8ECFF] text-center outline-none focus:border-[#818CF8]/50 transition-all"
            />

            {/* Remove */}
            <button
              onClick={() => removeCategory(cat.id)}
              disabled={categories.length <= 1}
              className="flex items-center justify-center p-1 rounded text-[#4A5578] hover:text-rose-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Validation + total */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Math.abs(total - 100) > 0.5 && (
            <span className="flex items-center gap-1.5 text-xs text-amber-400">
              <AlertCircle size={12} />
              Total: {total}% (needs 100%)
            </span>
          )}
          {Math.abs(total - 100) <= 0.5 && total > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <Check size={12} />
              Total: 100%
            </span>
          )}
        </div>
        <button
          onClick={distributeEvenly}
          className="text-xs text-[#818CF8] hover:text-[#A5B4FC] transition-colors underline-offset-2 hover:underline"
        >
          Distribute evenly
        </button>
      </div>

      {/* Add category */}
      <button
        onClick={addCategory}
        className="flex items-center gap-2 text-sm text-[#8B98B8] hover:text-[#E8ECFF] transition-colors"
      >
        <Plus size={14} />
        Add category
      </button>

      {/* Save as preset section */}
      {onSaveAsPreset && (
        <div className="border-t border-[#1C2A45]/40 pt-3">
          {!showPresetSaveInput ? (
            <button
              onClick={() => setShowPresetSaveInput(true)}
              className="text-xs text-[#4A5578] hover:text-[#818CF8] transition-colors"
            >
              + Save as global preset for other courses
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={presetSaveName}
                onChange={(e) => setPresetSaveName(e.target.value)}
                placeholder="Preset name (e.g. My School Default)"
                className="flex-1 rounded-md border border-[#818CF8]/30 bg-[#0C1220]/60 px-3 py-1.5 text-xs text-[#E8ECFF] placeholder-[#4A5578] outline-none focus:border-[#818CF8]/50"
                autoFocus
              />
              <button
                onClick={handleSavePreset}
                disabled={!presetSaveName.trim()}
                className="px-3 py-1.5 text-xs rounded-md bg-[#818CF8]/15 border border-[#818CF8]/30 text-[#A5B4FC] hover:bg-[#818CF8]/25 disabled:opacity-40 transition-all"
              >
                Save
              </button>
              <button
                onClick={() => setShowPresetSaveInput(false)}
                className="text-[#4A5578] hover:text-[#E8ECFF]"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main save button */}
      <button
        onClick={handleSave}
        disabled={!isValid}
        className={`w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all duration-200 ${
          saved
            ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
            : isValid
            ? "bg-[#818CF8] text-white hover:bg-[#6366F1] shadow-[0_0_16px_rgba(129,140,248,0.25)]"
            : "bg-[#1C2A45]/60 text-[#4A5578] cursor-not-allowed"
        }`}
      >
        {saved ? (
          <>
            <Check size={14} />
            Saved!
          </>
        ) : (
          <>
            <Save size={14} />
            Save Weight Categories
          </>
        )}
      </button>
    </div>
  );

  if (inline) {
    return (
      <div className="rounded-xl border border-[#818CF8]/25 bg-[#0D1525]/80 backdrop-blur-sm p-5">
        {editorContent}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#090C15]/80 backdrop-blur-sm px-4 py-6">
      <div className="w-full max-w-md bg-[#101828] border border-[#1C2A45] rounded-2xl p-6 animate-fade-in shadow-2xl max-h-[90vh] overflow-y-auto">
        {editorContent}
      </div>
    </div>
  );
}
