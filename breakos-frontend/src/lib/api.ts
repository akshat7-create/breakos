/**
 * api.ts — BreakOS API Client
 * Connects React frontend to FastAPI backend at localhost:8000
 */

const API_BASE = (import.meta as any).env.VITE_API_URL || '/api';

export interface BreakRecord {
    id: string;
    ticker: string;
    refId: string;
    instrument: string;
    instrumentType: string;
    currency: string;
    counterparty: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    status: 'pre-triage' | 'triaged' | 'investigated';
    aiAssessment: string | null;
    confidence: number | null;
    route: string | null;
    flag: string | null;
    mvDiff: number;
    mvInternal: number;
    mvStreet: number;
    internalPrice: number | null;
    streetPrice: number | null;
    priceDiff: string | null;
    internalQty: number | null;
    streetQty: number | null;
    qtyDiff: number | null;
    tradeDate: string | null;
    settlementDate: string | null;
    transactionType: string | null;
    breakType: string | null;
    toleranceFlag: string | null;
    age: number;
    desc: string;
    cusip: string | null;
    isin: string | null;
    bondKey: string | null;
    analysisText: string | null;
    decision: {
        type: string;
        reason: string;
        analyst: string;
        timestamp: string;
    } | null;
}

export interface SSEEvent {
    type: 'step' | 'step_done' | 'text' | 'sources' | 'summary' | 'complete' | 'error';
    step?: string;
    label?: string;
    result?: string;
    chunk?: string;
    sources?: string[];
    summary?: string;
    message?: string;
}

export async function fetchHealth(): Promise<{ status: string; api_status: string }> {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error('Health check failed');
    return res.json();
}

export async function fetchBreaks(): Promise<{ breaks: BreakRecord[]; total: number }> {
    const res = await fetch(`${API_BASE}/breaks`);
    if (!res.ok) throw new Error('Failed to fetch breaks');
    return res.json();
}

export async function loadSampleReport(): Promise<{ breaks: BreakRecord[]; total: number; message: string }> {
    const res = await fetch(`${API_BASE}/sample`);
    if (!res.ok) throw new Error('Failed to load sample report');
    return res.json();
}

export async function uploadFile(file: File): Promise<{ breaks: BreakRecord[]; total: number; message: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
    if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.detail || 'Upload failed');
    }
    return res.json();
}

export async function runTriage(): Promise<{ breaks: BreakRecord[]; triaged: number; message: string }> {
    try {
        const res = await fetch(`${API_BASE}/triage`, { method: 'POST' });
        if (!res.ok) {
            const errText = await res.text();
            console.error('Triage API Error Response:', errText);
            throw new Error(`Triage failed: ${res.status} ${errText}`);
        }
        return await res.json();
    } catch (err) {
        console.error('Network or parsing error in runTriage:', err);
        throw err;
    }
}

export function investigateBreak(breakId: string, onEvent: (event: SSEEvent) => void): () => void {
    const controller = new AbortController();

    fetch(`${API_BASE}/investigate/${breakId}`, { signal: controller.signal })
        .then(async (res) => {
            if (!res.ok || !res.body) {
                onEvent({ type: 'error', message: 'Investigation request failed' });
                return;
            }
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            onEvent(data);
                        } catch {
                            // Skip malformed lines
                        }
                    }
                }
            }
        })
        .catch((err) => {
            if (err.name !== 'AbortError') {
                onEvent({ type: 'error', message: err.message });
            }
        });

    return () => controller.abort();
}

export async function submitDecision(
    breakId: string,
    decisionType: 'escalate' | 'override',
    reason: string,
    analyst: string = 'Akshat Aneja'
): Promise<{ status: string }> {
    const res = await fetch(`${API_BASE}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ break_id: breakId, decision_type: decisionType, reason, analyst }),
    });
    if (!res.ok) throw new Error('Decision submission failed');
    return res.json();
}

export async function fetchAuditLog(): Promise<{ entries: any[] }> {
    const res = await fetch(`${API_BASE}/audit`);
    if (!res.ok) throw new Error('Failed to fetch audit log');
    return res.json();
}

export async function synthesizePattern(totalBreaks: number, totalMV: number, signals: any[], historyMatches: any[]): Promise<{ insight: string }> {
    const res = await fetch(`${API_BASE}/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            totalBreaks,
            totalMV,
            signals,
            historyMatches
        })
    });
    if (!res.ok) throw new Error('Failed to synthesize pattern');
    return res.json();
}
