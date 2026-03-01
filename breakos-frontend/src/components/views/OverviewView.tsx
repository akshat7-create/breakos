import { useStore } from '../../store';
import { FileUpload } from '../shared/FileUpload';
import { motion } from 'framer-motion';
import { TrendingUp, Shield, Activity, ChevronRight, Zap, BarChart3, PieChart, Clock, PlayCircle } from 'lucide-react';
import { runTriage } from '../../lib/api';

export function OverviewView() {
    const { breaks, setActiveView, setSelectedBreakId, triageStatus } = useStore();

    const total = breaks.length;
    const high = breaks.filter(b => b.severity === 'HIGH').length;
    const medium = breaks.filter(b => b.severity === 'MEDIUM').length;
    const low = breaks.filter(b => b.severity === 'LOW').length;
    const triaged = breaks.filter(b => b.status === 'triaged' || b.status === 'investigated').length;
    const investigated = breaks.filter(b => b.status === 'investigated').length;
    const totalMvDiff = breaks.reduce((sum, b) => sum + Math.abs(b.mvDiff || 0), 0);
    const unresolvedMv = breaks
        .filter(b => b.status !== 'investigated')
        .reduce((sum, b) => sum + Math.abs(b.mvDiff || 0), 0);

    const breakTypeGroups = breaks.reduce<Record<string, { count: number; mv: number }>>((acc, b) => {
        const type = b.breakType || 'Unknown';
        if (!acc[type]) acc[type] = { count: 0, mv: 0 };
        acc[type].count += 1;
        acc[type].mv += Math.abs(b.mvDiff || 0);
        return acc;
    }, {});

    // Break aging groups
    const agingGroups = breaks.reduce<Record<string, { count: number; mv: number }>>((acc, b) => {
        const age = b.age || 0;
        const label = age === 0 ? 'Today' : age === 1 ? '1 day' : `${age}+ days`;
        if (!acc[label]) acc[label] = { count: 0, mv: 0 };
        acc[label].count += 1;
        acc[label].mv += Math.abs(b.mvDiff || 0);
        return acc;
    }, {});

    // Top unresolved breaks sorted by MV diff
    const topBreaks = [...breaks]
        .filter(b => b.status !== 'investigated')
        .sort((a, b) => Math.abs(b.mvDiff || 0) - Math.abs(a.mvDiff || 0))
        .slice(0, 5);

    // Severity ring chart calculations
    const ringTotal = high + medium + low || 1;
    const highPct = (high / ringTotal) * 100;
    const medPct = (medium / ringTotal) * 100;
    // SVG ring params
    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    const highStroke = (highPct / 100) * circumference;
    const medStroke = (medPct / 100) * circumference;
    const lowStroke = circumference - highStroke - medStroke;

    const severityColor = (sev: string) => {
        switch (sev) {
            case 'HIGH': return 'var(--red)';
            case 'MEDIUM': return 'var(--amber)';
            default: return 'var(--green)';
        }
    };

    return (
        <div className="h-full overflow-y-auto p-8 space-y-7">
            {/* Header */}
            <div className="mb-2">
                <h1 className="text-[34px] font-semibold text-[var(--text-primary)] tracking-tight leading-tight mb-0.5">
                    Reconciliation
                </h1>
                <h2 className="text-[34px] font-semibold text-[var(--text-muted)] tracking-tight leading-tight">
                    Break Investigator
                </h2>
                <p className="text-[15px] text-[var(--text-secondary)] mt-4 font-medium tracking-wide">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
            </div>

            {/* File Upload */}
            <FileUpload />

            {total === 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.6 }}
                    className="flex flex-col items-center justify-center py-24 text-[var(--text-muted)]"
                >
                    <Shield size={56} className="opacity-20 mb-6" strokeWidth={1.5} />
                    <p className="text-[17px] font-medium mb-1.5 text-[var(--text-primary)]">No breaks loaded</p>
                    <p className="text-[14px]">Upload a break report or generate sample data to get started.</p>
                </motion.div>
            )}

            {total > 0 && (
                <>
                    {/* ═══ HERO STATS ROW ═══ */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.5 }}
                        className="bg-[var(--surface)] rounded-3xl border border-[var(--border-subtle)] shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-5 lg:p-7"
                    >
                        <div className="flex flex-col lg:flex-row items-stretch gap-6 lg:gap-8">
                            {/* Left: MV Variance Hero */}
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-8 h-8 rounded-lg bg-[var(--red)]15 flex items-center justify-center">
                                        <TrendingUp size={16} className="text-[var(--red)]" />
                                    </div>
                                    <span className="text-[11px] uppercase font-bold tracking-[0.12em] text-[var(--text-muted)]">Total MV Exposure</span>
                                </div>
                                <p className="text-[32px] lg:text-[40px] font-semibold text-[var(--text-primary)] tracking-tight leading-none mb-2 font-tabular">
                                    ${totalMvDiff.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </p>
                                <p className="text-[13px] text-[var(--text-muted)] font-medium">
                                    {investigated > 0
                                        ? `${total - investigated} unresolved · ${investigated} investigated`
                                        : `${total} unresolved breaks · pre-investigation`
                                    }
                                </p>
                            </div>

                            {/* Divider */}
                            <div className="hidden lg:block w-px bg-[var(--border-subtle)]" />
                            <div className="block lg:hidden h-px w-full bg-[var(--border-subtle)]" />

                            {/* Right: Key Metrics Grid */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 flex-1">
                                <div className="flex flex-col justify-center">
                                    <span className="text-[11px] uppercase text-[var(--text-muted)] tracking-[0.1em] font-semibold mb-2">Total</span>
                                    <span className="text-[24px] lg:text-[28px] font-semibold text-[var(--text-primary)] font-tabular leading-none">{total}</span>
                                    <span className="text-[11px] text-[var(--text-muted)] mt-1">breaks</span>
                                </div>
                                <div className="flex flex-col justify-center">
                                    <span className="text-[11px] uppercase text-[var(--text-muted)] tracking-[0.1em] font-semibold mb-2">High</span>
                                    <span className="text-[24px] lg:text-[28px] font-semibold text-[var(--red)] font-tabular leading-none">{high}</span>
                                    <span className="text-[11px] text-[var(--text-muted)] mt-1">breaks</span>
                                </div>
                                <div className="flex flex-col justify-center">
                                    <span className="text-[11px] uppercase text-[var(--text-muted)] tracking-[0.1em] font-semibold mb-2">Triaged</span>
                                    <span className="text-[24px] lg:text-[28px] font-semibold text-[var(--accent-dim)] font-tabular leading-none">{triaged}/{total}</span>
                                    <span className="text-[11px] text-[var(--text-muted)] mt-1">of {total}</span>
                                </div>
                                <div className="flex flex-col justify-center">
                                    <span className="text-[11px] uppercase text-[var(--text-muted)] tracking-[0.1em] font-semibold mb-2">Investigated</span>
                                    <span className="text-[24px] lg:text-[28px] font-semibold text-[var(--green)] font-tabular leading-none">{investigated}</span>
                                    <span className="text-[11px] text-[var(--text-muted)] mt-1">breaks</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* ═══ MIDDLE ROW: Severity Ring + Break Types ═══ */}
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                        {/* Severity Ring */}
                        <motion.div
                            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05, ease: [0.16, 1, 0.3, 1], duration: 0.5 }}
                            className="lg:col-span-2 bg-[var(--surface)] rounded-3xl p-5 lg:p-7 border border-[var(--border-subtle)] shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col"
                        >
                            <div className="flex items-center gap-2.5 mb-5 flex-shrink-0">
                                <Activity size={16} className="text-[var(--text-muted)]" />
                                <h3 className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-[0.12em]">Severity Distribution</h3>
                            </div>
                            {triageStatus !== 'complete' ? (
                                <div className="flex flex-col items-center justify-center py-8 text-center flex-1">
                                    <PieChart size={32} className="text-[var(--text-muted)] opacity-40 mb-3" />
                                    <p className="text-[14px] font-medium text-[var(--text-secondary)] mb-1">Severity distribution unavailable</p>
                                    <p className="text-[12px] text-[var(--text-muted)] mb-4">Run Quick Triage to classify breaks by severity</p>
                                    <button
                                        onClick={() => setActiveView('queue')}
                                        className="text-[13px] font-medium text-[var(--text-secondary)] border border-[var(--border)] rounded-lg px-3.5 py-2 hover:bg-[var(--surface-overlay)] transition-colors"
                                    >
                                        Go to Break Queue →
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col sm:flex-row items-center gap-8 flex-1 justify-center">
                                    {/* SVG Ring */}
                                    <div className="relative w-[130px] h-[130px] flex-shrink-0">
                                        <svg width="130" height="130" viewBox="0 0 130 130" className="-rotate-90">
                                            <circle cx="65" cy="65" r={radius} fill="none" stroke="var(--surface-overlay)" strokeWidth="12" />
                                            <circle cx="65" cy="65" r={radius} fill="none" stroke="var(--red)" strokeWidth="12"
                                                strokeDasharray={`${highStroke} ${circumference - highStroke}`} strokeDashoffset="0" strokeLinecap="round" />
                                            <circle cx="65" cy="65" r={radius} fill="none" stroke="var(--amber)" strokeWidth="12"
                                                strokeDasharray={`${medStroke} ${circumference - medStroke}`} strokeDashoffset={`-${highStroke}`} strokeLinecap="round" />
                                            <circle cx="65" cy="65" r={radius} fill="none" stroke="#5B8DEF" strokeWidth="12"
                                                strokeDasharray={`${lowStroke} ${circumference - lowStroke}`} strokeDashoffset={`-${highStroke + medStroke}`} strokeLinecap="round" />
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-[24px] font-semibold text-[var(--text-primary)] font-tabular leading-none">{total}</span>
                                            <span className="text-[10px] text-[var(--text-muted)] mt-1 uppercase tracking-wider font-semibold">breaks</span>
                                        </div>
                                    </div>
                                    {/* Legend */}
                                    <div className="w-full sm:flex-1 space-y-4">
                                        {[
                                            { label: 'High', count: high, color: 'var(--red)', pct: Math.round(highPct) },
                                            { label: 'Medium', count: medium, color: 'var(--amber)', pct: Math.round(medPct) },
                                            { label: 'Low', count: low, color: '#5B8DEF', pct: Math.round(100 - highPct - medPct) },
                                        ].map(s => (
                                            <div key={s.label} className="flex items-center gap-3">
                                                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                                                <span className="text-[13px] font-medium text-[var(--text-primary)] flex-1">{s.label}</span>
                                                <span className="text-[13px] font-semibold text-[var(--text-primary)] font-tabular">{s.count}</span>
                                                <span className="text-[11px] text-[var(--text-muted)] font-tabular w-10 text-right">{s.pct}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </motion.div>

                        {/* Break Types with MV */}
                        <motion.div
                            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1, ease: [0.16, 1, 0.3, 1], duration: 0.5 }}
                            className="col-span-1 lg:col-span-3 bg-[var(--surface)] rounded-3xl p-5 lg:p-7 border border-[var(--border-subtle)] shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                        >
                            <div className="flex items-center gap-2.5 mb-5">
                                <BarChart3 size={16} className="text-[var(--text-muted)]" />
                                <h3 className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-[0.12em]">Break Type Analysis</h3>
                            </div>
                            {triageStatus !== 'complete' ? (
                                <div className="flex flex-col items-center justify-center py-8 text-center">
                                    <BarChart3 size={32} className="text-[var(--text-muted)] opacity-40 mb-3" />
                                    <p className="text-[14px] font-medium text-[var(--text-secondary)] mb-1">Break types not yet classified</p>
                                    <p className="text-[12px] text-[var(--text-muted)] mb-4">Run Quick Triage to classify breaks by type</p>
                                    <button
                                        onClick={() => setActiveView('queue')}
                                        className="text-[13px] font-medium text-[var(--text-secondary)] border border-[var(--border)] rounded-lg px-3.5 py-2 hover:bg-[var(--surface-overlay)] transition-colors"
                                    >
                                        Go to Break Queue →
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3.5">
                                    {Object.entries(breakTypeGroups)
                                        .sort(([, a], [, b]) => b.mv - a.mv)
                                        .map(([type, data]) => (
                                            <div key={type} className="group">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-[13px] font-semibold text-[var(--text-primary)]">{type}</span>
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-[12px] text-[var(--text-muted)] font-tabular">{data.count} break{data.count > 1 ? 's' : ''}</span>
                                                        <span className="text-[12px] font-semibold text-[var(--text-secondary)] font-tabular w-24 text-right">
                                                            ${data.mv.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="w-full h-2 bg-[var(--surface-overlay)] rounded-full overflow-hidden">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${(data.mv / totalMvDiff) * 100}%` }}
                                                        transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                                                        className="h-full rounded-full"
                                                        style={{ background: `linear-gradient(90deg, var(--accent-dim), var(--accent))` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </motion.div>
                    </div>

                    {/* ═══ BOTTOM ROW: Recent Breaks + Counterparties ═══ */}
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                        {/* Recent High-Priority Breaks */}
                        <motion.div
                            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15, ease: [0.16, 1, 0.3, 1], duration: 0.5 }}
                            className="col-span-1 lg:col-span-3 bg-[var(--surface)] rounded-3xl p-5 lg:p-7 border border-[var(--border-subtle)] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col"
                        >
                            <div className="flex items-center justify-between mb-5 flex-shrink-0">
                                <div className="flex items-center gap-2.5">
                                    <Zap size={16} className="text-[var(--text-muted)]" />
                                    <h3 className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-[0.12em]">Top Unresolved Breaks</h3>
                                </div>
                                <button
                                    onClick={() => setActiveView('queue')}
                                    className="text-[11px] font-semibold text-[var(--accent-dim)] hover:text-[var(--accent)] flex items-center gap-1 transition-colors"
                                >
                                    View all <ChevronRight size={12} />
                                </button>
                            </div>
                            {topBreaks.length > 0 ? (
                                <div className="overflow-x-auto -mx-5 px-5 lg:mx-0 lg:px-0">
                                    <div className="min-w-[500px] space-y-1 pb-2">
                                        {/* Table Header */}
                                        <div className="grid grid-cols-12 gap-3 px-3 py-2 text-[10px] uppercase tracking-[0.1em] font-bold text-[var(--text-muted)]">
                                            <span className="col-span-1">Risk</span>
                                            <span className="col-span-2">Ticker</span>
                                            <span className="col-span-3">Security</span>
                                            <span className="col-span-3">{triageStatus === 'complete' ? 'Break Type' : 'Counterparty'}</span>
                                            <span className="col-span-3 text-right">MV Diff</span>
                                        </div>
                                        {topBreaks.map((b, i) => (
                                            <motion.div
                                                key={b.id}
                                                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.2 + i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                                                onClick={() => { setSelectedBreakId(b.id); setActiveView('queue'); }}
                                                className="grid grid-cols-12 gap-3 px-3 py-3 rounded-xl hover:bg-[var(--surface-overlay)] cursor-pointer transition-colors group items-center"
                                            >
                                                <div className="col-span-1">
                                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: severityColor(b.severity) }} />
                                                </div>
                                                <span className="col-span-2 text-[13px] font-semibold text-[var(--text-primary)] font-tabular">{b.ticker || '—'}</span>
                                                <span className="col-span-3 text-[12px] text-[var(--text-secondary)] truncate">{b.instrument || '—'}</span>
                                                <span className="col-span-3 text-[12px] text-[var(--text-muted)]">{triageStatus === 'complete' ? (b.breakType || '—') : (b.counterparty || '—')}</span>
                                                <div className="col-span-3 flex items-center justify-end gap-2">
                                                    <span className="text-[13px] font-semibold font-tabular" style={{ color: severityColor(b.severity) }}>
                                                        ${Math.abs(b.mvDiff || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                    </span>
                                                    <ChevronRight size={14} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)] flex-1">
                                    <Shield size={32} className="opacity-20 mb-3" />
                                    <p className="text-[13px] font-medium">All breaks resolved</p>
                                </div>
                            )}
                        </motion.div>

                        {/* Aging & Status */}
                        <motion.div
                            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2, ease: [0.16, 1, 0.3, 1], duration: 0.5 }}
                            className="col-span-1 lg:col-span-2 bg-[var(--surface)] rounded-3xl p-5 lg:p-7 border border-[var(--border-subtle)] shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col"
                        >
                            {/* Break Aging */}
                            <div className="mb-6">
                                <div className="flex items-center gap-2.5 mb-4">
                                    <Clock size={16} className="text-[var(--text-muted)]" />
                                    <h3 className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-[0.12em]">Break Aging</h3>
                                </div>
                                <div className="space-y-2.5">
                                    {Object.entries(agingGroups)
                                        .sort(([a], [b]) => {
                                            const order: Record<string, number> = { 'Today': 0, '1 day': 1 };
                                            return (order[a] ?? 2) - (order[b] ?? 2);
                                        })
                                        .map(([label, data]) => (
                                            <div key={label} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-[var(--surface-overlay)]">
                                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${label === 'Today' ? 'bg-[var(--green)]' : label === '1 day' ? 'bg-[var(--amber)]' : 'bg-[var(--red)]'
                                                    }`} />
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-[13px] font-semibold text-[var(--text-primary)] block">{label}</span>
                                                </div>
                                                <span className="text-[13px] font-bold text-[var(--text-primary)] font-tabular">{data.count}</span>
                                            </div>
                                        ))}
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="border-t border-[var(--border-subtle)] my-1" />

                            {/* Investigation Progress */}
                            <div className="mt-5 mb-5">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-[0.12em]">Progress</span>
                                    <span className="text-[13px] font-bold text-[var(--text-primary)] font-tabular">
                                        {investigated}/{total}
                                    </span>
                                </div>
                                <div className="w-full h-2 bg-[var(--surface-overlay)] rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: total > 0 ? `${(investigated / total) * 100}%` : '0%' }}
                                        transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                                        className="h-full rounded-full bg-[var(--accent)]"
                                    />
                                </div>
                                <p className="text-[11px] text-[var(--text-muted)] mt-2">
                                    {investigated === 0 ? 'No breaks investigated yet' :
                                        investigated === total ? 'All breaks investigated' :
                                            `${total - investigated} remaining`}
                                </p>
                            </div>

                            {/* Quick Action */}
                            <div className="mt-auto">
                                {triageStatus !== 'complete' ? (
                                    <button
                                        onClick={async () => {
                                            useStore.getState().setTriageStatus('loading');
                                            try {
                                                const result = await runTriage();
                                                if (result.breaks) {
                                                    useStore.getState().setBreaks(result.breaks);
                                                    useStore.getState().setTriageStatus('complete');
                                                }
                                            } catch { useStore.getState().setTriageStatus('idle'); }
                                        }}
                                        disabled={triageStatus === 'loading' || total === 0}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold bg-[var(--accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <PlayCircle size={15} />
                                        {triageStatus === 'loading' ? 'Running Triage…' : 'Run Quick Triage'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setActiveView('queue')}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] transition-colors"
                                    >
                                        View Break Queue <ChevronRight size={14} />
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </div>
    );
}
