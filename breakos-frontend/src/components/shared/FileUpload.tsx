import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, Check, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { uploadFile, loadSampleReport } from '../../lib/api';
import { useStore } from '../../store';

export function FileUpload() {
    const { setBreaks } = useStore();
    const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
    const [dragOver, setDragOver] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string>('');

    const handleFile = useCallback(async (file: File) => {
        setStatus('processing');
        setErrorMsg('');
        try {
            const result = await uploadFile(file);
            setBreaks(result.breaks);
            setStatus('done');
            setTimeout(() => setStatus('idle'), 2500);
        } catch (err: any) {
            console.error('Upload failed:', err);
            setErrorMsg(err.message || 'An unknown error occurred during upload.');
            setStatus('error');
        }
    }, [setBreaks]);

    const handleSample = useCallback(async () => {
        setStatus('processing');
        try {
            const result = await loadSampleReport();
            setBreaks(result.breaks);
            setStatus('done');
            setTimeout(() => setStatus('idle'), 2500);
        } catch (err) {
            console.error('Sample load failed:', err);
            setStatus('idle');
        }
    }, [setBreaks]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    }, [handleFile]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
    }, [handleFile]);

    if (status === 'done') {
        return (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.4 }} className="w-full bg-[var(--surface)] border border-[var(--border-subtle)] rounded-3xl p-6 flex items-center justify-center gap-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                <div className="w-8 h-8 rounded-full bg-[var(--green-muted)] flex items-center justify-center">
                    <Check size={18} className="text-[var(--green)]" strokeWidth={2.5} />
                </div>
                <span className="text-[15px] font-medium text-[var(--text-primary)] tracking-tight">Break report loaded successfully. Analysis ready.</span>
            </motion.div>
        );
    }

    if (status === 'error') {
        return (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.4 }} className="w-full bg-[#3e1b1b]/20 border border-[#f05252]/30 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-center gap-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                <div className="w-8 h-8 rounded-full bg-[#f05252]/10 flex items-center justify-center flex-shrink-0">
                    <AlertCircle size={18} className="text-[#f05252]" strokeWidth={2.5} />
                </div>
                <div className="flex flex-col items-center sm:items-start flex-1 min-w-0">
                    <span className="text-[15px] font-semibold text-[#f05252] tracking-tight mb-0.5">Upload Failed</span>
                    <span className="text-[13px] font-medium text-[#f05252]/80 text-center sm:text-left break-words w-full">{errorMsg}</span>
                </div>
                <button
                    onClick={() => setStatus('idle')}
                    className="flex-shrink-0 px-4 py-2 mt-2 sm:mt-0 rounded-xl bg-[#f05252]/10 hover:bg-[#f05252]/20 text-[#f05252] text-[13px] font-semibold transition-colors border border-[#f05252]/20 whitespace-nowrap"
                >
                    Try Again
                </button>
            </motion.div>
        );
    }

    return (
        <div className="w-full bg-[var(--surface)] border border-[var(--border-subtle)] rounded-3xl p-7 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="flex justify-between items-center mb-5">
                <div>
                    <h3 className="text-[16px] font-semibold text-[var(--text-primary)] tracking-tight mb-0.5">Load Break Report</h3>
                    <p className="text-[13px] text-[var(--text-secondary)] font-medium tracking-wide">Upload .xlsx or generate synthetic sample data</p>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-stretch w-full">
                {/* Drop Zone */}
                <label
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    className={cn(
                        "flex-1 border-2 border-dashed rounded-2xl p-5 flex items-center justify-center cursor-pointer transition-all duration-300 ease-out min-w-0 break-words",
                        dragOver
                            ? "border-[var(--accent-dim)] bg-[var(--accent-muted)]"
                            : "border-[var(--border)] hover:border-[var(--text-secondary)] hover:bg-[var(--surface-overlay)]",
                        status === 'processing' && "opacity-50 pointer-events-none"
                    )}
                >
                    <input type="file" accept=".xlsx,.xls,.csv" onChange={handleInputChange} className="hidden" />
                    <div className="flex items-center gap-3 justify-center">
                        <div className="w-10 h-10 rounded-full bg-[var(--surface)] border border-[var(--border-subtle)] flex items-center justify-center shadow-sm flex-shrink-0">
                            <Upload size={18} className="text-[var(--text-secondary)]" strokeWidth={2} />
                        </div>
                        <div className="min-w-0">
                            <span className="text-[14px] font-medium text-[var(--text-primary)] truncate text-center sm:text-left block">Drop file or browse</span>
                        </div>
                    </div>
                </label>

                {/* Generate Sample */}
                <button
                    onClick={handleSample}
                    disabled={status === 'processing'}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl border-2 border-[var(--border)] transition-all duration-300 ease-out shadow-sm min-w-0 flex-shrink-0 whitespace-nowrap",
                        "text-[14px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-raised)] hover:border-[var(--text-secondary)]",
                        status === 'processing' && "opacity-50 cursor-not-allowed"
                    )}
                >
                    <FileSpreadsheet size={18} className="text-[var(--text-secondary)]" strokeWidth={2} />
                    {status === 'processing' ? 'Generating...' : 'Generate Sample'}
                </button>
            </div>
        </div>
    );
}
