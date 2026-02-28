import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Zap, Database, BookOpen, Check, AlertTriangle, ToggleLeft, ToggleRight, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useStore } from '../../store';

interface Toggle {
    id: string;
    label: string;
    description: string;
    enabled: boolean;
}

export function SettingsView() {
    const { apiStatus } = useStore();

    const [toggles, setToggles] = useState<Toggle[]>([
        { id: 'auto-triage', label: 'Auto-Triage Low Severity', description: 'Categorize insignificant variance automatically', enabled: true },
        { id: 'auto-route', label: 'Auto-Route to Pricing Team', description: 'Instant escalation for price gaps', enabled: true },
        { id: 'auto-resolve', label: 'Auto-Resolve Dividends < $5k', description: 'Automatic matching for small flows', enabled: false },
        { id: 'settlement-fix', label: 'Settlement Date Auto-Fix', description: 'Adjust mismatches within T+2', enabled: false },
    ]);

    const [confidenceThreshold, setConfidenceThreshold] = useState(85);
    const [mvThreshold, setMvThreshold] = useState(50000);

    const handleToggle = (id: string) => {
        setToggles(prev => prev.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t));
    };

    const activeToggles = toggles.filter(t => t.enabled).length;
    const riskProfile = activeToggles <= 1 ? 'Conservative' : activeToggles <= 3 ? 'Balanced' : 'Aggressive';
    const riskColor = riskProfile === 'Conservative' ? 'text-[var(--green)]' : riskProfile === 'Balanced' ? 'text-[var(--amber)]' : 'text-[var(--red)]';

    return (
        <div className="h-full overflow-y-auto p-6 space-y-6">
            {/* Header */}
            <div className="mb-2">
                <h1 className="text-[28px] font-bold text-[var(--text-primary)] tracking-tight">Authority Settings</h1>
                <p className="text-[14px] text-[var(--text-muted)] mt-1">
                    Define the autonomous range of BreakOS AI models and establish risk guardrails for automated reconciliation cycles.
                </p>
            </div>

            <div className="grid grid-cols-3 gap-5">
                {/* Left column: Autonomy + Thresholds */}
                <div className="col-span-2 space-y-5">
                    {/* Autonomy Levels */}
                    <motion.div
                        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-[var(--surface)] rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.12)] overflow-hidden"
                    >
                        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center gap-2">
                            <Zap size={15} className="text-[var(--amber)]" />
                            <h3 className="text-[14px] font-bold text-[var(--text-primary)]">Autonomy Levels</h3>
                        </div>
                        <div className="divide-y divide-[var(--border-subtle)]">
                            {toggles.map((toggle) => (
                                <div key={toggle.id} className="px-5 py-4 flex items-center justify-between group hover:bg-[var(--accent-muted)] transition-colors">
                                    <div className="flex-1">
                                        <h4 className="text-[14px] font-medium text-[var(--text-primary)]">{toggle.label}</h4>
                                        <p className="text-[12px] text-[var(--text-muted)] mt-0.5">{toggle.description}</p>
                                    </div>
                                    <button
                                        onClick={() => handleToggle(toggle.id)}
                                        className="flex-shrink-0 ml-4"
                                    >
                                        {toggle.enabled ? (
                                            <ToggleRight size={28} className="text-[var(--green)]" />
                                        ) : (
                                            <ToggleLeft size={28} className="text-[var(--text-muted)]" />
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Thresholds */}
                    <motion.div
                        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.06 }}
                        className="bg-[var(--surface)] rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.12)] overflow-hidden"
                    >
                        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center gap-2">
                            <Shield size={15} className="text-[var(--red)]" />
                            <h3 className="text-[14px] font-bold text-[var(--text-primary)]">Thresholds</h3>
                        </div>
                        <div className="p-5 space-y-6">
                            {/* Confidence */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <h4 className="text-[13px] font-medium text-[var(--text-primary)]">Minimum Confidence</h4>
                                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">AI will only suggest actions when confidence meets or exceeds this %</p>
                                    </div>
                                    <span className="text-[20px] font-bold text-[var(--text-primary)] font-tabular">{confidenceThreshold}%</span>
                                </div>
                                <input
                                    type="range"
                                    min={50}
                                    max={99}
                                    value={confidenceThreshold}
                                    onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                                    style={{
                                        background: `linear-gradient(to right, var(--accent) ${((confidenceThreshold - 50) / 49) * 100}%, var(--surface-overlay) ${((confidenceThreshold - 50) / 49) * 100}%)`,
                                    }}
                                />
                                <div className="flex justify-between mt-1">
                                    <span className="text-[10px] text-[var(--text-muted)]">50%</span>
                                    <span className="text-[10px] text-[var(--text-muted)]">99%</span>
                                </div>
                            </div>

                            {/* MV Threshold */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <h4 className="text-[13px] font-medium text-[var(--text-primary)]">Material Variance Limit</h4>
                                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Any discrepancy exceeding this triggers a mandatory human gate</p>
                                    </div>
                                    <span className="text-[20px] font-bold text-[var(--text-primary)] font-tabular">${mvThreshold.toLocaleString()}</span>
                                </div>
                                <input
                                    type="range"
                                    min={5000}
                                    max={500000}
                                    step={5000}
                                    value={mvThreshold}
                                    onChange={(e) => setMvThreshold(Number(e.target.value))}
                                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                                    style={{
                                        background: `linear-gradient(to right, var(--accent) ${((mvThreshold - 5000) / 495000) * 100}%, var(--surface-overlay) ${((mvThreshold - 5000) / 495000) * 100}%)`,
                                    }}
                                />
                                <div className="flex justify-between mt-1">
                                    <span className="text-[10px] text-[var(--text-muted)]">$5,000</span>
                                    <span className="text-[10px] text-[var(--text-muted)]">$500,000</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Data Sources */}
                    <motion.div
                        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.12 }}
                        className="bg-[var(--surface)] rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.12)] overflow-hidden"
                    >
                        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center gap-2">
                            <Database size={15} className="text-[var(--blue)]" />
                            <h3 className="text-[14px] font-bold text-[var(--text-primary)]">Data Sources</h3>
                        </div>
                        <div className="divide-y divide-[var(--border-subtle)]">
                            {[
                                { name: 'Yahoo Finance (yfinance)', status: 'active', desc: 'Real-time equity and ETF pricing' },
                                { name: 'Rateslib', status: 'active', desc: 'Fixed income curves and bond analytics' },
                                { name: 'SEC EDGAR', status: 'active', desc: 'Corporate filings and action history' },
                                { name: 'CDS / DTC Settlement', status: 'active', desc: 'Canadian and US depository data' },
                                { name: 'Anthropic Claude API', status: apiStatus === 'active' ? 'active' : 'error', desc: 'AI analysis and classification engine' },
                            ].map((src, i) => (
                                <div key={i} className="px-5 py-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={cn("w-2 h-2 rounded-full", src.status === 'active' ? "bg-[var(--green)]" : "bg-[var(--red)]")} />
                                        <div>
                                            <span className="text-[13px] font-medium text-[var(--text-primary)]">{src.name}</span>
                                            <p className="text-[11px] text-[var(--text-muted)]">{src.desc}</p>
                                        </div>
                                    </div>
                                    <span className={cn("text-[11px] font-semibold uppercase", src.status === 'active' ? "text-[var(--green)]" : "text-[var(--red)]")}>
                                        {src.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>

                {/* Right column: Authority Summary */}
                <div className="space-y-5">
                    <motion.div
                        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.08 }}
                        className="bg-[var(--surface)] rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.12)] overflow-hidden"
                    >
                        <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
                            <h3 className="text-[14px] font-bold text-[var(--text-primary)]">Authority Summary</h3>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-[12px] text-[var(--text-muted)]">Safety Envelope</span>
                                <span className="text-[12px] font-semibold text-[var(--green)] bg-[var(--green-muted)] px-2.5 py-0.5 rounded-full">Operational</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[12px] text-[var(--text-muted)]">Risk Profile</span>
                                <span className={cn("text-[12px] font-bold", riskColor)}>{riskProfile}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[12px] text-[var(--text-muted)]">Active Automations</span>
                                <span className="text-[12px] font-bold text-[var(--text-primary)]">{activeToggles}/{toggles.length}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[12px] text-[var(--text-muted)]">Confidence Floor</span>
                                <span className="text-[12px] font-bold text-[var(--text-primary)] font-tabular">{confidenceThreshold}%</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[12px] text-[var(--text-muted)]">MV Ceiling</span>
                                <span className="text-[12px] font-bold text-[var(--text-primary)] font-tabular">${mvThreshold.toLocaleString()}</span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Risk Description */}
                    <motion.div
                        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.14 }}
                        className="bg-[var(--surface)] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
                    >
                        <div className="flex items-start gap-3">
                            <AlertTriangle size={16} className={riskColor.replace('text', 'text')} />
                            <div>
                                <h4 className="text-[13px] font-bold text-[var(--text-primary)] mb-1.5">{riskProfile}</h4>
                                <p className="text-[12px] text-[var(--text-secondary)] leading-[1.7]">
                                    {riskProfile === 'Conservative' && 'Your current settings favor manual verification over automated throughput. This reduces straight-through-processing (STP) but ensures 100% human audit trails for mid-market discrepancies.'}
                                    {riskProfile === 'Balanced' && 'A balanced approach that automates low-risk decisions while maintaining human oversight for material variances. Good for teams building confidence in AI-assisted workflows.'}
                                    {riskProfile === 'Aggressive' && 'Maximum automation enabled. AI handles most routine decisions autonomously. Ensure your confidence and MV thresholds are appropriately set for your risk appetite.'}
                                </p>
                            </div>
                        </div>
                    </motion.div>

                    {/* Governance Link */}
                    <motion.div
                        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.18 }}
                    >
                        <button className="w-full flex items-center gap-3 px-5 py-4 bg-[var(--surface)] rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.12)] hover:bg-[var(--surface-overlay)] transition-colors group">
                            <BookOpen size={16} className="text-[var(--text-muted)]" />
                            <span className="text-[13px] font-medium text-[var(--text-primary)] flex-1 text-left">Authority Governance Documentation</span>
                            <ChevronRight size={14} className="text-[var(--text-muted)] group-hover:translate-x-1 transition-transform" />
                        </button>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
