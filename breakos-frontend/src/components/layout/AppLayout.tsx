import { Sun, Moon } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { useStore } from '../../store';

interface AppLayoutProps {
    children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
    const { theme, toggleTheme, apiStatus } = useStore();

    return (
        <div className="flex h-screen bg-[var(--bg)] overflow-hidden">
            <Sidebar />

            <main className="flex-1 flex flex-col h-full overflow-hidden" style={{ marginLeft: 220 }}>
                {/* Top Nav Bar */}
                <header className="h-16 flex-shrink-0 border-b border-[var(--nav-border)] bg-[var(--nav-bg)]/90 backdrop-blur-xl px-6 flex items-center justify-between z-10">
                    <div className="flex items-center gap-8">
                        <h1 className="text-[17px] font-semibold tracking-tight text-[var(--text-primary)]">
                            Break<span className="font-bold">OS</span>
                        </h1>
                    </div>

                    <div className="flex items-center gap-5">
                        <span className="text-[12px] text-[var(--text-muted)]">
                            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>

                        {/* API Status Dot */}
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${apiStatus === 'active' ? 'bg-[var(--green)]' : apiStatus === 'error' ? 'bg-[var(--red)]' : 'bg-[var(--amber)]'}`} style={{ animation: apiStatus === 'active' ? 'pulse-dot 2s infinite' : 'none' }} />
                            <span className="text-[11px] text-[var(--text-muted)]">{apiStatus === 'active' ? 'Connected' : apiStatus === 'error' ? 'Offline' : 'Checking...'}</span>
                        </div>

                        <div className="w-px h-5 bg-[var(--border)]" />

                        {/* Theme Toggle */}
                        <button
                            onClick={toggleTheme}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-overlay)] transition-all"
                        >
                            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                        </button>

                        {/* Analyst Avatar */}
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[var(--surface-overlay)] flex items-center justify-center text-[var(--text-primary)] font-semibold text-[11px]">
                                AA
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[12px] font-medium text-[var(--text-primary)] leading-none mb-0.5">Akshat Aneja</span>
                                <span className="text-[10px] text-[var(--text-muted)] leading-none">Analyst</span>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-hidden">
                    {children}
                </div>
            </main>
        </div>
    );
}
