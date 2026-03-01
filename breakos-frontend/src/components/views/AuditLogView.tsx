import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ScrollText, Shield, AlertTriangle, CheckCircle, Upload, Search, Filter } from 'lucide-react';
import { fetchAuditLog } from '../../lib/api';
import { cn } from '../../lib/utils';

interface AuditEntry {
    id: string;
    type: string;
    action: string;
    timestamp: string;
    breakCount?: number;
    breakId?: string;
    reason?: string;
}

const typeIcons: Record<string, typeof Shield> = {
    system: Shield,
    upload: Upload,
    triage: Search,
    investigation: Search,
    escalate: AlertTriangle,
    override: CheckCircle,
};

const typeColors: Record<string, string> = {
    system: 'text-[var(--blue)]',
    upload: 'text-[var(--text-primary)]',
    triage: 'text-[var(--amber)]',
    investigation: 'text-[var(--text-primary)]',
    escalate: 'text-[var(--red)]',
    override: 'text-[var(--green)]',
};

const typeBg: Record<string, string> = {
    system: 'bg-[var(--blue-muted)]',
    upload: 'bg-[var(--surface-overlay)]',
    triage: 'bg-[var(--amber-muted)]',
    investigation: 'bg-[var(--surface-overlay)]',
    escalate: 'bg-[var(--red-muted)]',
    override: 'bg-[var(--green-muted)]',
};

export function AuditLogView() {
    const [entries, setEntries] = useState<AuditEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [filterType, setFilterType] = useState<string>('all');

    const loadAudit = async () => {
        setLoading(true);
        try {
            const result = await fetchAuditLog();
            setEntries(result.entries || []);
        } catch (err) {
            console.error('Failed to load audit log:', err);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadAudit();
        const interval = setInterval(loadAudit, 10000);
        return () => clearInterval(interval);
    }, []);

    const filteredEntries = (filterType === 'all'
        ? entries
        : entries.filter(e => e.type === filterType)
    ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const uniqueTypes = ['all', ...new Set(entries.map(e => e.type))];

    const formatTime = (ts: string) => {
        const d = new Date(ts);
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    };

    const formatDate = (ts: string) => {
        const d = new Date(ts);
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };

    return (
        <div className="h-full overflow-y-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[28px] font-bold text-[var(--text-primary)] tracking-tight">Audit Log</h1>
                    <p className="text-[14px] text-[var(--text-muted)] mt-1">Complete record of all actions — CIRO Rule 3200 compliant</p>
                </div>
                <button
                    onClick={loadAudit}
                    className="px-4 py-2 rounded-xl bg-[var(--surface)] text-[var(--text-primary)] text-[13px] font-medium border border-[var(--border)] hover:bg-[var(--surface-overlay)] transition-colors"
                >
                    Refresh
                </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 flex-wrap">
                {uniqueTypes.map(type => (
                    <button
                        key={type}
                        onClick={() => setFilterType(type)}
                        className={cn(
                            "px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-all duration-150 capitalize",
                            filterType === type
                                ? "bg-[var(--accent)] text-[var(--accent-text)]"
                                : "text-[var(--text-secondary)] border border-[var(--border)] hover:text-[var(--text-primary)]"
                        )}
                    >
                        {type}
                    </button>
                ))}
            </div>

            {/* Entry Count */}
            <div className="flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
                <Filter size={13} />
                <span>{filteredEntries.length} entries{filterType !== 'all' ? ` (filtered by ${filterType})` : ''}</span>
            </div>

            {/* Entries */}
            {filteredEntries.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center py-16 text-[var(--text-muted)]">
                    <ScrollText size={48} className="opacity-20 mb-4" />
                    <p className="text-[16px] font-medium mb-1">No audit entries yet</p>
                    <p className="text-[13px]">Actions will appear here as you use BreakOS.</p>
                </div>
            )}

            <div className="space-y-2">
                {filteredEntries.map((entry, i) => {
                    const Icon = typeIcons[entry.type] || Shield;
                    const color = typeColors[entry.type] || 'text-[var(--text-primary)]';
                    const bg = typeBg[entry.type] || 'bg-[var(--surface-overlay)]';

                    return (
                        <motion.div
                            key={entry.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25, delay: i * 0.03 }}
                            className="bg-[var(--surface)] rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.12)] flex items-start gap-4"
                        >
                            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", bg)}>
                                <Icon size={16} className={color} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[14px] text-[var(--text-primary)] font-medium leading-snug">{entry.action}</p>
                                        {entry.reason && (
                                            <p className="text-[12px] text-[var(--text-secondary)] mt-1 truncate">Reason: {entry.reason}</p>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
                                        <span className="text-[11px] font-semibold text-[var(--text-primary)] font-tabular">{formatTime(entry.timestamp)}</span>
                                        <span className="text-[10px] text-[var(--text-muted)]">{formatDate(entry.timestamp)}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", bg, color)}>
                                        {entry.type}
                                    </span>
                                    {entry.breakId && (
                                        <span className="text-[10px] text-[var(--text-muted)]">Break #{entry.breakId}</span>
                                    )}
                                    {entry.breakCount && (
                                        <span className="text-[10px] text-[var(--text-muted)]">{entry.breakCount} breaks</span>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}
