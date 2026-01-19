import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { ProjectStore, MediaFile, FormatPreset, ExportProgress, CoverConfig } from '../types';
import { DEFAULT_PRESET, getPresetByAspectRatio } from '../utils/presets';

const initialCover: CoverConfig = {
  enabled: true, // kept for compatibility, but we derive from text
  text: '',
  duration: 4,
  colorScheme: 'blackOnWhite',
};

const initialState = {
  mediaFiles: [] as MediaFile[],
  cover: initialCover,
  selectedPreset: DEFAULT_PRESET as FormatPreset | null,
  isExporting: false,
  exportProgress: null as ExportProgress | null,
  previewTime: 0,
  isPlaying: false,
};

export const useProjectStore = create<ProjectStore>((set) => ({
  ...initialState,

  // Media file actions
  addMediaFiles: (files: MediaFile[]) => {
    set((state) => {
      // Sort by timestamp when adding
      const allFiles = [...state.mediaFiles, ...files].sort(
        (a, b) => a.timestamp - b.timestamp
      );

      // Auto-select preset based on first video if no media existed before
      let newPreset = state.selectedPreset;
      if (state.mediaFiles.length === 0 && allFiles.length > 0) {
        // Find first video
        const firstVideo = allFiles.find(f => f.type === 'video' && f.width && f.height);
        if (firstVideo && firstVideo.width && firstVideo.height) {
          newPreset = getPresetByAspectRatio(firstVideo.width, firstVideo.height);
        }
      }

      return { mediaFiles: allFiles, selectedPreset: newPreset };
    });
  },

  removeMediaFile: (id: string) => {
    set((state) => ({
      mediaFiles: state.mediaFiles.filter((f) => f.id !== id),
    }));
  },

  reorderMediaFiles: (fromIndex: number, toIndex: number) => {
    set((state) => {
      const files = [...state.mediaFiles];
      const [removed] = files.splice(fromIndex, 1);
      files.splice(toIndex, 0, removed);
      return { mediaFiles: files };
    });
  },

  clearMediaFiles: () => {
    set({ mediaFiles: [] });
  },

  updateMediaFile: (id: string, updates: Partial<MediaFile>) => {
    set((state) => ({
      mediaFiles: state.mediaFiles.map((f) =>
        f.id === id ? { ...f, ...updates } : f
      ),
    }));
  },

  // Cover actions
  setCoverEnabled: (enabled: boolean) => {
    set((state) => ({
      cover: { ...state.cover, enabled },
    }));
  },

  setCoverText: (text: string) => {
    set((state) => ({
      cover: { ...state.cover, text },
    }));
  },

  setCoverColorScheme: (colorScheme: CoverConfig['colorScheme']) => {
    set((state) => ({
      cover: { ...state.cover, colorScheme },
    }));
  },

  // Preset actions
  setSelectedPreset: (preset: FormatPreset) => {
    set({ selectedPreset: preset });
  },

  // Export actions
  setIsExporting: (isExporting: boolean) => {
    set({ isExporting });
  },

  setExportProgress: (progress: ExportProgress | null) => {
    set({ exportProgress: progress });
  },

  // Preview actions
  setPreviewTime: (time: number) => {
    set({ previewTime: time });
  },

  setIsPlaying: (isPlaying: boolean) => {
    set({ isPlaying });
  },

  // Project actions
  resetProject: () => {
    set(initialState);
  },
}));

// Selector hooks for common computed values
export const useTotalDuration = () => {
  return useProjectStore((state) => {
    // Cover is active when text is not empty
    const coverDuration = state.cover.text.trim() ? state.cover.duration : 0;
    const mediaDuration = state.mediaFiles.reduce((sum, file) => sum + file.duration, 0);
    return coverDuration + mediaDuration;
  });
};

export const useMediaCount = () => {
  return useProjectStore(
    useShallow((state) => ({
      total: state.mediaFiles.length,
      videos: state.mediaFiles.filter((f) => f.type === 'video').length,
      images: state.mediaFiles.filter((f) => f.type === 'image').length,
    }))
  );
};

export const useCanExport = () => {
  return useProjectStore((state) => {
    return (
      state.mediaFiles.length > 0 &&
      state.selectedPreset !== null &&
      !state.isExporting
    );
  });
};
