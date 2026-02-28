import { motion } from 'framer-motion';
import { useStore } from '../../store';
import { cn } from '../../lib/utils';
import { Play } from 'lucide-react';

export function DetailPanel() {
    const { selectedBreakId, breaks, investigationStatus, setInvestigationStatus } = useStore();
    const selectedBreak = breaks.find(b => b.id === selectedBreakId);

    if (!selectedBreak) {
        return (
            <div className="flex-1 h-full flex items-center justify-center p-6">
                <motion.div
                    className="flex flex-col items-center gap-3 text-[var(--text-muted)]"
                    animate={{ y: [-4, 4] }}
                    transition={{ duration: 3, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-30"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                    <p className="text-[15px] font-medium">Select a break to investigate</p>
                </motion.div>
            </div>
        );
    }

    const status = investigationStatus[selectedBreak.id] || 'idle';
    const canInvestigate = status === 'idle';

    const handleInvestigate = () => {
        setInvestigationStatus(selectedBreak.id, 'loading');
    };

    const formatCurrency = (val: number | null | undefined) => {
        if (val == null) return '—';
        return `$${Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return (
        <div className="space-y-4 relative">
            {/* Compact Header & Grid */}
            <motion.div
                key={selectedBreak.id}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="bg-[var(--surface)] p-4 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.12)] flex flex-col gap-3"
            >
                <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-1.5">
                        <h2 className="text-[15px] font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                            <span>{selectedBreak.ticker} · {selectedBreak.instrument}</span>
                            <span className={cn(
                                "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                                selectedBreak.severity === 'HIGH' ? "bg-[var(--red-muted)] text-[var(--red)]" :
                                    selectedBreak.severity === 'MEDIUM' ? "bg-[var(--amber-muted)] text-[var(--amber)]" :
                                        "bg-[var(--blue-muted)] text-[var(--blue)]"
                            )}>{selectedBreak.severity}</span>
                        </h2>
                        <div className="text-[12px] text-[var(--text-secondary)] flex items-center gap-1.5">
                            <span className="font-semibold text-[var(--text-primary)] bg-[var(--surface-overlay)] px-1.5 rounded">{selectedBreak.transactionType || '—'}</span>
                            <span className="opacity-40">•</span>
                            <span>{selectedBreak.instrumentType}</span>
                            <span className="opacity-40">•</span>
                            <span>{selectedBreak.currency}</span>
                            <span className="opacity-40">•</span>
                            <span className="truncate max-w-[120px]">{selectedBreak.counterparty}</span>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 text-right flex-shrink-0">
                        <span className="text-[11px] text-[var(--text-muted)] font-tabular">{selectedBreak.refId}</span>
                        {selectedBreak.age !== undefined && (
                            <span className="text-[11px] text-[var(--text-muted)]">{selectedBreak.age}d old</span>
                        )}
                    </div>
                </div>

                <div className="border-t border-[var(--border-subtle)]" />

                <div className="grid grid-cols-4 grid-rows-2 gap-y-2 gap-x-3 py-1">
                    <Cell label="Internal Qty" value={selectedBreak.internalQty?.toLocaleString() || '—'} />
                    <Cell label="Street Qty" value={selectedBreak.streetQty?.toLocaleString() || '—'} />
                    <Cell label="Trade Date" value={selectedBreak.tradeDate || '—'} />
                    <Cell label="Settlement" value={selectedBreak.settlementDate || '—'} />
                    <Cell label="Internal MV" value={formatCurrency(selectedBreak.mvInternal)} />
                    <Cell label="Street MV" value={formatCurrency(selectedBreak.mvStreet)} />
                    <Cell label="MV Diff" value={formatCurrency(selectedBreak.mvDiff)} highlight={selectedBreak.mvDiff > 0 ? 'green' : 'red'} />
                    <Cell label="Tolerance" value={selectedBreak.toleranceFlag || '—'} highlight={selectedBreak.toleranceFlag === 'BREACH' ? 'red' : undefined} />
                </div>
            </motion.div>

            {/* Investigate Button */}
            {canInvestigate && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
                    <button
                        onClick={handleInvestigate}
                        className="w-full bg-[var(--accent)] text-[var(--accent-text)] rounded-xl h-[52px] text-[15px] font-semibold flex items-center justify-center gap-2 hover:-translate-y-[1px] hover:shadow-lg transition-all duration-150 relative overflow-hidden group"
                    >
                        <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-5 transition-opacity" />
                        <Play size={16} strokeWidth={2.5} />
                        Run AI Investigation
                    </button>
                </motion.div>
            )}
        </div>
    );
}

function Cell({ label, value, highlight }: { label: string; value: string; highlight?: 'green' | 'red' }) {
    return (
        <div className="flex flex-col gap-1 p-2 rounded-lg hover:bg-[var(--surface-overlay)] transition-colors">
            <span className="text-[10px] uppercase tracking-[0.06em] text-[var(--text-muted)] font-semibold">{label}</span>
            <span className={cn(
                "text-[15px] font-semibold truncate font-tabular",
                highlight === 'green' ? 'text-[var(--green)]' : highlight === 'red' ? 'text-[var(--red)]' : 'text-[var(--text-primary)]'
            )}>{value}</span>
        </div>
    );
}
