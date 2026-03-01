import { useStore } from '../../store';
import { BreakCard } from './BreakCard';
import { RefreshCw, SlidersHorizontal } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useState } from 'react';
import { runTriage } from '../../lib/api';

const severityFilters = ['All', 'High', 'Medium', 'Low'] as const;
const instrumentFilters = ['All Types', 'Equity', 'Fixed Income', 'ETF', 'FX', 'Derivative'] as const;

export function BreakQueue() {
    const { breaks, triageStatus, setTriageStatus, setBreaks } = useStore();
    const [activeSeverity, setActiveSeverity] = useState<string>('All');
    const [activeInstrument, setActiveInstrument] = useState<string>('All Types');
    const [showInstrumentFilter, setShowInstrumentFilter] = useState(true);

    const filteredBreaks = breaks.filter(b => {
        const sevMatch = activeSeverity === 'All' || b.severity.toLowerCase() === activeSeverity.toLowerCase();
        const instMatch = activeInstrument === 'All Types' || matchesInstrumentType(b.instrumentType, activeInstrument);
        return sevMatch && instMatch;
    });

    const handleTriage = async () => {
        if (triageStatus === 'loading') return;
        setTriageStatus('loading');
        try {
            const result = await runTriage();
            setBreaks(result.breaks);
            setTriageStatus('complete');
        } catch (err) {
            console.error('Triage failed:', err);
            setTriageStatus('idle');
        }
    };

    return (
        <div className="w-[340px] flex-shrink-0 border-r border-[var(--border-subtle)] bg-[var(--bg)] flex flex-col h-full">
            <div className="px-5 pt-5 pb-3 flex-shrink-0">
                <div className="flex justify-between items-center mb-5">
                    <div>
                        <h2 className="text-[17px] font-semibold text-[var(--text-primary)] tracking-tight">Break Queue</h2>
                        <span className="text-[13px] text-[var(--text-muted)] mt-0.5 block">{filteredBreaks.length} items</span>
                    </div>
                    <button
                        onClick={() => setShowInstrumentFilter(!showInstrumentFilter)}
                        className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ease-out border border-transparent",
                            showInstrumentFilter
                                ? "bg-[var(--accent)] text-[var(--accent-text)] shadow-sm"
                                : "text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] hover:border-[var(--border-subtle)]"
                        )}
                    >
                        <SlidersHorizontal size={15} />
                    </button>
                </div>

                <button
                    onClick={handleTriage}
                    disabled={triageStatus === 'loading' || breaks.length === 0}
                    className={cn(
                        "w-full bg-[var(--accent)] text-[var(--accent-text)] font-semibold text-[14px] py-3 rounded-2xl flex items-center justify-center gap-2.5 transition-all duration-300 ease-out shadow-sm",
                        "hover:-translate-y-[1px] hover:shadow-md",
                        (triageStatus === 'loading' || breaks.length === 0) && "opacity-50 cursor-not-allowed transform-none"
                    )}
                >
                    <RefreshCw size={15} className={cn(triageStatus === 'loading' && "animate-spin")} />
                    {triageStatus === 'loading' ? 'Running Triage...' : 'Run Quick Triage'}
                </button>
            </div>

            {/* Severity Filter */}
            <div className="px-5 py-2.5 flex-shrink-0">
                <div className="flex gap-2">
                    {severityFilters.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveSeverity(tab)}
                            className={cn(
                                "px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all duration-300 border",
                                activeSeverity === tab
                                    ? "bg-[var(--accent)] text-[var(--accent-text)] border-transparent shadow-sm"
                                    : "text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-overlay)]"
                            )}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* Instrument Type Filter */}
            {
                showInstrumentFilter && (
                    <div className="px-5 py-3 flex-shrink-0 border-t border-[var(--border-subtle)] mt-1">
                        <span className="text-[11px] uppercase text-[var(--text-muted)] font-semibold tracking-widest mb-2.5 block">Security Type</span>
                        <div className="flex gap-2 flex-wrap">
                            {instrumentFilters.map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveInstrument(tab)}
                                    className={cn(
                                        "px-3 py-1 rounded-full text-[12px] font-medium transition-all duration-300 border",
                                        activeInstrument === tab
                                            ? "bg-[var(--text-primary)] text-[var(--surface)] border-transparent shadow-sm"
                                            : "text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-overlay)]"
                                    )}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                    </div>
                )
            }

            <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-3 pt-3">
                {filteredBreaks.map((b, i) => (
                    <BreakCard key={b.id} data={b} index={i} />
                ))}
                {filteredBreaks.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-40 text-[var(--text-muted)] gap-2">
                        <span className="text-[14px] font-medium">{breaks.length === 0 ? 'No breaks loaded' : 'No matches found'}</span>
                        <span className="text-[12px] text-[var(--text-secondary)]">Try adjusting your filters</span>
                    </div>
                )}
            </div>
        </div >
    );
}

function matchesInstrumentType(instType: string | null, filter: string): boolean {
    if (!instType) return false;
    const lower = instType.toLowerCase();
    switch (filter) {
        case 'Equity': return lower.includes('equity') || lower.includes('stock') || lower.includes('common');
        case 'Fixed Income': return lower.includes('bond') || lower.includes('fixed') || lower.includes('note') || lower.includes('treasury');
        case 'ETF': return lower.includes('etf') || lower.includes('fund') || lower.includes('index');
        case 'FX': return lower.includes('fx') || lower.includes('currency') || lower.includes('forex');
        case 'Derivative': return lower.includes('option') || lower.includes('future') || lower.includes('swap') || lower.includes('deriv');
        default: return true;
    }
}
