import { useStore } from '../../store';
import { BreakQueue } from '../queue/BreakQueue';
import { DetailPanel } from '../investigation/DetailPanel';
import { InvestigationView } from '../investigation/InvestigationView';
import { HumanGate } from '../investigation/HumanGate';

export function InvestigationPage() {
    const { selectedBreakId, investigationStatus } = useStore();
    const status = selectedBreakId ? (investigationStatus[selectedBreakId] || 'idle') : 'idle';
    const investigationActive = status !== 'idle';
    const investigationComplete = status === 'complete';

    return (
        <div className="flex h-full overflow-hidden">
            {/* Left: Break queue for selection */}
            <BreakQueue />

            {/* Right: Detail + Investigation */}
            <div className="flex-1 h-full overflow-y-auto p-4 pb-24 space-y-3">
                <DetailPanel />

                {selectedBreakId && investigationActive && (
                    <InvestigationView breakId={selectedBreakId} />
                )}

                {selectedBreakId && investigationComplete && (
                    <HumanGate breakId={selectedBreakId} />
                )}
            </div>
        </div>
    );
}
