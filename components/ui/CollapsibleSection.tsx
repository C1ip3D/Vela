"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface Props {
    title: string;
    defaultOpen?: boolean;
    count?: number;
    children: React.ReactNode;
}

export function CollapsibleSection({ title, defaultOpen = true, count, children }: Props) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className="space-y-2">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between group"
            >
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-[#8B98B8] group-hover:text-[#A5B4FC] transition-colors">
                        {title}
                    </h2>
                    {count !== undefined && count > 0 && (
                        <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#818CF8]/15 px-1.5 text-[9px] font-bold text-[#A5B4FC]">
                            {count}
                        </span>
                    )}
                </div>
                <div className="flex h-5 w-5 items-center justify-center rounded-md text-[#4A5578] group-hover:text-[#8B98B8] group-hover:bg-[#162032]/60 transition-all">
                    {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </div>
            </button>
            <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${open ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
                    }`}
            >
                <div className="space-y-2">
                    {children}
                </div>
            </div>
        </div>
    );
}
