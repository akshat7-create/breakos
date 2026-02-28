import { useStore } from '../../store';

export function MetricsStrip() {
    const { breaks } = useStore();

    const total = breaks.length;
    const high = breaks.filter(b => b.severity === 'HIGH').length;
    const medium = breaks.filter(b => b.severity === 'MEDIUM').length;
    const triaged = breaks.filter(b => b.status === 'triaged' || b.status === 'investigated').length;
    const investigated = breaks.filter(b => b.status === 'investigated').length;

    if (total === 0) return null;

    return (
        <div className="bg-[var(--surface)] rounded-2xl px-6 py-4 mb-4 shadow-[0_1px_3px_rgba(0,0,0,0.12)] flex items-center gap-8">
            <Metric label="Total" value={total} />
            <Sep />
            <Metric label="High" value={high} color="text-[var(--red)]" />
            <Sep />
            <Metric label="Medium" value={medium} color="text-[var(--amber)]" />
            <Sep />
            <Metric label="Triaged" value={`${triaged}/${total}`} />
            <Sep />
            <Metric label="Investigated" value={investigated} color="text-[var(--green)]" />
        </div>
    );
}

function Metric({ label, value, color }: { label: string; value: number | string; color?: string }) {
    return (
        <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-[0.06em] text-[var(--text-muted)] font-semibold mb-1">{label}</span>
            <span className={`text-[24px] font-semibold leading-none font-tabular ${color || 'text-[var(--text-primary)]'}`}>{value}</span>
        </div>
    );
}

function Sep() {
    return <div className="w-px h-8 bg-[var(--border)]" />;
}
