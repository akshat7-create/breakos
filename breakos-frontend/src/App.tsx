import { useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { AppLayout } from './components/layout/AppLayout';
import { OverviewView } from './components/views/OverviewView';
import { AuditLogView } from './components/views/AuditLogView';
import { SettingsView } from './components/views/SettingsView';
import { BreakQueue } from './components/queue/BreakQueue';
import { MetricsStrip } from './components/shared/MetricsStrip';
import { DetailPanel } from './components/investigation/DetailPanel';
import { InvestigationView } from './components/investigation/InvestigationView';
import { HumanGate } from './components/investigation/HumanGate';
import { InvestigationPage } from './components/views/InvestigationPage';
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

            case 'queue':
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
        <>
            <AppLayout>
                {renderView()}
            </AppLayout>
            <Analytics />
        </>
    );
}
