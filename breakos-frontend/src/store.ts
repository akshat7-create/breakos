import { create } from 'zustand';
import { BreakRecord } from './lib/api';
import { writeResolutionToHistory } from './lib/patternMemory';

export type { BreakRecord };

export interface LoadingStep {
  label: string;
  status: 'pending' | 'loading' | 'done';
  result?: string;
}

export type ViewId = 'overview' | 'queue' | 'investigation' | 'audit' | 'settings';

interface BreakOSState {
  theme: 'dark' | 'light';
  activeView: ViewId;
  breaks: BreakRecord[];
  selectedBreakId: string | null;
  triageStatus: 'idle' | 'loading' | 'complete';
  investigationStatus: Record<string, 'idle' | 'loading' | 'streaming' | 'complete'>;
  analysisText: Record<string, string>;
  loadingSteps: Record<string, LoadingStep[]>;
  dataSources: Record<string, string[]>;
  investigationSummary: Record<string, string[]>;
  apiStatus: 'active' | 'error' | 'checking';

  toggleTheme: () => void;
  setActiveView: (v: ViewId) => void;
  setBreaks: (breaks: BreakRecord[]) => void;
  setSelectedBreakId: (id: string | null) => void;
  setTriageStatus: (s: 'idle' | 'loading' | 'complete') => void;
  setInvestigationStatus: (breakId: string, s: 'idle' | 'loading' | 'streaming' | 'complete') => void;
  appendAnalysisText: (breakId: string, chunk: string) => void;
  clearAnalysisText: (breakId: string) => void;
  setLoadingSteps: (breakId: string, steps: LoadingStep[] | ((prev: LoadingStep[]) => LoadingStep[])) => void;
  setDataSources: (breakId: string, sources: string[]) => void;
  setInvestigationSummary: (breakId: string, bullets: string[]) => void;
  setApiStatus: (s: 'active' | 'error' | 'checking') => void;
  decisions: Record<string, any>;
  addDecision: (breakId: string, decision: any) => void;
}

export const useStore = create<BreakOSState>((set, get) => ({
  theme: (typeof window !== 'undefined' && localStorage.getItem('breakos-theme') === 'light') ? 'light' : 'dark',
  activeView: 'overview' as ViewId,
  breaks: [],
  selectedBreakId: null,
  triageStatus: 'idle',
  investigationStatus: {},
  analysisText: {},
  loadingSteps: {},
  dataSources: {},
  investigationSummary: {},
  apiStatus: 'checking',
  decisions: {},

  addDecision: (breakId, decision) =>
    set((state) => {
      // Side-effect: write resolution pattern to localStorage if needed
      writeResolutionToHistory(decision.type, decision.reason);

      const updatedBreaks = state.breaks.map(b =>
        b.id === breakId ? { ...b, status: 'investigated' as const, decision } : b
      );
      return {
        decisions: { ...state.decisions, [breakId]: decision },
        breaks: updatedBreaks
      };
    }),

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('breakos-theme', next);
    document.documentElement.setAttribute('data-theme', next);
    set({ theme: next });
  },

  setActiveView: (v) => set({ activeView: v }),

  setBreaks: (breaks) => set({
    breaks,
    investigationStatus: {},
    analysisText: {},
    loadingSteps: {},
    dataSources: {},
    investigationSummary: {},
    decisions: {},
    selectedBreakId: null,
    triageStatus: 'idle'
  }),
  setSelectedBreakId: (id) => set({ selectedBreakId: id }),
  setTriageStatus: (s) => set({ triageStatus: s }),

  setInvestigationStatus: (breakId, s) =>
    set((state) => ({ investigationStatus: { ...state.investigationStatus, [breakId]: s } })),

  appendAnalysisText: (breakId, chunk) =>
    set((state) => ({
      analysisText: { ...state.analysisText, [breakId]: (state.analysisText[breakId] || '') + chunk }
    })),

  clearAnalysisText: (breakId) =>
    set((state) => ({ analysisText: { ...state.analysisText, [breakId]: '' } })),

  setLoadingSteps: (breakId, stepsOrFn) =>
    set((state) => {
      const prev = state.loadingSteps[breakId] || [];
      const next = typeof stepsOrFn === 'function' ? stepsOrFn(prev) : stepsOrFn;
      return { loadingSteps: { ...state.loadingSteps, [breakId]: next } };
    }),

  setDataSources: (breakId, sources) =>
    set((state) => ({ dataSources: { ...state.dataSources, [breakId]: sources } })),

  setInvestigationSummary: (breakId, bullets) =>
    set((state) => ({ investigationSummary: { ...state.investigationSummary, [breakId]: bullets } })),

  setApiStatus: (s) => set({ apiStatus: s }),
}));
