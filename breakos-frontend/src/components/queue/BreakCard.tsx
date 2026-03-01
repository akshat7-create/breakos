import { BreakRecord } from '../../store';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useStore } from '../../store';

interface BreakCardProps {
    data: BreakRecord;
    index: number;
}

const severityColors = {
    HIGH: { bg: 'bg-[var(--red-muted)]', text: 'text-[var(--red)]', border: 'var(--red)' },
    MEDIUM: { bg: 'bg-[var(--amber-muted)]', text: 'text-[var(--amber)]', border: 'var(--amber)' },
    LOW: { bg: 'bg-[var(--blue-muted)]', text: 'text-[var(--blue)]', border: 'var(--blue)' },
};

export function BreakCard({ data, index }: BreakCardProps) {
    const { selectedBreakId, setSelectedBreakId } = useStore();
    const isSelected = selectedBreakId === data.id;
    const sev = severityColors[data.severity] || severityColors.MEDIUM;

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: index * 0.05 }}
            onClick={() => setSelectedBreakId(data.id)}
            className={cn(
                "group relative w-full bg-[var(--surface)] border border-[var(--border-subtle)] rounded-2xl p-4 cursor-pointer transition-all duration-300 ease-out",
                "border-l-[4px] hover:-translate-y-[2px] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]",
                isSelected
                    ? "shadow-[0_0_0_2px_var(--accent)] bg-[var(--accent-muted)] border-[var(--accent)]"
                    : "shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
            )}
            style={{ borderLeftColor: isSelected ? 'var(--accent)' : data.status === 'investigated' ? 'var(--green)' : data.status === 'pre-triage' ? 'var(--border)' : sev.border }}
        >
            {/* Pre-triage */}
            {data.status === 'pre-triage' && (
                <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                        <span className="text-[15px] font-medium text-[var(--text-primary)] tracking-tight">{data.ticker}</span>
                        <span className="text-[12px] text-[var(--text-muted)] font-mono">{data.refId}</span>
                    </div>
                    <div className="text-[13px] text-[var(--text-secondary)] font-medium truncate">
                        {data.instrument} · {data.currency} · {data.counterparty}
                    </div>
                    <div className="text-[12px] text-[var(--text-muted)] mt-1 tracking-wide">Awaiting triage...</div>
                </div>
            )}

            {/* Triaged */}
            {data.status === 'triaged' && (
                <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2.5">
                            <span className={cn("px-2 py-0.5 rounded-md text-[10px] uppercase font-bold tracking-wider", sev.bg, sev.text)}>
                                {data.severity}
                            </span>
                            <span className="text-[15px] font-medium text-[var(--text-primary)] tracking-tight">{data.ticker}</span>
                        </div>
                        <span className="text-[12px] text-[var(--text-muted)] font-mono">{data.refId}</span>
                    </div>
                    <div className="text-[13px] text-[var(--text-secondary)] line-clamp-2 leading-relaxed font-medium">
                        {data.aiAssessment}
                    </div>
                    <div className="flex justify-between items-center mt-1">
                        <span className="text-[12px] text-[var(--text-muted)] tracking-wide">→ Route: {data.route}</span>
                        <span className="text-[13px] font-medium text-[var(--text-primary)] font-mono">{data.confidence}%</span>
                    </div>
                </div>
            )}

            {/* Investigated */}
            {data.status === 'investigated' && (
                <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-[var(--green-muted)] flex items-center justify-center">
                                <Check size={12} className="text-[var(--green)]" strokeWidth={3} />
                            </div>
                            <span className="text-[15px] font-medium text-[var(--text-primary)] tracking-tight">{data.ticker}</span>
                        </div>
                        <span className="text-[12px] text-[var(--text-muted)] font-mono">{data.refId}</span>
                    </div>
                    <div className="text-[13px] text-[var(--text-secondary)] font-medium truncate pt-1 tracking-wide">Investigation complete ✓</div>
                </div>
            )}
        </motion.div>
    );
}
