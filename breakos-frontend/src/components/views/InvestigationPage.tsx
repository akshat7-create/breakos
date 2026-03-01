import { useStore } from '../../store';
import { BreakQueue } from '../queue/BreakQueue';
import { DetailPanel } from '../investigation/DetailPanel';
import { InvestigationView } from '../investigation/InvestigationView';
import { HumanGate } from '../investigation/HumanGate';
import { useEffect, useRef } from 'react';

export function InvestigationPage() {
    const { selectedBreakId, investigationStatus } = useStore();
    const status = selectedBreakId ? (investigationStatus[selectedBreakId] || 'idle') : 'idle';
    const investigationActive = status !== 'idle';
    const investigationComplete = status === 'complete';
    const bottomRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new sections appear
    useEffect(() => {
        if (status === 'loading' || status === 'streaming' || status === 'complete') {
            setTimeout(() => {
                bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }, 300);
        }
    }, [status]);

    return (
        <div className="flex h-full overflow-hidden">
            {/* Left: Break queue for selection */}
            <BreakQueue />

            {/* Right: Detail + Investigation */}
            <div className="flex-1 h-full overflow-y-auto p-4 pb-6 space-y-3">
                <DetailPanel />

                {selectedBreakId && investigationActive && (
                    <InvestigationView breakId={selectedBreakId} />
                )}

                {selectedBreakId && investigationComplete && (
                    <HumanGate breakId={selectedBreakId} />
                )}

                {/* Scroll anchor */}
                <div ref={bottomRef} />
            </div>
        </div>
    );
}
