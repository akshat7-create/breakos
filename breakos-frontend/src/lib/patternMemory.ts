import { BreakRecord } from './api';

const HISTORY_KEY = 'breakos_pattern_history';
const SEED_KEY = 'breakos_history_seeded';

export interface PatternSignal {
    fingerprint: string;
    label: string;
    type: 'counterparty' | 'break_type' | 'settlement' | 'mv' | 'currency' | 'ca_event';
    urgent: boolean;
    affectedBreakIds: string[];
}

export interface SessionRecord {
    sessionId: string;
    date: string;
    timestamp: string;
    totalBreaks: number;
    totalMV: number;
    signals: {
        fingerprint: string;
        label: string;
        type: string;
        affectedCount: number;
    }[];
    resolution: string | null;
}

export interface HistoricalMatchOccurrence {
    date: string;
    daysAgo: number;
    affectedCount: number;
    resolution: string | null;
    sessionId: string;
}

export interface HistoricalMatch {
    fingerprint: string;
    occurrences: HistoricalMatchOccurrence[];
    firstSeen: string;
    totalOccurrences: number;
}

// ----------------------------------------------------
// Seeding History
// ----------------------------------------------------
export function seedHistoryIfNeeded() {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(SEED_KEY) === 'true') return;

    const today = new Date();
    const format = (d: Date) => d.toISOString().split('T')[0];

    const shiftDays = (days: number) => {
        const d = new Date(today);
        d.setDate(d.getDate() - days);
        return format(d);
    };

    const seedSessions: SessionRecord[] = [
        {
            sessionId: "seed-001",
            date: shiftDays(3),
            timestamp: new Date(shiftDays(3) + "T10:00:00Z").toISOString(),
            totalBreaks: 6,
            totalMV: 1850000,
            signals: [
                {
                    fingerprint: "counterparty_cluster:CDS:high",
                    label: "4 of 6 breaks → CDS",
                    type: "counterparty",
                    affectedCount: 4
                },
                {
                    fingerprint: "break_type_cluster:pricing_difference",
                    label: "3× Pricing Difference",
                    type: "break_type",
                    affectedCount: 3
                }
            ],
            resolution: "Escalated to Settlements Desk — CDS confirmed delayed vendor feed update, resolved by 2PM"
        },
        {
            sessionId: "seed-002",
            date: shiftDays(9),
            timestamp: new Date(shiftDays(9) + "T10:00:00Z").toISOString(),
            totalBreaks: 5,
            totalMV: 920000,
            signals: [
                {
                    fingerprint: "counterparty_cluster:CDS:high",
                    label: "3 of 5 breaks → CDS",
                    type: "counterparty",
                    affectedCount: 3
                },
                {
                    fingerprint: "settlement_urgency:T+0",
                    label: "2 breaks settle TODAY",
                    type: "settlement",
                    affectedCount: 2
                }
            ],
            resolution: "Escalated to Settlements Desk — same-day resolution, CDS ops confirmed inventory issue"
        },
        {
            sessionId: "seed-003",
            date: shiftDays(17),
            timestamp: new Date(shiftDays(17) + "T10:00:00Z").toISOString(),
            totalBreaks: 4,
            totalMV: 540000,
            signals: [
                {
                    fingerprint: "break_type_cluster:corporate_action_dividend",
                    label: "2× Corporate Action - Dividend",
                    type: "break_type",
                    affectedCount: 2
                },
                {
                    fingerprint: "mixed_ca_event:dividend_and_merger_same_day",
                    label: "Dividend + Merger CA same session",
                    type: "ca_event",
                    affectedCount: 3
                }
            ],
            resolution: "Override — CA vendor confirmed batch processing lag, manual adjustment applied"
        },
        {
            sessionId: "seed-004",
            date: shiftDays(24),
            timestamp: new Date(shiftDays(24) + "T10:00:00Z").toISOString(),
            totalBreaks: 8,
            totalMV: 3100000,
            signals: [
                {
                    fingerprint: "counterparty_cluster:CDS:high",
                    label: "5 of 8 breaks → CDS",
                    type: "counterparty",
                    affectedCount: 5
                },
                {
                    fingerprint: "mv_concentration:top3_over_80pct",
                    label: "Top 3 breaks = 83% of exposure",
                    type: "mv",
                    affectedCount: 3
                },
                {
                    fingerprint: "currency_cluster:CAD",
                    label: "6 CAD breaks",
                    type: "currency",
                    affectedCount: 6
                }
            ],
            resolution: "Escalated to Settlements Desk — CDS system maintenance window caused delayed settlement confirmations"
        }
    ];

    localStorage.setItem(HISTORY_KEY, JSON.stringify(seedSessions));
    localStorage.setItem(SEED_KEY, 'true');
}

// ----------------------------------------------------
// Compute Signals
// ----------------------------------------------------
export function computeSignals(breaks: BreakRecord[]): PatternSignal[] {
    const signals: PatternSignal[] = [];
    if (!breaks || breaks.length === 0) return signals;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tmrw = new Date(today);
    tmrw.setDate(tmrw.getDate() + 1);
    const tmrwStr = tmrw.toISOString().split('T')[0];

    const totalBreaks = breaks.length;

    // 1. Counterparty clustering
    const cpGroups = breaks.reduce((acc, b) => {
        const cp = b.counterparty || 'Unknown';
        if (!acc[cp]) acc[cp] = [];
        acc[cp].push(b.id);
        return acc;
    }, {} as Record<string, string[]>);

    Object.entries(cpGroups).forEach(([cp, ids]) => {
        if (cp === 'Unknown') return;
        if (ids.length >= 3) {
            signals.push({
                fingerprint: `counterparty_cluster:${cp}:high`,
                label: `${ids.length} of ${totalBreaks} breaks → ${cp}`,
                type: 'counterparty',
                urgent: false,
                affectedBreakIds: ids
            });
        } else if (ids.length === 2) {
            signals.push({
                fingerprint: `counterparty_cluster:${cp}:medium`,
                label: `2 breaks share ${cp}`,
                type: 'counterparty',
                urgent: false,
                affectedBreakIds: ids
            });
        }
    });

    // 2. Break type clustering
    const btGroups = breaks.reduce((acc, b) => {
        const bt = b.breakType || 'Unknown';
        if (!acc[bt]) acc[bt] = [];
        acc[bt].push(b.id);
        return acc;
    }, {} as Record<string, string[]>);

    let hasDiv = false;
    let hasMerger = false;
    const caIds: string[] = [];

    Object.entries(btGroups).forEach(([bt, ids]) => {
        if (bt === 'Unknown') return;

        if (bt.toLowerCase().includes('dividend')) { hasDiv = true; caIds.push(...ids); }
        if (bt.toLowerCase().includes('merger')) { hasMerger = true; caIds.push(...ids); }

        if (ids.length >= 2) {
            const normalized = bt.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
            signals.push({
                fingerprint: `break_type_cluster:${normalized}`,
                label: `${ids.length}× ${bt} today`,
                type: 'break_type',
                urgent: false,
                affectedBreakIds: ids
            });
        }
    });

    if (hasDiv && hasMerger) {
        signals.push({
            fingerprint: "mixed_ca_event:dividend_and_merger_same_day",
            label: "Dividend + Merger CA same session — possible CA batch failure",
            type: 'ca_event',
            urgent: false,
            affectedBreakIds: [...new Set(caIds)]
        });
    }

    // 3. Settlement urgency
    const t0Ids = breaks.filter(b => b.settlementDate === todayStr).map(b => b.id);
    if (t0Ids.length > 0) {
        signals.push({
            fingerprint: "settlement_urgency:T+0",
            label: `${t0Ids.length} break(s) settle TODAY`,
            type: 'settlement',
            urgent: true,
            affectedBreakIds: t0Ids
        });
    }

    const t1Ids = breaks.filter(b => b.settlementDate === tmrwStr).map(b => b.id);
    if (t1Ids.length > 0) {
        signals.push({
            fingerprint: "settlement_urgency:T+1",
            label: `${t1Ids.length} break(s) settle T+1 tomorrow`,
            type: 'settlement',
            urgent: false,
            affectedBreakIds: t1Ids
        });
    }

    // 4. MV concentration
    const absMvs = breaks.map(b => ({
        id: b.id,
        mv: Math.abs(typeof b.mvDiff === 'number' ? b.mvDiff : 0)
    })).sort((a, b) => b.mv - a.mv);

    const totalSum = absMvs.reduce((s, x) => s + x.mv, 0);
    if (absMvs.length >= 3 && totalSum > 0) {
        const top3 = absMvs.slice(0, 3);
        const top3Sum = top3.reduce((s, x) => s + x.mv, 0);
        const pct = top3Sum / totalSum;
        if (pct >= 0.80) {
            signals.push({
                fingerprint: "mv_concentration:top3_over_80pct",
                label: `Top 3 breaks = ${(pct * 100).toFixed(0)}% of $${totalSum.toLocaleString()} exposure`,
                type: 'mv',
                urgent: true,
                affectedBreakIds: top3.map(x => x.id)
            });
        }
    }

    // 5. Currency cluster
    const currGroups = breaks.reduce((acc, b) => {
        const curr = b.currency || 'Unknown';
        if (!acc[curr]) acc[curr] = [];
        acc[curr].push(b.id);
        return acc;
    }, {} as Record<string, string[]>);

    if ((currGroups['CAD']?.length || 0) >= 4) {
        signals.push({
            fingerprint: "currency_cluster:CAD",
            label: `${currGroups['CAD'].length} CAD breaks — check CAD-specific vendor feeds`,
            type: 'currency',
            urgent: false,
            affectedBreakIds: currGroups['CAD']
        });
    }
    if ((currGroups['USD']?.length || 0) >= 4) {
        signals.push({
            fingerprint: "currency_cluster:USD",
            label: `${currGroups['USD'].length} USD breaks — check USD feeds`,
            type: 'currency',
            urgent: false,
            affectedBreakIds: currGroups['USD']
        });
    }

    return signals;
}

// ----------------------------------------------------
// Manage LocalSession
// ----------------------------------------------------
export function writeSessionPattern(sessionId: string, signals: PatternSignal[], totalBreaks: number, totalMV: number) {
    if (typeof window === 'undefined') return;

    const historyStr = localStorage.getItem(HISTORY_KEY) || '[]';
    let history: SessionRecord[] = [];
    try {
        history = JSON.parse(historyStr);
    } catch { }

    const todayStr = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff = thirtyDaysAgo.toISOString().split('T')[0];

    // Filter out > 30 days
    history = history.filter(r => r.date >= cutoff);

    const existingIdx = history.findIndex(h => h.sessionId === sessionId || h.date === todayStr);

    const mapToRecordSignals = (sigs: PatternSignal[]) => sigs.map(s => ({
        fingerprint: s.fingerprint,
        label: s.label,
        type: s.type,
        affectedCount: s.affectedBreakIds.length
    }));

    if (existingIdx !== -1) {
        history[existingIdx].totalBreaks = totalBreaks;
        history[existingIdx].totalMV = totalMV;
        history[existingIdx].signals = mapToRecordSignals(signals);
    } else {
        history.push({
            sessionId: sessionId || crypto.randomUUID(),
            date: todayStr,
            timestamp: new Date().toISOString(),
            totalBreaks,
            totalMV,
            signals: mapToRecordSignals(signals),
            resolution: null
        });
    }

    // Cap at 90
    if (history.length > 90) {
        history = history.slice(history.length - 90);
    }

    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

// ----------------------------------------------------
// Get Historical Matches
// ----------------------------------------------------
export function getHistoricalMatches(todaySignals: PatternSignal[]): HistoricalMatch[] {
    if (typeof window === 'undefined' || todaySignals.length === 0) return [];

    const historyStr = localStorage.getItem(HISTORY_KEY) || '[]';
    let history: SessionRecord[] = [];
    try {
        history = JSON.parse(historyStr);
    } catch { }

    const todayStr = new Date().toISOString().split('T')[0];

    // exclude today's records
    const pastHistory = history.filter(h => h.date < todayStr);

    const matchesMap: Record<string, HistoricalMatch> = {};

    const msPerDay = 1000 * 60 * 60 * 24;
    const now = new Date();
    const getDaysAgo = (dStr: string) => {
        const d = new Date(dStr);
        return Math.floor((now.getTime() - d.getTime()) / msPerDay);
    };

    todaySignals.forEach(ts => {
        pastHistory.forEach(record => {
            const match = record.signals.find(rs => rs.fingerprint === ts.fingerprint);
            if (match) {
                if (!matchesMap[ts.fingerprint]) {
                    matchesMap[ts.fingerprint] = {
                        fingerprint: ts.fingerprint,
                        occurrences: [],
                        firstSeen: record.date,
                        totalOccurrences: 0
                    };
                }

                matchesMap[ts.fingerprint].occurrences.push({
                    date: record.date,
                    daysAgo: getDaysAgo(record.date),
                    affectedCount: match.affectedCount,
                    resolution: record.resolution,
                    sessionId: record.sessionId
                });
            }
        });
    });

    const results: HistoricalMatch[] = [];

    Object.values(matchesMap).forEach(m => {
        // sort descending date
        m.occurrences.sort((a, b) => b.date.localeCompare(a.date));

        // update stats
        m.totalOccurrences = m.occurrences.length;
        m.firstSeen = m.occurrences[m.occurrences.length - 1].date;

        // cap at 3
        if (m.occurrences.length > 3) {
            m.occurrences = m.occurrences.slice(0, 3);
        }

        results.push(m);
    });

    return results;
}

// ----------------------------------------------------
// Write Resolution
// ----------------------------------------------------
export function writeResolutionToHistory(decisionType: string, reason: string | null) {
    if (typeof window === 'undefined') return;

    const historyStr = localStorage.getItem(HISTORY_KEY) || '[]';
    let history: SessionRecord[] = [];
    try {
        history = JSON.parse(historyStr);
    } catch { return; }

    const todayStr = new Date().toISOString().split('T')[0];
    const todayIdx = history.findIndex(h => h.date === todayStr);

    if (todayIdx !== -1) {
        if (decisionType === 'escalate') {
            history[todayIdx].resolution = `Escalated — ${reason || 'Awaiting resolution'}`;
        } else {
            const shortRsn = (reason || '').substring(0, 60);
            history[todayIdx].resolution = `Override — ${shortRsn}${shortRsn.length === 60 ? '...' : ''}`;
        }
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    }
}
