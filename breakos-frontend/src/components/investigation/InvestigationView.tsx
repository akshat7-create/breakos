import { motion } from 'framer-motion';
import { useStore, LoadingStep } from '../../store';
import { Check, Loader2, Brain, Database, Scale, FileText, ChevronRight, CheckCircle, Sparkles, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useEffect, useRef } from 'react';
import { investigateBreak, SSEEvent } from '../../lib/api';
import { PatternIntelligenceCard } from '../PatternIntelligenceCard';

const EMPTY_BULLETS: string[] = [];
const EMPTY_STEPS: LoadingStep[] = [];
const EMPTY_SOURCES: string[] = [];

export function InvestigationView({ breakId }: { breakId: string }) {
    const selectedBreak = useStore((s) => s.breaks.find(b => b.id === breakId));
    const text = useStore((s) => s.analysisText[breakId] || '');
    const status = useStore((s) => s.investigationStatus[breakId] || 'idle');
    const steps = useStore((s) => s.loadingSteps[breakId] ?? EMPTY_STEPS);
    const sources = useStore((s) => s.dataSources[breakId] ?? EMPTY_SOURCES);
    const summaryBullets = useStore((s) => s.investigationSummary[breakId] ?? EMPTY_BULLETS);
    const { setInvestigationStatus, appendAnalysisText, clearAnalysisText, setLoadingSteps, setDataSources, setInvestigationSummary } = useStore();

    const hasStartedRef = useRef<Record<string, boolean>>({});

    useEffect(() => {
        if (status === 'loading' && !hasStartedRef.current[breakId]) {
            hasStartedRef.current[breakId] = true;
            startInvestigation();
        }
    }, [breakId, status]);

    const startInvestigation = () => {
        clearAnalysisText(breakId);
        setLoadingSteps(breakId, []);

        const stepMap: Record<string, number> = {};
        let stepIndex = 0;

        const cancel = investigateBreak(breakId, (event: SSEEvent) => {
            switch (event.type) {
                case 'step':
                    stepMap[event.step!] = stepIndex;
                    setLoadingSteps(breakId, (prev: LoadingStep[]) => [
                        ...prev,
                        { label: event.label!, status: 'loading' }
                    ]);
                    stepIndex++;
                    break;

                case 'step_done':
                    if (event.step === 'ai') {
                        setInvestigationStatus(breakId, 'streaming');
                    }
                    setLoadingSteps(breakId, (prev: LoadingStep[]) => {
                        const next = [...prev];
                        const idx = stepMap[event.step!];
                        if (idx !== undefined && next[idx]) {
                            next[idx] = { ...next[idx], status: 'done', result: event.result };
                        }
                        return next;
                    });
                    break;

                case 'text':
                    if (status !== 'streaming') {
                        setInvestigationStatus(breakId, 'streaming');
                    }
                    appendAnalysisText(breakId, event.chunk!);
                    break;

                case 'sources':
                    setDataSources(breakId, event.sources || []);
                    break;

                case 'summary':
                    try {
                        const bullets = JSON.parse(event.summary || '[]');
                        if (Array.isArray(bullets)) {
                            setInvestigationSummary(breakId, bullets);
                        }
                    } catch {
                        console.warn('Failed to parse summary JSON');
                    }
                    break;

                case 'complete':
                    setInvestigationStatus(breakId, 'complete');
                    break;

                case 'error':
                    console.error('Investigation error:', event.message);
                    setInvestigationStatus(breakId, 'complete');
                    break;
            }
        });

        return cancel;
    };

    const handleRerun = () => {
        // Reset the guard so useEffect will re-trigger
        hasStartedRef.current[breakId] = false;
        // Clear previous analysis data
        clearAnalysisText(breakId);
        setLoadingSteps(breakId, []);
        setDataSources(breakId, []);
        setInvestigationSummary(breakId, []);
        // Re-trigger investigation
        setInvestigationStatus(breakId, 'loading');
    };

    if (status === 'idle') return null;

    // Parse the analysis text into sections
    const sections = parseAnalysisSections(text);

    return (
        <div className="flex flex-col gap-4">
            {/* Investigation Header */}
            <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-3xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
            >
                {/* Header Bar */}
                <div className="px-6 py-5 border-b border-[var(--border-subtle)] flex items-center justify-between">
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-[var(--surface-overlay)] flex items-center justify-center border border-[var(--border-subtle)] shadow-sm">
                            <Brain size={18} className="text-[var(--text-primary)]" />
                        </div>
                        <div>
                            <h3 className="text-[16px] font-semibold text-[var(--text-primary)] tracking-tight">Investigation Reasoning</h3>
                            <span className="text-[12px] text-[var(--text-muted)] mt-0.5 block tracking-wide">
                                Case #{selectedBreak?.refId || breakId} · AI-native Reconciliation
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {status === 'complete' ? (
                            <>
                                <button
                                    onClick={handleRerun}
                                    className="text-[12px] font-medium text-[var(--text-secondary)] bg-[var(--surface-overlay)] hover:bg-[var(--border-subtle)] px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors border border-[var(--border-subtle)] cursor-pointer"
                                >
                                    <RefreshCw size={11} />
                                    Re-run
                                </button>
                                <span className="text-[12px] font-semibold text-[var(--green)] bg-[var(--green-muted)] px-3 py-1.5 rounded-full">Complete</span>
                            </>
                        ) : (
                            <span className="text-[12px] font-semibold text-[var(--amber)] bg-[var(--amber-muted)] px-3 py-1.5 rounded-full flex items-center gap-1.5">
                                <Loader2 size={12} className="animate-spin" /> Analyzing...
                            </span>
                        )}
                    </div>
                </div>

                {/* Loading Steps — Pipeline Style */}
                {steps.length > 0 && (
                    <div className="px-6 py-5 border-b border-[var(--border-subtle)]">
                        <div className="flex items-center gap-2 mb-3.5">
                            <Database size={14} className="text-[var(--text-muted)]" />
                            <span className="text-[11px] uppercase font-bold tracking-[0.1em] text-[var(--text-muted)]">Data Pipeline</span>
                        </div>
                        <div className="flex flex-nowrap items-center min-w-0 overflow-x-auto no-scrollbar gap-2.5 pb-2">
                            {steps.map((step, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: i * 0.05 }}
                                    className={cn(
                                        "flex flex-shrink-0 items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-300 ease-out",
                                        step.status === 'done'
                                            ? "bg-[var(--green-muted)] border-[var(--green-muted)] shadow-sm"
                                            : "bg-[var(--surface-overlay)] border-[var(--border-subtle)]"
                                    )}
                                >
                                    {step.status === 'loading' && <Loader2 size={12} className="text-[var(--text-secondary)] animate-spin" />}
                                    {step.status === 'done' && <Check size={12} className="text-[var(--green)]" strokeWidth={3} />}
                                    <span className={cn("text-[12px] whitespace-nowrap", step.status === 'done' ? "text-[var(--text-primary)] font-semibold" : "text-[var(--text-secondary)] font-medium")}>
                                        {step.label}
                                    </span>
                                    {step.result && (
                                        <span className="text-[10px] text-[var(--text-muted)] ml-1 truncate max-w-[120px] font-medium tracking-wide">{step.result}</span>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Data Sources */}
                {sources.length > 0 && (
                    <div className="px-5 py-3 border-b border-[var(--border-subtle)] flex items-center gap-2">
                        <span className="text-[10px] uppercase text-[var(--text-muted)] font-bold tracking-wider">Sources:</span>
                        {sources.map((src, i) => (
                            <span key={i} className="text-[10px] text-[var(--text-secondary)] bg-[var(--surface-overlay)] px-2 py-0.5 rounded-full">
                                {src}
                            </span>
                        ))}
                    </div>
                )}
            </motion.div>

            {/* Analysis Sections — Reasoning Log Layout */}
            {text && (
                <div className="flex flex-col gap-4 mt-2">
                    {sections.filter(s => {
                        const t = (s.title || '').toLowerCase();
                        if (t.includes('recommendation') || t.includes('draft') || t.includes('email') || t.includes('action')) return false;

                        // Check if the content itself looks like a draft email
                        const hasEmailContent = s.items.some(item =>
                            item.type === 'text' &&
                            (item.content.toLowerCase().startsWith('hi ') ||
                                item.content.toLowerCase().startsWith('to:') ||
                                item.content.toLowerCase().startsWith('subject:'))
                        );
                        return !hasEmailContent;
                    }).map((section, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 + (i * 0.05) }}
                            className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-3xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col"
                        >
                            {section.title && (
                                <div className="px-5 lg:px-6 py-4 border-b border-[var(--border-subtle)] flex items-center gap-2.5 bg-[var(--bg)]">
                                    <SectionIcon type={section.type} />
                                    <h4 className="text-[11px] lg:text-[12px] font-bold text-[var(--text-primary)] uppercase tracking-widest">{section.title}</h4>
                                </div>
                            )}
                            <div className="px-5 lg:px-6 py-4 lg:py-5">
                                {section.items.map((item, j) => (
                                    <div key={j} className="mb-4 last:mb-0">
                                        {item.type === 'heading' && (
                                            <h5 className="text-[13px] lg:text-[14px] font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2 tracking-tight">
                                                <ChevronRight size={14} className="text-[var(--accent)]" />
                                                {item.content}
                                            </h5>
                                        )}
                                        {item.type === 'text' && (
                                            <p className="text-[13px] lg:text-[14px] text-[var(--text-secondary)] leading-[1.8] pl-2 lg:pl-6 font-medium">{item.content}</p>
                                        )}
                                        {item.type === 'metric' && (
                                            (item.label && (
                                                item.label.toLowerCase().includes('primary') ||
                                                item.label.toLowerCase().includes('secondary') ||
                                                item.label.toLowerCase().includes('hypothesis') ||
                                                item.label.toLowerCase().includes('residual')
                                            )) ? (
                                                <ConfidenceBar label={item.label || ''} content={item.content} index={j} />
                                            ) : (
                                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 pl-2 lg:pl-6 py-1.5">
                                                    <span className="text-[12px] lg:text-[13px] text-[var(--text-muted)] font-medium tracking-wide">{item.label}:</span>
                                                    <span className={cn(
                                                        "text-[13px] lg:text-[14px] font-semibold font-mono tracking-tight",
                                                        item.highlight === 'red' ? 'text-[var(--red)]' :
                                                            item.highlight === 'green' ? 'text-[var(--green)]' :
                                                                item.highlight === 'amber' ? 'text-[var(--amber)]' :
                                                                    'text-[var(--text-primary)]'
                                                    )}>{item.content}</span>
                                                </div>
                                            )
                                        )}
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    ))}

                    {/* AI Investigation Summary — genuine AI-generated bullets */}
                    {summaryBullets.length > 0 && status === 'complete' && (() => {
                        const recKeywords = ['route to', 'recommend', 'urgency', 'escalat', 'next step', 'action:'];
                        const findings = summaryBullets.filter(b => !recKeywords.some(k => b.toLowerCase().includes(k)));
                        const recs = summaryBullets.filter(b => recKeywords.some(k => b.toLowerCase().includes(k)));

                        return (
                            <motion.div
                                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-3xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                            >
                                <div className="px-5 lg:px-6 py-4 border-b border-[var(--border-subtle)] flex items-center gap-2.5 bg-[var(--bg)]">
                                    <Sparkles size={14} className="text-[var(--accent)]" />
                                    <h4 className="text-[11px] lg:text-[12px] font-bold text-[var(--text-primary)] uppercase tracking-widest truncate">AI Investigation Summary</h4>
                                    <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
                                        <CheckCircle size={12} className="text-[var(--green)]" />
                                        <span className="text-[11px] font-semibold text-[var(--green)] hidden sm:inline">Complete</span>
                                    </div>
                                </div>
                                <div className="px-5 lg:px-6 py-4 lg:py-5 space-y-4">
                                    {/* Findings */}
                                    {findings.length > 0 && (
                                        <ul className="space-y-3">
                                            {findings.map((bullet, i) => (
                                                <li key={i} className="flex items-start gap-3">
                                                    <span className="text-[var(--accent)] mt-[5px] flex-shrink-0 text-[8px]">●</span>
                                                    <span className="text-[13px] text-[var(--text-primary)] leading-[1.7] font-medium">{bullet}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}

                                    {/* Recommendation sub-card */}
                                    {recs.length > 0 && (
                                        <div className="bg-[rgba(139,92,246,0.06)] border border-[rgba(139,92,246,0.18)] rounded-2xl p-4 mt-1">
                                            <div className="flex items-center gap-2 mb-2.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#a78bfa]" />
                                                <span className="text-[10px] font-bold text-[#a78bfa] uppercase tracking-wider">Recommendation</span>
                                            </div>
                                            <ul className="space-y-2">
                                                {recs.map((r, i) => (
                                                    <li key={i} className="flex items-start gap-2.5">
                                                        <span className="text-[#a78bfa] mt-[2px] flex-shrink-0">→</span>
                                                        <span className="text-[13px] text-[var(--text-primary)] leading-[1.7] font-medium">{r}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })()}

                    {/* Raw text fallback if no sections parsed */}
                    {sections.length === 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                            className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-3xl p-5 lg:p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                        >
                            <div className="text-[13px] lg:text-[14px] leading-[1.8] whitespace-pre-wrap text-[var(--text-secondary)] font-medium">
                                {text}
                            </div>
                        </motion.div>
                    )}
                </div>
            )}

            {/* Pattern Intelligence (Specific to this break) */}
            {status === 'complete' && (
                <div className="mt-4">
                    <PatternIntelligenceCard forBreakId={breakId} />
                </div>
            )}
        </div>
    );
}

function ConfidenceBar({ label, content, index }: { label: string, content: string, index: number }) {
    // Try to extract percentage from the end of the content
    const pctMatch = content.match(/(.*?)(?:[-—]\s*)?(\d{1,3})%$/);
    const text = pctMatch ? pctMatch[1].trim() : content;
    const pct = pctMatch ? parseInt(pctMatch[2], 10) : 0;

    let fillClass = "bg-[var(--text-muted)]"; // Residual
    const lowerLabel = label.toLowerCase();
    if (lowerLabel.includes('primary')) fillClass = "bg-[var(--accent)]";
    else if (lowerLabel.includes('secondary')) fillClass = "bg-[var(--amber)]";

    return (
        <div className="mb-5 pl-2 pr-2 lg:pl-6 lg:pr-6">
            <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-end mb-2 gap-1 sm:gap-0">
                <span className="text-[13px] lg:text-[14px] text-[var(--text-primary)] tracking-tight">
                    <span className="font-semibold text-[var(--text-secondary)] mr-1">{label}:</span> <span className="font-medium">{text}</span>
                </span>
                {pctMatch && <span className="text-[13px] lg:text-[14px] font-bold text-[var(--accent)] font-mono">{pct}%</span>}
            </div>
            {pctMatch && (
                <div className="h-[8px] rounded-full bg-[var(--surface-overlay)] overflow-hidden shadow-inner">
                    <motion.div
                        initial={{ width: '0%' }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: index * 0.12 }}
                        className={cn("h-full rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.1)]", fillClass)}
                    />
                </div>
            )}
        </div>
    );
}

function SectionIcon({ type }: { type: string }) {
    switch (type) {
        case 'classification': return <Scale size={14} className="text-[var(--amber)]" />;
        case 'analysis': return <Brain size={14} className="text-[var(--blue)]" />;
        case 'evidence': return <Database size={14} className="text-[var(--green)]" />;
        case 'recommendation': return <FileText size={14} className="text-[var(--red)]" />;
        default: return <FileText size={14} className="text-[var(--text-muted)]" />;
    }
}

interface SectionItem {
    type: 'heading' | 'text' | 'metric';
    content: string;
    label?: string;
    highlight?: 'red' | 'green' | 'amber';
}

interface Section {
    title: string;
    type: string;
    items: SectionItem[];
}

function parseAnalysisSections(text: string): Section[] {
    if (!text.trim()) return [];

    const lines = text.split('\n');
    const sections: Section[] = [];
    let currentSection: Section | null = null;

    let foundDraft = false;

    for (const line of lines) {
        if (foundDraft) continue;
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Check for section headers like [CLASSIFICATION] or [ROOT CAUSE ANALYSIS]
        const sectionMatch = trimmed.match(/^\[(.+)\]$/);
        if (sectionMatch) {
            const title = sectionMatch[1];

            if (title.toLowerCase().includes('recommend') || title.toLowerCase().includes('action') || title.toLowerCase().includes('escal') || title.toLowerCase().includes('draft')) {
                foundDraft = true;
                continue;
            }

            const type = title.toLowerCase().includes('classif') ? 'classification' :
                title.toLowerCase().includes('analy') || title.toLowerCase().includes('root') ? 'analysis' :
                    title.toLowerCase().includes('evidence') || title.toLowerCase().includes('data') ? 'evidence' :
                        'general';
            currentSection = { title, type, items: [] };
            sections.push(currentSection);
            continue;
        }

        // Check for key-value metrics like "Confidence: 92%"
        const metricMatch = trimmed.match(/^(.+?):\s+(.+)$/);
        if (metricMatch && metricMatch[1].length < 30 && currentSection) {
            const label = metricMatch[1];
            const value = metricMatch[2];
            const highlight = value.includes('%') && parseInt(value) > 80 ? 'green' as const :
                value.startsWith('$') || value.includes('HIGH') ? 'red' as const :
                    value.includes('MEDIUM') ? 'amber' as const : undefined;
            currentSection.items.push({ type: 'metric', content: value, label, highlight });
            continue;
        }

        // Check for sub-headings (lines starting with bullets or numbers)
        if ((trimmed.startsWith('•') || trimmed.startsWith('-') || /^\d+\./.test(trimmed)) && currentSection) {
            currentSection.items.push({ type: 'heading', content: trimmed.replace(/^[•\-]\s*/, '').replace(/^\d+\.\s*/, '') });
            continue;
        }

        // Regular text
        if (!currentSection) {
            currentSection = { title: 'Summary', type: 'general', items: [] };
            sections.push(currentSection);
        }
        currentSection.items.push({ type: 'text', content: trimmed });
    }

    return sections;
}
