import { useStore } from '../../store';
import { MetricsStrip } from '../shared/MetricsStrip';
import { FileUpload } from '../shared/FileUpload';
import { motion } from 'framer-motion';
import { ArrowRight, TrendingUp, Clock, AlertTriangle, Shield } from 'lucide-react';

export function OverviewView() {
    const { breaks, setActiveView } = useStore();

    const total = breaks.length;
    const high = breaks.filter(b => b.severity === 'HIGH').length;
    const medium = breaks.filter(b => b.severity === 'MEDIUM').length;
    const triaged = breaks.filter(b => b.status === 'triaged' || b.status === 'investigated').length;
    const investigated = breaks.filter(b => b.status === 'investigated').length;
    const totalMvDiff = breaks
        .filter(b => b.status !== 'investigated')
        .reduce((sum, b) => sum + Math.abs(b.mvDiff || 0), 0);
    const breakTypeGroups = breaks.reduce<Record<string, number>>((acc, b) => {
        const type = b.breakType || 'Unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {});

    const counterpartyGroups = breaks.reduce<Record<string, number>>((acc, b) => {
        const cp = b.counterparty || 'Unknown';
        acc[cp] = (acc[cp] || 0) + 1;
        return acc;
    }, {});

    return (
        <div className="h-full overflow-y-auto p-6 space-y-6">
            {/* Header */}
            <div className="mb-2">
                <h1 className="text-[32px] font-bold text-[var(--text-primary)] tracking-tight leading-none mb-1">
                    Reconciliation
                </h1>
                <h2 className="text-[32px] font-bold text-[var(--text-secondary)] tracking-tight leading-none">
                    Break Investigator
                </h2>
                <p className="text-[14px] text-[var(--text-muted)] mt-3">
                    Brokerage Operations · IBOR vs Street-Side · CDS / DTC / RBC IS
                </p>
            </div>

            {/* File Upload */}
            <FileUpload />

            {/* Metrics */}
            <MetricsStrip />

            {total === 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center py-16 text-[var(--text-muted)]"
                >
                    <Shield size={48} className="opacity-20 mb-4" />
                    <p className="text-[16px] font-medium mb-1">No breaks loaded</p>
                    <p className="text-[13px]">Upload a break report or generate sample data to get started.</p>
                </motion.div>
            )}

            {total > 0 && (
                <div className="grid grid-cols-2 gap-4">
                    {/* Summary Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                        className="bg-[var(--surface)] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp size={16} className="text-[var(--text-muted)]" />
                            <h3 className="text-[13px] font-semibold text-[var(--text-primary)] uppercase tracking-wider">Exposure Summary</h3>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <span className="text-[11px] uppercase text-[var(--text-muted)] tracking-wider font-semibold">Total MV Variance</span>
                                <p className="text-[28px] font-bold text-[var(--red)] font-tabular mt-1">${totalMvDiff.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[var(--border-subtle)]">
                                <div>
                                    <span className="text-[10px] uppercase text-[var(--text-muted)] tracking-wider">High</span>
                                    <p className="text-[20px] font-bold text-[var(--red)] mt-0.5">{high}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] uppercase text-[var(--text-muted)] tracking-wider">Medium</span>
                                    <p className="text-[20px] font-bold text-[var(--amber)] mt-0.5">{medium}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] uppercase text-[var(--text-muted)] tracking-wider">Resolved</span>
                                    <p className="text-[20px] font-bold text-[var(--green)] mt-0.5">{investigated}</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Break Type Distribution */}
                    <motion.div
                        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-[var(--surface)] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <AlertTriangle size={16} className="text-[var(--text-muted)]" />
                            <h3 className="text-[13px] font-semibold text-[var(--text-primary)] uppercase tracking-wider">Break Types</h3>
                        </div>
                        <div className="space-y-3">
                            {Object.entries(breakTypeGroups).map(([type, count]) => (
                                <div key={type} className="flex items-center justify-between">
                                    <span className="text-[13px] text-[var(--text-secondary)]">{type}</span>
                                    <div className="flex items-center gap-3">
                                        <div className="w-24 h-1.5 bg-[var(--surface-overlay)] rounded-full overflow-hidden">
                                            <div className="h-full bg-[var(--accent)] rounded-full transition-all" style={{ width: `${(count / total) * 100}%` }} />
                                        </div>
                                        <span className="text-[13px] font-bold text-[var(--text-primary)] font-tabular w-6 text-right">{count}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Counterparty Distribution */}
                    <motion.div
                        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="bg-[var(--surface)] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <Shield size={16} className="text-[var(--text-muted)]" />
                            <h3 className="text-[13px] font-semibold text-[var(--text-primary)] uppercase tracking-wider">Counterparties</h3>
                        </div>
                        <div className="space-y-3">
                            {Object.entries(counterpartyGroups).map(([cp, count]) => (
                                <div key={cp} className="flex items-center justify-between">
                                    <span className="text-[13px] text-[var(--text-secondary)]">{cp}</span>
                                    <span className="text-[14px] font-bold text-[var(--text-primary)] font-tabular">{count}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Quick Actions */}
                    <motion.div
                        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-[var(--surface)] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <Clock size={16} className="text-[var(--text-muted)]" />
                            <h3 className="text-[13px] font-semibold text-[var(--text-primary)] uppercase tracking-wider">Quick Actions</h3>
                        </div>
                        <div className="space-y-2">
                            <button
                                onClick={() => setActiveView('queue')}
                                className="w-full flex items-center justify-between px-4 py-3 bg-[var(--surface-overlay)] rounded-xl text-[13px] hover:bg-[var(--border)] transition-colors group"
                            >
                                <span className="text-[var(--text-primary)] font-medium">View Break Queue</span>
                                <ArrowRight size={14} className="text-[var(--text-muted)] group-hover:translate-x-1 transition-transform" />
                            </button>
                            <button
                                onClick={() => setActiveView('investigation')}
                                className="w-full flex items-center justify-between px-4 py-3 bg-[var(--surface-overlay)] rounded-xl text-[13px] hover:bg-[var(--border)] transition-colors group"
                            >
                                <span className="text-[var(--text-primary)] font-medium">Investigate Breaks</span>
                                <ArrowRight size={14} className="text-[var(--text-muted)] group-hover:translate-x-1 transition-transform" />
                            </button>
                            <button
                                onClick={() => setActiveView('audit')}
                                className="w-full flex items-center justify-between px-4 py-3 bg-[var(--surface-overlay)] rounded-xl text-[13px] hover:bg-[var(--border)] transition-colors group"
                            >
                                <span className="text-[var(--text-primary)] font-medium">View Audit Log</span>
                                <ArrowRight size={14} className="text-[var(--text-muted)] group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
