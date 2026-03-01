import { useState } from 'react';
import { Sun, Moon, Menu, X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { useStore } from '../../store';

interface AppLayoutProps {
    children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
    const { theme, toggleTheme, apiStatus, activeView } = useStore();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <div className="flex h-full bg-[var(--bg)] overflow-hidden">
            {/* Sidebar with mobile slide-over logic */}
            <div className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <Sidebar onNavClick={() => setIsMobileMenuOpen(false)} />
            </div>

            {/* Mobile overlay backdrop */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            <main className="flex-1 flex flex-col h-full overflow-hidden w-full">
                {/* Top Nav Bar */}
                <header className="h-14 lg:h-16 flex-shrink-0 border-b border-[var(--nav-border)] bg-[var(--nav-bg)]/80 backdrop-blur-2xl px-4 lg:px-8 flex items-center justify-between z-10">
                    <div className="flex items-center gap-3 lg:gap-8">
                        {/* Hamburger Button (Mobile Only) */}
                        <button
                            className="lg:hidden p-1.5 -ml-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-md hover:bg-[var(--surface-overlay)]"
                            onClick={() => setIsMobileMenuOpen(true)}
                        >
                            <Menu size={20} />
                        </button>

                        <div className="flex items-center gap-2.5 sm:gap-3">
                            <h1 className="text-[17px] font-medium tracking-tight text-[var(--text-primary)]">
                                Break<span className="font-semibold">OS</span>
                            </h1>
                            <div className="w-px h-4 bg-[var(--border)]" />
                            <span className="text-[14px] font-medium text-[var(--text-secondary)] capitalize">
                                {activeView === 'queue' ? 'Investigation' : activeView === 'audit' ? 'Audit Log' : activeView}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 lg:gap-6">
                        <span className="hidden sm:inline-block text-[13px] font-medium text-[var(--text-muted)]">
                            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>

                        {/* API Status Dot */}
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${apiStatus === 'active' ? 'bg-[var(--green)]' : apiStatus === 'error' ? 'bg-[var(--red)]' : 'bg-[var(--amber)]'}`} style={{ animation: apiStatus === 'active' ? 'pulse-dot 2.5s ease-in-out infinite' : 'none' }} />
                            <span className="hidden sm:inline-block text-[12px] font-medium text-[var(--text-muted)]">{apiStatus === 'active' ? 'Connected' : apiStatus === 'error' ? 'Offline' : 'Checking...'}</span>
                        </div>

                        <div className="hidden sm:block w-px h-5 bg-[var(--border)]" />

                        {/* Theme Toggle */}
                        <button
                            onClick={toggleTheme}
                            className="w-8 h-8 lg:w-9 lg:h-9 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-overlay)] transition-all ease-out duration-300"
                        >
                            {theme === 'dark' ? <Sun size={16} strokeWidth={2.5} /> : <Moon size={16} strokeWidth={2.5} />}
                        </button>

                        {/* Analyst Avatar */}
                        <div className="flex items-center gap-2 lg:gap-3">
                            <div className="w-8 h-8 lg:w-9 lg:h-9 rounded-full bg-[var(--surface-overlay)] flex items-center justify-center text-[var(--text-primary)] font-semibold text-[11px] lg:text-[12px] border border-[var(--border-subtle)]">
                                AA
                            </div>
                            <div className="hidden sm:flex flex-col">
                                <span className="text-[13px] font-semibold text-[var(--text-primary)] leading-none mb-1">Akshat Aneja</span>
                                <span className="text-[11px] font-medium text-[var(--text-muted)] leading-none">Analyst</span>
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
