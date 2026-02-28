import { useEffect } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { OverviewView } from './components/views/OverviewView';
import { InvestigationPage } from './components/views/InvestigationPage';
import { AuditLogView } from './components/views/AuditLogView';
import { SettingsView } from './components/views/SettingsView';
import { BreakQueue } from './components/queue/BreakQueue';
import { MetricsStrip } from './components/shared/MetricsStrip';
import { DetailPanel } from './components/investigation/DetailPanel';
import { InvestigationView } from './components/investigation/InvestigationView';
import { HumanGate } from './components/investigation/HumanGate';
import { useStore } from './store';
import { fetchHealth } from './lib/api';

export default function App() {
    const { theme, setApiStatus, activeView, selectedBreakId, investigationStatus } = useStore();

    // Sync theme on mount
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    // Health check on mount
    useEffect(() => {
        const checkHealth = async () => {
            try {
                const result = await fetchHealth();
                setApiStatus(result.status === 'ok' ? 'active' : 'error');
            } catch {
                setApiStatus('error');
            }
        };
        checkHealth();
        const interval = setInterval(checkHealth, 30000);
        return () => clearInterval(interval);
    }, [setApiStatus]);

    const renderView = () => {
        switch (activeView) {
            case 'overview':
                return <OverviewView />;

            case 'queue': {
                const investigationActive = selectedBreakId && investigationStatus[selectedBreakId] && investigationStatus[selectedBreakId] !== 'idle';
                const investigationComplete = selectedBreakId && investigationStatus[selectedBreakId] === 'complete';

                return (
                    <div className="flex h-full overflow-hidden">
                        <BreakQueue />
                        <div className="flex-1 h-full overflow-y-auto p-4 pb-24 space-y-3">
                            {!selectedBreakId && <MetricsStrip />}
                            {selectedBreakId && (
                                <>
                                    <MetricsStrip />
                                    <DetailPanel />
                                    {investigationActive && <InvestigationView breakId={selectedBreakId} />}
                                    {investigationComplete && <HumanGate breakId={selectedBreakId} />}
                                </>
                            )}
                            {!selectedBreakId && (
                                <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)]">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-20 mb-4"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                                    <p className="text-[15px] font-medium">Select a break from the queue</p>
                                    <p className="text-[13px] mt-1">or load a break report from the Overview tab</p>
                                </div>
                            )}
                        </div>
                    </div>
                );
            }

            case 'investigation':
                return <InvestigationPage />;

            case 'audit':
                return <AuditLogView />;

            case 'settings':
                return <SettingsView />;

            default:
                return <OverviewView />;
        }
    };

    return (
        <AppLayout>
            {renderView()}
        </AppLayout>
    );
}
