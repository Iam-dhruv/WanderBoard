import { create } from 'zustand';

export type WorkspacePanelKey =
  | 'planning'
  | 'timeline'
  | 'bucket-list'
  | 'discovery'
  | 'weather'
  | 'expenses';

export interface WorkspacePanel {
  key: WorkspacePanelKey;
  width: number;
}

const DEFAULT_PANEL_WIDTH_RATIO = 0.25;
const MIN_PANEL_WIDTH_PX = 280;
const MIN_MAP_WIDTH_RATIO = 0.2;

interface WorkspacePanelState {
  openPanels: WorkspacePanel[];
  activePanelKey: WorkspacePanelKey;
  setFromRoute: (key: WorkspacePanelKey) => void;
  togglePanel: (key: WorkspacePanelKey) => void;
  focusPanel: (key: WorkspacePanelKey) => void;
  closePanel: (key: WorkspacePanelKey) => void;
  closeAll: () => void;
  resizePanel: (key: WorkspacePanelKey, nextWidth: number) => void;
}

function getDefaultPanelWidth(): number {
  if (typeof window === 'undefined') return 360;
  return Math.max(MIN_PANEL_WIDTH_PX, Math.floor(window.innerWidth * DEFAULT_PANEL_WIDTH_RATIO));
}

function clampPanelWidth(
  nextWidth: number,
  otherPanelTotal: number,
): number {
  if (typeof window === 'undefined') return Math.max(MIN_PANEL_WIDTH_PX, nextWidth);
  const maxTotalPanelWidth = Math.floor(window.innerWidth * (1 - MIN_MAP_WIDTH_RATIO));
  const maxCurrentWidth = Math.max(MIN_PANEL_WIDTH_PX, maxTotalPanelWidth - otherPanelTotal);
  return Math.max(MIN_PANEL_WIDTH_PX, Math.min(maxCurrentWidth, Math.floor(nextWidth)));
}

export const useWorkspacePanelStore = create<WorkspacePanelState>((set) => ({
  openPanels: [{ key: 'planning', width: getDefaultPanelWidth() }],
  activePanelKey: 'planning',

  setFromRoute: (key) => set((state) => {
    const existing = state.openPanels.find((panel) => panel.key === key);
    if (existing) {
      return { activePanelKey: key };
    }

    const nextPanels = [{ key, width: getDefaultPanelWidth() }, ...state.openPanels];
    const trimmed = nextPanels.slice(0, 3);

    return {
      openPanels: trimmed,
      activePanelKey: key,
    };
  }),

  togglePanel: (key) => set((state) => {
    const idx = state.openPanels.findIndex((panel) => panel.key === key);
    if (idx >= 0) {
      const nextPanels = state.openPanels.filter((panel) => panel.key !== key);
      const nextActive = state.activePanelKey === key
        ? (nextPanels[0]?.key ?? 'planning')
        : state.activePanelKey;
      return {
        openPanels: nextPanels,
        activePanelKey: nextActive,
      };
    }

    const nextPanels = [{ key, width: getDefaultPanelWidth() }, ...state.openPanels];
    const trimmed = nextPanels.slice(0, 3);
    return {
      openPanels: trimmed,
      activePanelKey: key,
    };
  }),

  focusPanel: (key) => set((state) => {
    if (!state.openPanels.some((panel) => panel.key === key)) return state;
    return { activePanelKey: key };
  }),

  closePanel: (key) => set((state) => {
    const nextPanels = state.openPanels.filter((panel) => panel.key !== key);
    const nextActive = state.activePanelKey === key
      ? (nextPanels[0]?.key ?? 'planning')
      : state.activePanelKey;
    return {
      openPanels: nextPanels,
      activePanelKey: nextActive,
    };
  }),

  closeAll: () => set({ openPanels: [] }),

  resizePanel: (key, nextWidth) => set((state) => {
    const target = state.openPanels.find((panel) => panel.key === key);
    if (!target) return state;

    const otherTotal = state.openPanels
      .filter((panel) => panel.key !== key)
      .reduce((sum, panel) => sum + panel.width, 0);
    const clampedWidth = clampPanelWidth(nextWidth, otherTotal);

    return {
      openPanels: state.openPanels.map((panel) => (
        panel.key === key ? { ...panel, width: clampedWidth } : panel
      )),
    };
  }),
}));
