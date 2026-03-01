import { useStore } from '../../store';
import { BreakQueue } from '../queue/BreakQueue';
import { DetailPanel } from '../investigation/DetailPanel';
import { InvestigationView } from '../investigation/InvestigationView';
import { HumanGate } from '../investigation/HumanGate';
import { useEffect, useRef } from 'react';
import { ChevronLeft } from 'lucide-react';
import { cn } from '../../lib/utils';

export function InvestigationPage() {
    const { selectedBreakId, setSelectedBreakId, investigationStatus } = useStore();
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
        <div className="flex flex-col lg:flex-row h-full overflow-hidden relative">
            {/* Left: Break queue for selection */}
            <div className={cn(
                "h-full lg:block transition-all duration-300",
                selectedBreakId ? "hidden lg:block w-0 lg:w-auto" : "w-full lg:w-auto block"
            )}>
                <BreakQueue />
            </div>

            {/* Right: Detail + Investigation */}
            <div className={cn(
                "h-full overflow-y-auto p-4 lg:p-4 pb-6 space-y-3 flex-1 transition-all duration-300",
                !selectedBreakId ? "hidden lg:block" : "block w-full"
            )}>
                {/* Mobile Back Button */}
                {selectedBreakId && (
                    <button
                        onClick={() => setSelectedBreakId(null)}
                        className="lg:hidden flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-secondary)] mb-2 hover:text-[var(--text-primary)] transition-colors"
                    >
                        <ChevronLeft size={16} />
                        Back to Queue
                    </button>
                )}

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
