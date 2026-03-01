import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { uploadFile, loadSampleReport } from '../../lib/api';
import { useStore } from '../../store';

export function FileUpload() {
    const { setBreaks } = useStore();
    const [status, setStatus] = useState<'idle' | 'processing' | 'done'>('idle');
    const [dragOver, setDragOver] = useState(false);

    const handleFile = useCallback(async (file: File) => {
        setStatus('processing');
        try {
            const result = await uploadFile(file);
            setBreaks(result.breaks);
            setStatus('done');
            setTimeout(() => setStatus('idle'), 2500);
        } catch (err) {
            console.error('Upload failed:', err);
            setStatus('idle');
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

    return (
        <div className="w-full bg-[var(--surface)] border border-[var(--border-subtle)] rounded-3xl p-7 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="flex justify-between items-center mb-5">
                <div>
                    <h3 className="text-[16px] font-semibold text-[var(--text-primary)] tracking-tight mb-0.5">Load Break Report</h3>
                    <p className="text-[13px] text-[var(--text-secondary)] font-medium tracking-wide">Upload .xlsx or generate synthetic sample data</p>
                </div>
            </div>

            <div className="flex gap-4">
                {/* Drop Zone */}
                <label
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    className={cn(
                        "flex-1 border border-dashed rounded-2xl p-5 flex items-center justify-center cursor-pointer transition-all duration-300 ease-out",
                        dragOver
                            ? "border-[var(--accent-dim)] bg-[var(--accent-muted)]"
                            : "border-[var(--border)] hover:border-[var(--text-muted)] hover:bg-[var(--surface-overlay)]",
                        status === 'processing' && "opacity-50 pointer-events-none"
                    )}
                >
                    <input type="file" accept=".xlsx,.xls,.csv" onChange={handleInputChange} className="hidden" />
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[var(--surface)] border border-[var(--border-subtle)] flex items-center justify-center shadow-sm">
                            <Upload size={18} className="text-[var(--text-secondary)]" strokeWidth={2} />
                        </div>
                        <div>
                            <span className="text-[14px] font-medium text-[var(--text-primary)]">Drop file or browse</span>
                        </div>
                    </div>
                </label>

                {/* Generate Sample */}
                <button
                    onClick={handleSample}
                    disabled={status === 'processing'}
                    className={cn(
                        "flex items-center gap-2.5 px-6 py-4 rounded-2xl border border-[var(--border-subtle)] transition-all duration-300 ease-out shadow-sm",
                        "text-[14px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-raised)] hover:border-[var(--border)]",
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
