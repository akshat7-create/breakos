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
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full bg-[var(--surface)] rounded-2xl p-6 flex items-center justify-center gap-3 shadow-[0_1px_3px_rgba(0,0,0,0.12)]">
                <Check size={20} className="text-[var(--green)]" strokeWidth={3} />
                <span className="text-[14px] font-semibold text-[var(--text-primary)]">Break report loaded successfully</span>
            </motion.div>
        );
    }

    return (
        <div className="w-full bg-[var(--surface)] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.12)]">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Load Break Report</h3>
                    <p className="text-[12px] text-[var(--text-muted)] mt-0.5">Upload .xlsx or generate sample data</p>
                </div>
            </div>

            <div className="flex gap-3">
                {/* Drop Zone */}
                <label
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    className={cn(
                        "flex-1 border-2 border-dashed rounded-xl p-4 flex items-center justify-center cursor-pointer transition-all duration-200",
                        dragOver
                            ? "border-[var(--accent)] bg-[var(--accent-muted)]"
                            : "border-[var(--border)] hover:border-[var(--text-muted)]",
                        status === 'processing' && "opacity-50 pointer-events-none"
                    )}
                >
                    <input type="file" accept=".xlsx,.xls,.csv" onChange={handleInputChange} className="hidden" />
                    <div className="flex items-center gap-3">
                        <Upload size={18} className="text-[var(--text-muted)]" />
                        <div>
                            <span className="text-[13px] text-[var(--text-secondary)]">Drop file or click to browse</span>
                        </div>
                    </div>
                </label>

                {/* Generate Sample */}
                <button
                    onClick={handleSample}
                    disabled={status === 'processing'}
                    className={cn(
                        "flex items-center gap-2 px-5 py-3 rounded-xl border border-[var(--border)] transition-all duration-150",
                        "text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-overlay)]",
                        status === 'processing' && "opacity-50 cursor-not-allowed"
                    )}
                >
                    <FileSpreadsheet size={16} className="text-[var(--text-muted)]" />
                    {status === 'processing' ? 'Loading...' : 'Generate Sample'}
                </button>
            </div>
        </div>
    );
}
