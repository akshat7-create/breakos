import { useStore, ViewId } from '../../store';
import { LayoutDashboard, AlertCircle, Search, ScrollText, Settings, Activity } from 'lucide-react';
import { cn } from '../../lib/utils';

const navItems: { id: ViewId; label: string; icon: typeof LayoutDashboard; useBadge?: boolean }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'queue', label: 'Break Queue', icon: AlertCircle, useBadge: true },
    { id: 'investigation', label: 'Investigation', icon: Search },
    { id: 'audit', label: 'Audit Log', icon: ScrollText },
    { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
    const { breaks, activeView, setActiveView, apiStatus } = useStore();

    return (
        <aside className="fixed left-0 top-0 bottom-0 w-[220px] bg-[var(--sidebar-bg)] border-r border-[var(--border-subtle)] flex flex-col z-20">
            {/* Logo */}
            <div className="h-16 flex items-center px-5 flex-shrink-0">
                <span className="text-[17px] font-semibold tracking-tight text-[var(--text-primary)]">
                    Break<span className="font-bold">OS</span>
                </span>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-2 flex flex-col gap-0.5 overflow-y-auto">
                {navItems.map((item) => {
                    const isActive = activeView === item.id;
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveView(item.id)}
                            className={cn(
                                "h-10 px-3 flex items-center gap-3 w-full text-left rounded-lg transition-all duration-150",
                                isActive
                                    ? "bg-[var(--sidebar-active)] text-[var(--text-primary)] font-medium"
                                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]"
                            )}
                        >
                            <Icon size={16} className={cn(isActive ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]")} />
                            <span className="text-[13px] flex-1">{item.label}</span>
                            {item.useBadge && breaks.length > 0 && (
                                <span className="bg-[var(--surface-overlay)] text-[var(--text-secondary)] text-[10px] px-2 py-0.5 rounded-full font-medium">
                                    {breaks.length}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* Bottom — API Status & Session Info */}
            <div className="px-4 pb-5 pt-4 border-t border-[var(--border-subtle)] shrink-0 space-y-3">
                <div className="bg-[var(--surface)] rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-3">
                        <Activity size={13} className="text-[var(--text-muted)]" />
                        <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">System Status</span>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] text-[var(--text-muted)]">API</span>
                            <div className="flex items-center gap-1.5">
                                <div className={cn("w-1.5 h-1.5 rounded-full", apiStatus === 'active' ? "bg-[var(--green)]" : "bg-[var(--red)]")} />
                                <span className={cn("text-[11px] font-medium", apiStatus === 'active' ? "text-[var(--green)]" : "text-[var(--red)]")}>
                                    {apiStatus === 'active' ? 'Connected' : 'Offline'}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] text-[var(--text-muted)]">Model</span>
                            <span className="text-[11px] font-medium text-[var(--text-primary)]">Claude Sonnet</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] text-[var(--text-muted)]">Session</span>
                            <span className="text-[11px] font-medium text-[var(--text-primary)]">{breaks.length} breaks</span>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
}
