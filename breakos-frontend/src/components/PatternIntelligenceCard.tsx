import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Network, History, Loader2, ServerCrash, Shield, Clock, AlertTriangle, Coins, GitMerge } from 'lucide-react';
import { useStore } from '../store';
import { synthesizePattern } from '../lib/api';
import {
    seedHistoryIfNeeded,
    computeSignals,
    getHistoricalMatches,
    writeSessionPattern,
    PatternSignal,
    HistoricalMatch
} from '../lib/patternMemory';
import { cn } from '../lib/utils';

export function PatternIntelligenceCard({ forBreakId }: { forBreakId?: string }) {
    const { breaks, triageStatus, setActiveView } = useStore();

    const [signals, setSignals] = useState<PatternSignal[]>([]);
    const [historyMatches, setHistoryMatches] = useState<HistoricalMatch[]>([]);
    const [insight, setInsight] = useState<string>('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    useEffect(() => {
        if (breaks.length < 2) return;

        seedHistoryIfNeeded();

        const currentSignals = computeSignals(breaks);

        const relevantSignals = forBreakId
            ? currentSignals.filter(s => s.affectedBreakIds.includes(forBreakId))
            : currentSignals;

        setSignals(relevantSignals);

        const totalMV = breaks.reduce((sum, b) => sum + Math.abs(b.mvDiff || 0), 0);
        writeSessionPattern('current-session', currentSignals, breaks.length, totalMV);

        if (relevantSignals.length === 0) {
            return;
        }

        const matches = getHistoricalMatches(relevantSignals);
        setHistoryMatches(matches);

        setIsAnalyzing(true);

        synthesizePattern(breaks.length, totalMV, relevantSignals, matches)
            .then((res: any) => setInsight(res.insight))
            .catch((err: any) => {
                console.error("Pattern synthesis failed:", err);
                setInsight("Systemic pattern analysis temporarily unavailable. Proceed with individual break investigations.");
            })
            .finally(() => setIsAnalyzing(false));

    }, [breaks, triageStatus, forBreakId]); // Re-run when breaks change or triage finishes

    if (breaks.length < 2 || signals.length === 0) return null;

    const totalMV = breaks.reduce((sum, b) => sum + Math.abs(b.mvDiff || 0), 0);

    const getPatternName = (fp: string) => {
        if (fp.startsWith('counterparty_cluster:CDS')) return 'CDS counterparty clustering';
        if (fp.startsWith('counterparty_cluster:DTC')) return 'DTC counterparty clustering';
        if (fp === 'break_type_cluster:pricing_difference') return 'Pricing difference cluster';
        if (fp === 'break_type_cluster:corporate_action_dividend') return 'CA dividend processing lag';
        if (fp === 'break_type_cluster:timing_difference') return 'Timing difference cluster';
        if (fp === 'mixed_ca_event:dividend_and_merger_same_day') return 'Mixed CA event (div + merger)';
        if (fp === 'settlement_urgency:T+0') return 'Same-day settlement urgency';
        if (fp === 'mv_concentration:top3_over_80pct') return 'MV exposure concentration';
        return fp; // fallback
    };

    const getSignalIcon = (type: string) => {
        switch (type) {
            case 'counterparty': return <Shield size={12} />;
            case 'break_type': return <AlertTriangle size={12} />;
            case 'settlement': return <Clock size={12} />;
            case 'mv': return <ServerCrash size={12} />;
            case 'currency': return <Coins size={12} />;
            case 'ca_event': return <GitMerge size={12} />;
            default: return <Network size={12} />;
        }
    };

    const getSignalColor = (s: PatternSignal) => {
        switch (s.type) {
            case 'counterparty': return "bg-[var(--amber-muted)] text-[var(--amber)] border border-[var(--amber-muted)]";
            case 'break_type': return "bg-[var(--blue-muted)] text-[var(--blue)] border border-[var(--blue-muted)]";
            case 'settlement': return "bg-[var(--red-muted)] text-[var(--red)] border border-[var(--red-muted)]";
            case 'mv': return "bg-[var(--red-muted)] text-[var(--red)] border border-[var(--red-muted)]";
            case 'currency': return "bg-[var(--green-muted)] text-[var(--green)] border border-[var(--green-muted)]";
            case 'ca_event': return "bg-[#8b5cf620] text-[#a78bfa] border border-[#8b5cf640]";
            default: return "bg-[var(--surface-overlay)] text-[var(--text-primary)] border border-[var(--border)]";
        }
    };

    // Extract unique TICKERS from affected breaks
    const affectedIds = new Set<string>();
    signals.forEach(s => s.affectedBreakIds.forEach(id => affectedIds.add(id)));
    const affectedTickers = breaks
        .filter(b => affectedIds.has(b.id))
        .map(b => b.ticker)
        .filter((v, i, a) => a.indexOf(v) === i); // unique

    const totalRecurrences = historyMatches.reduce((sum, h) => sum + h.totalOccurrences, 0);

    // Dynamic Insight Parsing
    let issueText = insight;
    let resolutionText = '';
    if (insight.includes('ISSUE:') && insight.includes('RECOMMENDED RESOLUTION:')) {
        const parts = insight.split('RECOMMENDED RESOLUTION:');
        issueText = parts[0].replace('ISSUE:', '').trim();
        resolutionText = parts[1].trim();
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
            className="bg-[var(--surface)] rounded-[20px] border-l-4 border-[var(--accent)] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.15)] mb-6"
        >
            {/* HEADER ROW */}
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Network size={16} className="text-[var(--accent)]" />
                        <h3 className="text-[11px] font-bold text-[var(--accent)] uppercase tracking-[0.08em]">
                            Pattern Intelligence
                        </h3>
                    </div>
                    <p className="text-[12px] text-[var(--text-secondary)]">
                        {breaks.length} breaks · ${totalMV.toLocaleString(undefined, { maximumFractionDigits: 0 })} exposure · {historyMatches.length} historical matches found
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {isAnalyzing ? (
                        <div className="flex items-center gap-2 text-[var(--amber)]">
                            <Loader2 size={12} className="animate-spin" />
                            <span className="text-[12px] font-medium">Analyzing...</span>
                        </div>
                    ) : (
                        <div className={cn("text-[12px] font-medium flex items-center gap-1.5", totalRecurrences > 0 ? "text-[var(--green)]" : "text-[var(--text-muted)]")}>
                            <span className="text-[8px]">●</span>
                            {totalRecurrences > 0 ? `${totalRecurrences} recurrences in 30d` : 'First occurrence'}
                        </div>
                    )}
                </div>
            </div>

            <div className="h-[1px] w-full bg-[var(--border)] my-4" />

            {/* AI INSIGHT */}
            <div className="min-h-[60px]">
                {isAnalyzing ? (
                    <div className="animate-pulse flex flex-col gap-2 pt-1">
                        <div className="h-4 bg-[var(--surface-overlay)] rounded w-full"></div>
                        <div className="h-4 bg-[var(--surface-overlay)] rounded w-[90%]"></div>
                        <div className="h-4 bg-[var(--surface-overlay)] rounded w-[75%]"></div>
                    </div>
                ) : (
                    resolutionText ? (
                        <div className="flex flex-col gap-3">
                            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl p-4">
                                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">Detected Issue</span>
                                <p className="text-[14px] text-[var(--text-primary)] leading-[1.6]">{issueText}</p>
                            </div>
                            <div className="bg-[rgba(139,92,246,0.08)] border border-[rgba(139,92,246,0.2)] rounded-xl p-4">
                                <span className="text-[10px] font-bold text-[#a78bfa] uppercase tracking-wider block mb-1">Recommended Resolution</span>
                                <p className="text-[14px] text-[#ddd6fe] leading-[1.6]">{resolutionText}</p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-[14px] font-[var(--font-sans)] text-[var(--text-primary)] leading-[1.75]">{insight}</p>
                    )
                )}
            </div>

            {/* TODAY'S SIGNALS */}
            {signals.length > 0 && (
                <div className="mt-5">
                    <span className="text-[10px] uppercase text-[var(--text-muted)] font-bold tracking-wider block mb-2">TODAY</span>
                    <div className="flex flex-wrap gap-2">
                        {signals.map((s, i) => (
                            <motion.div
                                key={s.fingerprint}
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: "spring", delay: i * 0.06 }}
                                className={cn(
                                    "px-[14px] py-[6px] rounded-full text-[12px] font-medium flex items-center gap-2 border",
                                    getSignalColor(s),
                                    s.urgent && "animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.3)]"
                                )}
                            >
                                {getSignalIcon(s.type)}
                                {s.label}
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}

            {/* HISTORICAL MATCHES */}
            {historyMatches.length > 0 && (
                <>
                    <div className="h-[1px] w-full bg-[var(--border)] mt-6 mb-4" />
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <History size={14} className="text-[var(--text-muted)]" />
                            <span className="text-[10px] uppercase text-[var(--text-muted)] font-bold tracking-wider">Recurring Patterns</span>
                        </div>
                        <span className="text-[10px] text-[var(--text-muted)] font-medium">Past 30 days</span>
                    </div>

                    <div className="space-y-0">
                        {historyMatches.map((m, i) => {
                            const mostRecent = m.occurrences[0];
                            const dotColor = m.totalOccurrences >= 3 ? 'bg-[var(--accent)]' : m.totalOccurrences === 2 ? 'bg-[var(--amber)]' : 'bg-[var(--text-muted)]';

                            let lastSeenText = '';
                            if (mostRecent.daysAgo === 0) lastSeenText = 'also yesterday';
                            else if (mostRecent.daysAgo === 1) lastSeenText = 'last seen yesterday';
                            else lastSeenText = `last seen ${mostRecent.daysAgo} days ago`;

                            return (
                                <motion.div
                                    key={m.fingerprint}
                                    initial={{ x: -12, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ duration: 0.3, ease: "easeOut", delay: i * 0.08 }}
                                    className="flex items-center h-[48px] border-b border-[var(--border-subtle)] last:border-0"
                                >
                                    <div className={cn("w-2 h-2 rounded-full flex-shrink-0 mr-3", dotColor)} />

                                    <div className="flex-1 min-w-0 pr-4">
                                        <h4 className="text-[13px] font-medium w-full truncate text-[var(--text-primary)]">
                                            {getPatternName(m.fingerprint)}
                                        </h4>
                                        <p className="text-[12px] text-[var(--text-secondary)]">
                                            {m.totalOccurrences} time{m.totalOccurrences > 1 ? 's' : ''} in 30 days · Last: {mostRecent.daysAgo} days ago
                                        </p>
                                    </div>

                                    <div className="flex-shrink-0">
                                        {mostRecent.resolution ? (
                                            <div
                                                className="px-2.5 py-1 bg-[var(--surface-overlay)] border border-[var(--border)] rounded-full text-[10px] text-[var(--text-secondary)] max-w-[180px] truncate cursor-help"
                                                title={`Resolution from ${mostRecent.daysAgo} days ago: ${mostRecent.resolution}`}
                                            >
                                                ✓ {mostRecent.resolution}
                                            </div>
                                        ) : (
                                            <span className="text-[10px] text-[var(--text-muted)] italic">No resolution logged</span>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* AFFECTED BREAKS ROW */}
            {affectedTickers.length > 0 && (
                <div className="mt-5 pt-4 border-t border-[var(--border-subtle)]">
                    <span className="text-[10px] uppercase text-[var(--text-muted)] font-bold tracking-wider block mb-2">Affected This Session</span>
                    <div className="flex flex-wrap gap-2">
                        {affectedTickers.map(ticker => (
                            <button
                                key={ticker}
                                onClick={() => setActiveView('queue')}
                                className="px-[10px] py-[3px] bg-[var(--surface-overlay)] border border-[var(--border)] rounded-full text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-secondary)] transition-colors"
                            >
                                {ticker}
                            </button>
                        ))}
                    </div>
                </div>
            )}

        </motion.div>
    );
}
