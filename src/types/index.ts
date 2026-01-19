// Media file types
export type MediaType = 'video' | 'image';

export interface MediaFile {
  id: string;
  name: string;
  path: string;
  type: MediaType;
  duration: number; // in seconds (4s for images, actual duration for videos)
  timestamp: number; // file creation timestamp
  thumbnail?: string; // base64 thumbnail
  width?: number;
  height?: number;
  framerate?: number; // frames per second
  bitrate?: number; // bits per second
}

// Cover text configuration
export type CoverColorScheme = 'blackOnWhite' | 'whiteOnBlack';

export interface CoverConfig {
  enabled: boolean;
  text: string;
  duration: number; // fixed at 4 seconds
  colorScheme: CoverColorScheme;
}

// Format presets
export type PresetCategory = 'social' | 'professional';

export interface FormatPreset {
  id: string;
  name: string;
  category: PresetCategory;
  width: number;
  height: number;
  aspectRatio: string;
  codec: 'h264' | 'prores';
  description: string;
}

// Export configuration
export interface ExportConfig {
  preset: FormatPreset;
  outputPath: string;
}

// Export progress
export interface ExportProgress {
  stage: 'preparing' | 'processing' | 'concatenating' | 'finalizing' | 'complete' | 'error';
  progress: number; // 0-100
  currentFile?: string;
  error?: string;
}

// Project state
export interface ProjectState {
  // Media files
  mediaFiles: MediaFile[];

  // Cover configuration
  cover: CoverConfig;

  // Selected preset
  selectedPreset: FormatPreset | null;

  // Export state
  isExporting: boolean;
  exportProgress: ExportProgress | null;

  // UI state
  previewTime: number;
  isPlaying: boolean;
}

// Store actions
export interface ProjectActions {
  // Media file actions
  addMediaFiles: (files: MediaFile[]) => void;
  removeMediaFile: (id: string) => void;
  reorderMediaFiles: (fromIndex: number, toIndex: number) => void;
  clearMediaFiles: () => void;
  updateMediaFile: (id: string, updates: Partial<MediaFile>) => void;

  // Cover actions
  setCoverEnabled: (enabled: boolean) => void;
  setCoverText: (text: string) => void;
  setCoverColorScheme: (colorScheme: CoverColorScheme) => void;

  // Preset actions
  setSelectedPreset: (preset: FormatPreset) => void;

  // Export actions
  setIsExporting: (isExporting: boolean) => void;
  setExportProgress: (progress: ExportProgress | null) => void;

  // Preview actions
  setPreviewTime: (time: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;

  // Project actions
  resetProject: () => void;
}

export type ProjectStore = ProjectState & ProjectActions;
