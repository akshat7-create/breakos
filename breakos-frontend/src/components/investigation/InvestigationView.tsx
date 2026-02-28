import { motion } from 'framer-motion';
import { useStore, LoadingStep } from '../../store';
import { Check, Loader2, Brain, Database, Scale, FileText, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useEffect, useRef } from 'react';
import { investigateBreak, SSEEvent } from '../../lib/api';
import { PatternIntelligenceCard } from '../PatternIntelligenceCard';

export function InvestigationView({ breakId }: { breakId: string }) {
    const {
        investigationStatus, setInvestigationStatus,
        analysisText, appendAnalysisText, clearAnalysisText,
        loadingSteps, setLoadingSteps,
        dataSources, setDataSources,
        breaks,
    } = useStore();

    const status = investigationStatus[breakId] || 'idle';
    const text = analysisText[breakId] || '';
    const steps = loadingSteps[breakId] || [];
    const sources = dataSources[breakId] || [];
    const hasStartedRef = useRef<Record<string, boolean>>({});
    const selectedBreak = breaks.find(b => b.id === breakId);

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

    if (status === 'idle') return null;

    // Parse the analysis text into sections
    const sections = parseAnalysisSections(text);

    return (
        <div className="flex flex-col gap-4">
            {/* Investigation Header */}
            <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className="bg-[var(--surface)] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
            >
                {/* Header Bar */}
                <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[var(--surface-overlay)] flex items-center justify-center">
                            <Brain size={16} className="text-[var(--text-primary)]" />
                        </div>
                        <div>
                            <h3 className="text-[15px] font-bold text-[var(--text-primary)] tracking-tight">Investigation Reasoning</h3>
                            <span className="text-[11px] text-[var(--text-muted)]">
                                Case #{selectedBreak?.refId || breakId} · AI-native Reconciliation
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {status === 'complete' ? (
                            <span className="text-[11px] font-semibold text-[var(--green)] bg-[var(--green-muted)] px-3 py-1 rounded-full">Complete</span>
                        ) : (
                            <span className="text-[11px] font-semibold text-[var(--amber)] bg-[var(--amber-muted)] px-3 py-1 rounded-full flex items-center gap-1.5">
                                <Loader2 size={10} className="animate-spin" /> Analyzing
                            </span>
                        )}
                    </div>
                </div>

                {/* Loading Steps — Pipeline Style */}
                {steps.length > 0 && (
                    <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
                        <div className="flex items-center gap-2 mb-3">
                            <Database size={13} className="text-[var(--text-muted)]" />
                            <span className="text-[11px] uppercase font-bold tracking-[0.08em] text-[var(--text-muted)]">Data Pipeline</span>
                        </div>
                        <div className="flex flex-nowrap items-center min-w-0 overflow-x-auto no-scrollbar gap-2 pb-1">
                            {steps.map((step, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: i * 0.05 }}
                                    className={cn(
                                        "flex flex-shrink-0 items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all",
                                        step.status === 'done'
                                            ? "bg-[var(--green-muted)] border-transparent"
                                            : "bg-[var(--surface-overlay)] border-[var(--border)]"
                                    )}
                                >
                                    {step.status === 'loading' && <Loader2 size={11} className="text-[var(--text-secondary)] animate-spin" />}
                                    {step.status === 'done' && <Check size={11} className="text-[var(--green)]" strokeWidth={3} />}
                                    <span className={cn("text-[11px] whitespace-nowrap", step.status === 'done' ? "text-[var(--text-primary)] font-medium" : "text-[var(--text-secondary)]")}>
                                        {step.label}
                                    </span>
                                    {step.result && (
                                        <span className="text-[9px] text-[var(--text-muted)] ml-0.5 truncate max-w-[100px]">{step.result}</span>
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
                <motion.div
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-[var(--surface)] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.12)] flex flex-col"
                >
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
                    }).map((section, i, arr) => (
                        <div key={i} className={cn(
                            "flex flex-col",
                            i < arr.length - 1 ? "border-b border-[var(--border-subtle)]" : ""
                        )}>
                            {section.title && (
                                <div className="px-5 py-3 border-b border-[var(--border-subtle)] flex items-center gap-2 bg-[var(--surface-overlay)]">
                                    <SectionIcon type={section.type} />
                                    <h4 className="text-[12px] font-bold text-[var(--text-primary)] uppercase tracking-[0.06em]">{section.title}</h4>
                                </div>
                            )}
                            <div className="px-5 py-4">
                                {section.items.map((item, j) => (
                                    <div key={j} className="mb-3 last:mb-0">
                                        {item.type === 'heading' && (
                                            <h5 className="text-[13px] font-semibold text-[var(--text-primary)] mb-1.5 flex items-center gap-2">
                                                <ChevronRight size={12} className="text-[var(--text-muted)]" />
                                                {item.content}
                                            </h5>
                                        )}
                                        {item.type === 'text' && (
                                            <p className="text-[13px] text-[var(--text-secondary)] leading-[1.75] pl-5">{item.content}</p>
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
                                                <div className="flex items-center gap-3 pl-5 py-1">
                                                    <span className="text-[12px] text-[var(--text-muted)]">{item.label}:</span>
                                                    <span className={cn(
                                                        "text-[13px] font-bold font-tabular",
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
                        </div>
                    ))}

                    {/* Raw text fallback if no sections parsed */}
                    {sections.length === 0 && (
                        <div className="p-5">
                            <div className="text-[13px] leading-[1.8] whitespace-pre-wrap text-[var(--text-secondary)]">
                                {text}
                            </div>
                        </div>
                    )}
                </motion.div>
            )}

            {/* Pattern Intelligence (Specific to this break) */}
            {status === 'complete' && (
                <PatternIntelligenceCard forBreakId={breakId} />
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
        <div className="mb-4 pl-5 pr-5">
            <div className="flex justify-between items-end mb-1.5">
                <span className="text-[13px] text-[var(--text-primary)]">
                    <span className="font-semibold">{label}:</span> {text}
                </span>
                {pctMatch && <span className="text-[13px] font-semibold text-[var(--accent)] font-tabular">{pct}%</span>}
            </div>
            {pctMatch && (
                <div className="h-[6px] rounded-full bg-[var(--surface-overlay)] overflow-hidden">
                    <motion.div
                        initial={{ width: '0%' }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: index * 0.12 }}
                        className={cn("h-full rounded-full", fillClass)}
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
