import { AdvisorCard } from "@/components/advisor/AdvisorCard";
import { Compass } from "lucide-react";

interface AdvisorLog {
  id: string;
  logType: string;
  severity: string;
  title: string;
  body: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

export function AdvisorFeed({ logs, isDropdown = false }: { logs: AdvisorLog[], isDropdown?: boolean }) {
  return (
    <div className="space-y-3">
      {!isDropdown && (
        <h2 className="text-[10px] uppercase tracking-[0.2em] text-[#8B98B8] flex items-center gap-2">
          <Compass size={12} className="text-[#818CF8]" />
          Advisor Feed
        </h2>
      )}
      {logs.length === 0 ? (
        <div className="rounded-xl border border-[#1C2A45]/60 bg-[#101828]/50 backdrop-blur-sm p-8 text-center">
          <svg width="80" height="64" viewBox="0 0 200 160" className="mx-auto mb-3" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="emptyStarGlow">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <g stroke="rgba(165,180,252,0.15)" strokeWidth="0.6" fill="none">
              <line x1="48" y1="110" x2="72" y2="80" /><line x1="72" y1="80" x2="110" y2="58" />
              <line x1="110" y1="58" x2="148" y2="42" /><line x1="148" y1="42" x2="162" y2="70" />
            </g>
            <g filter="url(#emptyStarGlow)" opacity="0.3">
              <circle cx="48" cy="110" r="2.5" fill="#A5B4FC" /><circle cx="72" cy="80" r="1.8" fill="#A5B4FC" />
              <circle cx="110" cy="58" r="2.2" fill="#818CF8" /><circle cx="148" cy="42" r="1.6" fill="#A5B4FC" />
            </g>
          </svg>
          <p className="text-sm text-[#8B98B8]">All clear — no advisor notices.</p>
          <p className="text-[10px] text-[#4A5578] mt-1">Stars aligned in your favor ✦</p>
        </div>
      ) : (
        logs.map((log) => <AdvisorCard key={log.id} log={log} />)
      )}
    </div>
  );
}
