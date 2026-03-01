import { motion } from 'framer-motion';
import { useStore } from '../../store';
import { submitDecision } from '../../lib/api';
import { cn } from '../../lib/utils';
import { useState, useMemo } from 'react';
import { ShieldCheck, AlertTriangle, Mail, ExternalLink, Check, Edit3, Send } from 'lucide-react';

export function HumanGate({ breakId }: { breakId: string }) {
    const { breaks, analysisText, setInvestigationStatus } = useStore();

    const selectedBreak = breaks.find(b => b.id === breakId);
    const analysis = analysisText[breakId] || '';
    const [reason, setReason] = useState('');
    const [decisionType, setDecisionType] = useState<'escalate' | 'override'>('escalate');
    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
    const [targetTeam, setTargetTeam] = useState(() => {
        if (!selectedBreak) return 'Settlements Desk';
        const rt = selectedBreak.route?.toLowerCase() || '';
        if (rt.includes('pricing') || rt.includes('val')) return 'Pricing & Valuations';
        if (rt.includes('corp') || rt.includes('act')) return 'Corporate Actions';
        if (rt.includes('fx')) return 'FX Desk';
        return 'Settlements Desk';
    });
    const [priority, setPriority] = useState(() => selectedBreak?.severity === 'HIGH' ? 'High' : 'Standard');
    const [ticketId, setTicketId] = useState('');
    const [escalateComments, setEscalateComments] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isEditingEmail, setIsEditingEmail] = useState(false);

    // Email fields — always visible, editable on toggle
    const defaultTo = useMemo(() => {
        if (targetTeam === 'Pricing & Valuations') return 'pricing-team@brokerage.com';
        if (targetTeam === 'Corporate Actions') return 'corporate-actions@brokerage.com';
        if (targetTeam === 'FX Desk') return 'fx-desk@brokerage.com';
        return 'settlements-desk@brokerage.com';
    }, [targetTeam]);

    const defaultSubject = useMemo(() => {
        if (!selectedBreak) return 'Break Escalation';
        const ticker = selectedBreak.ticker || 'Unknown';
        const bt = selectedBreak.breakType || 'Reconciliation Break';
        const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `${ticker} ${bt} — ${priority.toUpperCase()} — ${today}`;
    }, [selectedBreak, priority]);

    const defaultBody = useMemo(() => {
        if (!selectedBreak) return '';
        const ticker = selectedBreak.ticker || 'Unknown';
        const refId = selectedBreak.refId || breakId;
        const mvDiff = selectedBreak.mvDiff ? `$${Math.abs(selectedBreak.mvDiff).toLocaleString()}` : 'N/A';
        const desc = selectedBreak.desc || '';
        const bt = selectedBreak.breakType || 'Reconciliation Break';

        // Extract concise AI findings
        let findings = '';
        if (analysis) {
            const meaningful = analysis.split('\n')
                .filter(l => l.trim() && !l.startsWith('[') && l.length > 20)
                .slice(0, 4)
                .map(l => l.trim().substring(0, 150));
            findings = meaningful.join(' ');
        }

        const routeTeam = targetTeam || 'Settlements Desk';
        const priorityText = (priority === 'High' || priority === 'Urgent') ? 'immediate' : 'same-day';

        return `Hi ${routeTeam.split(' ')[0]},

${ticker} ${bt.toLowerCase()} of ${mvDiff} requiring ${priorityText} review. ${desc ? desc.substring(0, 200) : ''}${findings ? ` ${findings.substring(0, 200)}` : ''}

${refId}:
Need ${bt.toLowerCase().includes('pricing') ? 'pricing refresh and verification of after-hours feed coverage before 4PM NAV cut' : bt.toLowerCase().includes('split') ? 'confirmation of post-split position reconciliation at depository level' : bt.toLowerCase().includes('dividend') ? 'dividend receivable booking and ex-date price adjustment' : 'resolution pathway confirmation by EOD'}. Quantities reconciled clean, corporate actions verified clear.
${ticketId ? `\nTicket Reference: ${ticketId}` : ''}

Regards,
BreakOS

Brokerage Operations — Reconciliations`;
    }, [selectedBreak, analysis, breakId, targetTeam, priority, ticketId]);

    const [emailTo, setEmailTo] = useState('');
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');

    // Initialize email fields lazily
    const to = emailTo || defaultTo;
    const subject = emailSubject || defaultSubject;
    const body = emailBody || defaultBody;

    const handleOpenOutlook = () => {
        const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailtoUrl;
    };

    const toggleCheck = (key: string) => {
        setCheckedItems(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const allChecked = Object.values(checkedItems).filter(Boolean).length === 3;
    const canSubmit = decisionType === 'escalate' ? allChecked && escalateComments.trim().length > 0 : reason.trim().length > 0;
    const { addDecision } = useStore();

    const handleSubmit = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const finalReason = decisionType === 'escalate' ? 'Reviewed via BreakOS' : reason.trim();
            await submitDecision(breakId, decisionType, finalReason);
            addDecision(breakId, {
                type: decisionType,
                reason: finalReason,
                analyst: 'A. Aneja',
                timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            });
            setSubmitted(true);
        } catch (err) {
            console.error('Decision submit failed:', err);
        }
        setIsSubmitting(false);
    };

    if (submitted) {
        const team = selectedBreak?.route || 'Settlements Desk';
        const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        return (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-[var(--surface)] border border-[var(--green-muted)] rounded-3xl p-8 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col items-center justify-center text-center py-12"
            >
                <div className="w-14 h-14 rounded-full bg-[var(--green-muted)] flex items-center justify-center mb-5 border border-[var(--green-muted)]">
                    <Check size={28} className="text-[var(--green)]" strokeWidth={3} />
                </div>
                <h3 className="text-[18px] font-semibold text-[var(--green)] mb-1 tracking-tight">
                    {decisionType === 'escalate' ? `Escalated to ${team}` : 'Override Logged'}
                </h3>
                <p className="text-[14px] font-medium text-[var(--text-muted)] mt-2">
                    Logged at {time} · CIRO Rule 3200 compliant
                </p>
            </motion.div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Draft Email Card — Always Visible */}
            <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-3xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
            >
                {/* Email Header */}
                <div className="px-6 py-5 border-b border-[var(--border-subtle)] flex items-center justify-between">
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-[var(--surface-overlay)] flex items-center justify-center border border-[var(--border-subtle)] shadow-sm">
                            <Mail size={18} className="text-[var(--text-primary)]" />
                        </div>
                        <div>
                            <h3 className="text-[16px] font-semibold text-[var(--text-primary)] tracking-tight">Draft Email</h3>
                            <span className="text-[12px] text-[var(--text-muted)] mt-0.5 block tracking-wide">Auto-generated from AI analysis</span>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsEditingEmail(!isEditingEmail)}
                        className={cn(
                            "flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all duration-300 ease-out text-[13px] font-semibold shadow-sm",
                            isEditingEmail
                                ? "bg-[var(--accent)] text-[var(--accent-text)] border-[var(--accent)]"
                                : "bg-[var(--surface-overlay)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--text-secondary)]"
                        )}
                        title={isEditingEmail ? "Done editing" : "Edit email"}
                    >
                        {isEditingEmail ? (
                            <>
                                <Check size={14} />
                                Done
                            </>
                        ) : (
                            <>
                                <Edit3 size={14} />
                                Edit Draft
                            </>
                        )}
                    </button>
                </div>

                {/* Email Content */}
                <div className="p-5 space-y-3">
                    {/* To Field */}
                    <div className="flex items-start gap-3">
                        <span className="text-[11px] text-[var(--text-muted)] mt-1 w-12 shrink-0">To:</span>
                        {isEditingEmail ? (
                            <input
                                value={to}
                                onChange={(e) => setEmailTo(e.target.value)}
                                className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)]"
                            />
                        ) : (
                            <span className="text-[13px] font-medium text-[var(--text-primary)]">{to}</span>
                        )}
                    </div>

                    {/* Subject Field */}
                    <div className="flex items-start gap-3">
                        <span className="text-[11px] text-[var(--text-muted)] mt-1 w-12 shrink-0">Subject:</span>
                        {isEditingEmail ? (
                            <input
                                value={subject}
                                onChange={(e) => setEmailSubject(e.target.value)}
                                className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)]"
                            />
                        ) : (
                            <span className="text-[13px] font-semibold text-[var(--text-primary)]">{subject}</span>
                        )}
                    </div>

                    {/* Divider */}
                    <div className="border-t border-[var(--border-subtle)]" />

                    {/* Body */}
                    {isEditingEmail ? (
                        <textarea
                            value={body}
                            onChange={(e) => setEmailBody(e.target.value)}
                            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 text-[13px] text-[var(--text-primary)] leading-[1.7] resize-none h-48 focus:outline-none focus:border-[var(--text-primary)] transition-colors"
                        />
                    ) : (
                        <div className="text-[13px] text-[var(--text-primary)] leading-[1.7] whitespace-pre-wrap">
                            {body}
                        </div>
                    )}
                </div>

                {/* Email Actions */}
                <div className="px-5 py-3 border-t border-[var(--border-subtle)] flex items-center gap-3">
                    <button
                        onClick={handleOpenOutlook}
                        className="flex items-center gap-2 px-4 py-2 bg-[var(--surface-overlay)] text-[var(--text-primary)] rounded-xl text-[12px] font-semibold hover:bg-[var(--accent-muted)] transition-all"
                    >
                        <ExternalLink size={12} />
                        Open in Outlook
                    </button>
                    <span className="text-[10px] text-[var(--text-muted)]">Opens Microsoft Outlook on Mac. Edit with the pencil icon above.</span>
                </div>
            </motion.div>

            {/* Human Decision Gate */}
            <motion.div
                initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 }}
                className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-3xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
            >
                {/* Header */}
                <div className="px-6 py-5 border-b border-[var(--border-subtle)] flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[var(--surface-overlay)] flex items-center justify-center border border-[var(--border-subtle)] shadow-sm">
                        <ShieldCheck size={18} className="text-[var(--text-primary)]" />
                    </div>
                    <div>
                        <h3 className="text-[16px] font-semibold text-[var(--text-primary)] tracking-tight">Human Decision Gate</h3>
                        <span className="text-[12px] font-medium text-[var(--text-muted)] mt-0.5 block tracking-wide">CIRO Rule 3200 · Required for material breaks</span>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Decision Type Toggle */}
                    <div>
                        <span className="text-[12px] uppercase font-bold text-[var(--text-muted)] tracking-widest block mb-2.5">Decision</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setDecisionType('escalate')}
                                className={cn(
                                    "flex-1 py-3 rounded-xl text-[14px] font-semibold transition-all duration-300 flex items-center justify-center gap-2",
                                    decisionType === 'escalate'
                                        ? "bg-[var(--red)] text-white shadow-sm"
                                        : "bg-[var(--surface-overlay)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent hover:border-[var(--border-subtle)]"
                                )}
                            >
                                <AlertTriangle size={16} /> Escalate
                            </button>
                            <button
                                onClick={() => setDecisionType('override')}
                                className={cn(
                                    "flex-1 py-3 rounded-xl text-[14px] font-semibold transition-all duration-300 flex items-center justify-center gap-2",
                                    decisionType === 'override'
                                        ? "bg-[var(--accent)] text-[var(--accent-text)] shadow-sm"
                                        : "bg-[var(--surface-overlay)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent hover:border-[var(--border-subtle)]"
                                )}
                            >
                                <ShieldCheck size={16} /> Override
                            </button>
                        </div>
                    </div>

                    {/* Checklist / Override Reason */}
                    {decisionType === 'escalate' ? (
                        <div className="space-y-4">
                            {/* Operational Fields Grid */}
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <span className="text-[11px] uppercase font-bold text-[var(--text-muted)] tracking-wider block mb-1.5 flex items-center justify-between">
                                        Route To
                                    </span>
                                    <select
                                        value={targetTeam}
                                        onChange={e => setTargetTeam(e.target.value)}
                                        className="w-full bg-[var(--surface-overlay)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-secondary)] transition-colors cursor-pointer"
                                    >
                                        <option value="Settlements Desk">Settlements Desk</option>
                                        <option value="Corporate Actions">Corporate Actions</option>
                                        <option value="Pricing & Valuations">Pricing & Valuations</option>
                                        <option value="FX Desk">FX Desk</option>
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <span className="text-[11px] uppercase font-bold text-[var(--text-muted)] tracking-wider block mb-1.5 flex items-center justify-between">
                                        Priority
                                    </span>
                                    <select
                                        value={priority}
                                        onChange={e => setPriority(e.target.value)}
                                        className="w-full bg-[var(--surface-overlay)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-secondary)] transition-colors cursor-pointer"
                                    >
                                        <option value="Standard">Standard</option>
                                        <option value="High">High</option>
                                        <option value="Urgent">Urgent</option>
                                    </select>
                                </div>
                                <div className="flex-[0.8]">
                                    <span className="text-[11px] uppercase font-bold text-[var(--text-muted)] tracking-wider block mb-1.5 flex items-center justify-between">
                                        Ticket ID <span className="text-[9px] opacity-60 font-normal normal-case">(Opt)</span>
                                    </span>
                                    <input
                                        type="text"
                                        value={ticketId}
                                        onChange={e => setTicketId(e.target.value)}
                                        placeholder="e.g. INC-1044"
                                        className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-muted)] transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <span className="text-[12px] uppercase font-bold text-[var(--text-muted)] tracking-widest block mb-2">Verification</span>
                                    <div className="space-y-2 mt-2">
                                        {['AI analysis reviewed', 'Source cross-referenced', 'Materiality assessed'].map(item => (
                                            <label key={item} className="flex items-center gap-2.5 cursor-pointer group" onClick={() => toggleCheck(item)}>
                                                <div
                                                    className={cn(
                                                        "w-5 h-5 rounded-[6px] border-[1.5px] border-[var(--text-muted)] flex items-center justify-center transition-all duration-300",
                                                        checkedItems[item] && "bg-[var(--red)] border-[var(--red)]"
                                                    )}
                                                >
                                                    {checkedItems[item] && <Check size={12} className="text-white" strokeWidth={3} />}
                                                </div>
                                                <span className="text-[13px] font-medium text-[var(--text-secondary)]">{item}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex-[1.5]">
                                    <span className="text-[12px] uppercase font-bold text-[var(--text-muted)] tracking-widest block mb-1.5 flex justify-between items-center">
                                        Analyst Comments <span className="text-[var(--red)]">*</span>
                                    </span>
                                    <textarea
                                        value={escalateComments}
                                        onChange={e => setEscalateComments(e.target.value)}
                                        className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 text-[13px] text-[var(--text-primary)] leading-[1.7] resize-none h-24 focus:outline-none focus:border-[var(--text-muted)] transition-colors"
                                        placeholder="Add context for the receiving team..."
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <span className="text-[12px] uppercase font-bold text-[var(--text-muted)] tracking-widest block mb-2.5">Override Reason</span>
                            <textarea
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 text-[14px] text-[var(--text-primary)] leading-[1.8] resize-none h-28 focus:outline-none focus:border-[var(--text-primary)] transition-colors font-medium"
                                placeholder="Required: Explain why AI recommendation is being overridden..."
                            />
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        onClick={handleSubmit}
                        disabled={!canSubmit || isSubmitting}
                        className={cn(
                            "w-full py-3.5 rounded-2xl text-[15px] font-semibold transition-all duration-300 ease-out shadow-sm",
                            canSubmit
                                ? decisionType === 'escalate'
                                    ? "bg-[var(--red)] text-white hover:-translate-y-[1px] hover:shadow-lg"
                                    : "bg-[var(--accent)] text-[var(--accent-text)] hover:-translate-y-[1px] hover:shadow-lg"
                                : "bg-[var(--surface-overlay)] text-[var(--text-muted)] cursor-not-allowed border border-[var(--border-subtle)]"
                        )}
                    >
                        {isSubmitting ? 'Submitting...' : decisionType === 'escalate' ? 'Confirm Escalation' : 'Confirm Override'}
                    </button>

                    <p className="text-[10px] text-[var(--text-muted)] text-center">
                        All decisions are logged with timestamp and full audit trail per CIRO Rule 3200.
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
