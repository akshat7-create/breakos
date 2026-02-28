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
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: index * 0.06 }}
            onClick={() => setSelectedBreakId(data.id)}
            className={cn(
                "group relative w-full bg-[var(--surface)] rounded-2xl p-4 cursor-pointer transition-all duration-200",
                "border-l-[3px] hover:-translate-y-[2px] hover:shadow-[0_8px_24px_rgba(0,0,0,0.15)]",
                isSelected
                    ? "shadow-[0_0_0_2px_var(--accent)] bg-[var(--accent-muted)]"
                    : "shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
            )}
            style={{ borderLeftColor: data.status === 'investigated' ? 'var(--green)' : data.status === 'pre-triage' ? 'var(--border)' : sev.border }}
        >
            {/* Pre-triage */}
            {data.status === 'pre-triage' && (
                <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                        <span className="text-[14px] font-semibold text-[var(--text-primary)]">{data.ticker}</span>
                        <span className="text-[11px] text-[var(--text-muted)] font-tabular">{data.refId}</span>
                    </div>
                    <div className="text-[12px] text-[var(--text-secondary)] truncate">
                        {data.instrument} · {data.currency} · {data.counterparty}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-0.5 italic">Awaiting triage</div>
                </div>
            )}

            {/* Triaged */}
            {data.status === 'triaged' && (
                <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <span className={cn("px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider", sev.bg, sev.text)}>
                                {data.severity}
                            </span>
                            <span className="text-[14px] font-semibold text-[var(--text-primary)]">{data.ticker}</span>
                        </div>
                        <span className="text-[11px] text-[var(--text-muted)] font-tabular">{data.refId}</span>
                    </div>
                    <div className="text-[12px] text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                        {data.aiAssessment}
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-[11px] text-[var(--text-muted)]">→ {data.route}</span>
                        <span className="text-[12px] font-bold text-[var(--text-primary)] font-tabular">{data.confidence}%</span>
                    </div>
                </div>
            )}

            {/* Investigated */}
            {data.status === 'investigated' && (
                <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Check size={14} className="text-[var(--green)]" strokeWidth={3} />
                            <span className="text-[14px] font-semibold text-[var(--text-primary)]">{data.ticker}</span>
                        </div>
                        <span className="text-[11px] text-[var(--text-muted)] font-tabular">{data.refId}</span>
                    </div>
                    <div className="text-[12px] text-[var(--text-secondary)] truncate">Investigation complete</div>
                </div>
            )}
        </motion.div>
    );
}
