// app/api/classroom/presets/route.ts
// Manages global weight presets (reusable, not tied to a specific course).
// GET  ?userId=Y → { presets: WeightPreset[] }
// POST { userId, name, categories } → { preset: WeightPreset }
// DELETE { presetId } → { success: true }

import { NextRequest, NextResponse } from "next/server";

export interface WeightPresetCategory {
  name: string;
  weight: number;    // fraction 0–1
  dropLowest: number;
}

export interface WeightPreset {
  id: string;
  name: string;
  categories: WeightPresetCategory[];
  createdAt: string;
}

// In-memory store for hackathon demo mode.
// In production: replace with Prisma ClassroomWeightPreset queries.
const presetStore = new Map<string, WeightPreset[]>();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const presets = presetStore.get(userId) ?? [];
  return NextResponse.json({ presets });
}

export async function POST(req: NextRequest) {
  try {
    const { userId, name, categories } = await req.json();

    if (!userId || !name || !Array.isArray(categories)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Validate weights
    const total = categories.reduce(
      (sum: number, c: WeightPresetCategory) => sum + c.weight,
      0
    );
    if (Math.abs(total - 1.0) > 0.01) {
      return NextResponse.json(
        { error: `Weights must sum to 100% (got ${(total * 100).toFixed(1)}%)` },
        { status: 400 }
      );
    }

    const preset: WeightPreset = {
      id: `preset_${Date.now()}`,
      name,
      categories,
      createdAt: new Date().toISOString(),
    };

    const existing = presetStore.get(userId) ?? [];
    presetStore.set(userId, [...existing, preset]);

    // TODO: prisma.classroomWeightPreset.create({ data: { userId, name, categories } })

    return NextResponse.json({ preset });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId, presetId } = await req.json();
    if (!userId || !presetId) {
      return NextResponse.json({ error: "Missing userId or presetId" }, { status: 400 });
    }

    const existing = presetStore.get(userId) ?? [];
    presetStore.set(userId, existing.filter((p) => p.id !== presetId));

    // TODO: prisma.classroomWeightPreset.delete({ where: { id: presetId } })

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
