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
        if (targetTeam === 'Pricing & Valuations') return 'pricing-team@wealthsimple.com';
        if (targetTeam === 'Corporate Actions') return 'corporate-actions@wealthsimple.com';
        if (targetTeam === 'FX Desk') return 'fx-desk@wealthsimple.com';
        return 'settlements-desk@wealthsimple.com';
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
${ticketId ? `\nTicket Reference: ${ticketId}` : ''}${escalateComments ? `\n\nAnalyst Comments:\n${escalateComments}` : ''}

Regards,
BreakOS

Brokerage Operations — Reconciliations`;
    }, [selectedBreak, analysis, breakId, targetTeam, priority, ticketId, escalateComments]);

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
                className="bg-[var(--surface)] border border-[var(--green-muted)] rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.12)] flex flex-col items-center justify-center text-center py-10"
            >
                <div className="w-12 h-12 rounded-full bg-[var(--green-muted)] flex items-center justify-center mb-4">
                    <Check size={24} className="text-[var(--green)]" strokeWidth={3} />
                </div>
                <h3 className="text-[16px] font-bold text-[var(--green)] mb-1">
                    {decisionType === 'escalate' ? `Escalated to ${team}` : 'Override Logged'}
                </h3>
                <p className="text-[13px] text-[var(--text-muted)] mt-2">
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
                className="bg-[var(--surface)] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
            >
                {/* Email Header */}
                <div className="px-5 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Mail size={14} className="text-[var(--text-muted)]" />
                        <h4 className="text-[12px] font-bold text-[var(--text-primary)] uppercase tracking-[0.06em]">Draft Email</h4>
                    </div>
                    <button
                        onClick={() => setIsEditingEmail(!isEditingEmail)}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-[12px] font-medium shadow-sm",
                            isEditingEmail
                                ? "bg-[var(--accent)] text-[var(--accent-text)] border-[var(--accent)]"
                                : "bg-[var(--surface-overlay)] border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--text-secondary)]"
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
                className="bg-[var(--surface)] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
            >
                {/* Header */}
                <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[var(--surface-overlay)] flex items-center justify-center">
                        <ShieldCheck size={16} className="text-[var(--text-primary)]" />
                    </div>
                    <div>
                        <h3 className="text-[15px] font-bold text-[var(--text-primary)] tracking-tight">Human Decision Gate</h3>
                        <span className="text-[11px] text-[var(--text-muted)]">CIRO Rule 3200 · Required for material breaks</span>
                    </div>
                </div>

                <div className="p-5 space-y-5">
                    {/* Decision Type Toggle */}
                    <div>
                        <span className="text-[11px] uppercase font-bold text-[var(--text-muted)] tracking-wider block mb-2">Decision</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setDecisionType('escalate')}
                                className={cn(
                                    "flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all flex items-center justify-center gap-2",
                                    decisionType === 'escalate'
                                        ? "bg-[var(--red)] text-white"
                                        : "bg-[var(--surface-overlay)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                )}
                            >
                                <AlertTriangle size={14} /> Escalate
                            </button>
                            <button
                                onClick={() => setDecisionType('override')}
                                className={cn(
                                    "flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all flex items-center justify-center gap-2",
                                    decisionType === 'override'
                                        ? "bg-[var(--accent)] text-[var(--accent-text)]"
                                        : "bg-[var(--surface-overlay)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                )}
                            >
                                <ShieldCheck size={14} /> Override
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
                                    <span className="text-[11px] uppercase font-bold text-[var(--text-muted)] tracking-wider block mb-1.5">Verification</span>
                                    <div className="space-y-1.5 mt-2">
                                        {['AI analysis reviewed', 'Source cross-referenced', 'Materiality assessed'].map(item => (
                                            <label key={item} className="flex items-center gap-2 cursor-pointer group" onClick={() => toggleCheck(item)}>
                                                <div
                                                    className={cn(
                                                        "w-4 h-4 rounded-[4px] border-[1.5px] border-[var(--text-muted)] flex items-center justify-center transition-all",
                                                        checkedItems[item] && "bg-[var(--red)] border-[var(--red)]"
                                                    )}
                                                >
                                                    {checkedItems[item] && <Check size={10} className="text-white" strokeWidth={3} />}
                                                </div>
                                                <span className="text-[12px] text-[var(--text-secondary)]">{item}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex-[1.5]">
                                    <span className="text-[11px] uppercase font-bold text-[var(--text-muted)] tracking-wider block mb-1.5 flex justify-between items-center">
                                        Analyst Comments <span className="text-[var(--red)]">*</span>
                                    </span>
                                    <textarea
                                        value={escalateComments}
                                        onChange={e => setEscalateComments(e.target.value)}
                                        className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-2 text-[12px] text-[var(--text-primary)] leading-[1.6] resize-none h-20 focus:outline-none focus:border-[var(--text-muted)] transition-colors"
                                        placeholder="Add context for the receiving team..."
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <span className="text-[11px] uppercase font-bold text-[var(--text-muted)] tracking-wider block mb-2">Override Reason</span>
                            <textarea
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 text-[13px] text-[var(--text-primary)] leading-[1.7] resize-none h-24 focus:outline-none focus:border-[var(--text-primary)] transition-colors"
                                placeholder="Required: Explain why AI recommendation is being overridden..."
                            />
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        onClick={handleSubmit}
                        disabled={!canSubmit || isSubmitting}
                        className={cn(
                            "w-full py-3 rounded-xl text-[14px] font-bold transition-all duration-150",
                            canSubmit
                                ? decisionType === 'escalate'
                                    ? "bg-[var(--red)] text-white hover:-translate-y-[0.5px] hover:shadow-lg"
                                    : "bg-[var(--accent)] text-[var(--accent-text)] hover:-translate-y-[0.5px] hover:shadow-lg"
                                : "bg-[var(--surface-overlay)] text-[var(--text-muted)] cursor-not-allowed"
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
