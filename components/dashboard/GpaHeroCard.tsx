import { Card } from "@/components/ui/Card";
import { TrendChart } from "@/components/charts/TrendChart";
import { formatGpa } from "@/lib/utils";

interface Props {
  gpa: number;
  termGpa: number;
  termLabel: string;
  termDelta: number;
  history: Array<{ date: string; gpa: number; term: number }>;
}

export function GpaHeroCard({ gpa, termGpa, termLabel, termDelta, history }: Props) {
  const deltaPositive = termDelta >= 0;
  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-[#0C1220]/90 via-[#101828]/80 to-[#162032]/70 border-[#253A5E]/50">
      {/* Nebula glow accent */}
      <div className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full bg-[#818CF8]/[0.04] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-[#6366F1]/[0.03] blur-2xl" />

      {/* Constellation watermark with glow */}
      <div className="pointer-events-none absolute right-4 bottom-4 select-none animate-constellation">
        <svg width="200" height="160" viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="heroStarGlow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <g stroke="rgba(165,180,252,0.12)" strokeWidth="0.6" fill="none">
            <line x1="48" y1="110" x2="72" y2="80" />
            <line x1="72" y1="80" x2="110" y2="58" />
            <line x1="110" y1="58" x2="148" y2="42" />
            <line x1="148" y1="42" x2="162" y2="70" />
            <line x1="162" y1="70" x2="140" y2="95" />
            <line x1="140" y1="95" x2="72" y2="80" />
          </g>
          <g filter="url(#heroStarGlow)">
            <circle cx="48" cy="110" r="2.5" fill="rgba(165,180,252,0.25)" />
            <circle cx="110" cy="58" r="2.2" fill="rgba(165,180,252,0.2)" />
            <circle cx="148" cy="42" r="1.6" fill="rgba(165,180,252,0.2)" />
          </g>
        </svg>
      </div>

      <div className="relative grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* GPA numbers */}
        <div className="space-y-4">
          <div>
            <p className="mb-1 text-xs uppercase tracking-[0.2em] text-[#8B98B8]">Cumulative GPA (Unweighted)</p>
            <p className="font-mono text-6xl font-bold bg-gradient-to-r from-[#A5B4FC] to-[#818CF8] bg-clip-text text-transparent">{formatGpa(gpa)}</p>
          </div>
          <div className="h-px bg-gradient-to-r from-[#1C2A45] via-[#253A5E] to-transparent" />
          <div>
            <p className="mb-1 text-xs uppercase tracking-[0.2em] text-[#8B98B8]">{termLabel}</p>
            <div className="flex items-end gap-3">
              <p className="font-mono text-4xl font-semibold text-[#E8ECFF]">{formatGpa(termGpa)}</p>
              <span className={`mb-1 text-sm font-medium ${deltaPositive ? "text-emerald-400" : "text-rose-400"}`}>
                {deltaPositive ? "↑" : "↓"} {Math.abs(termDelta).toFixed(2)} from last term
              </span>
            </div>
          </div>
        </div>

        {/* Trend chart */}
        <div>
          <TrendChart data={history} />
        </div>
      </div>
    </Card>
  );
}
