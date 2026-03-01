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
        <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-3xl px-8 py-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex items-center justify-between gap-8 w-full">
            <Metric label="Total" value={total} />
            <Sep />
            <Metric label="High Risk" value={high} color="text-[var(--red)]" />
            <Sep />
            <Metric label="Medium Risk" value={medium} color="text-[var(--amber)]" />
            <Sep />
            <Metric label="Triaged" value={`${triaged}/${total}`} />
            <Sep />
            <Metric label="Investigated" value={investigated} color="text-[var(--green)]" />
        </div>
    );
}

function Metric({ label, value, color }: { label: string; value: number | string; color?: string }) {
    return (
        <div className="flex flex-col flex-1 items-start">
            <span className="text-[11px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mb-1.5">{label}</span>
            <span className={`text-[26px] font-medium leading-none font-tabular tracking-tight ${color || 'text-[var(--text-primary)]'}`}>{value}</span>
        </div>
    );
}

function Sep() {
    return <div className="w-px h-10 bg-[var(--border-subtle)] flex-shrink-0" />;
}
