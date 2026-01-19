import type { FormatPreset } from '../types';

export const ALL_PRESETS: FormatPreset[] = [
  {
    id: 'portrait',
    name: 'Portrait',
    category: 'social',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    codec: 'h264',
    description: 'Reels, Shorts, TikTok',
  },
  {
    id: 'square',
    name: 'Square',
    category: 'social',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    codec: 'h264',
    description: 'Feed posts',
  },
  {
    id: 'landscape',
    name: 'Landscape',
    category: 'social',
    width: 1920,
    height: 1080,
    aspectRatio: '16:9',
    codec: 'h264',
    description: 'YouTube, standard video',
  },
];

export const getPresetById = (id: string): FormatPreset | undefined => {
  return ALL_PRESETS.find((preset) => preset.id === id);
};

// Get preset based on aspect ratio
export const getPresetByAspectRatio = (width: number, height: number): FormatPreset => {
  const ratio = width / height;

  if (ratio < 0.8) {
    // Portrait (9:16 = 0.5625)
    return ALL_PRESETS.find(p => p.id === 'portrait')!;
  } else if (ratio > 1.2) {
    // Landscape (16:9 = 1.778)
    return ALL_PRESETS.find(p => p.id === 'landscape')!;
  } else {
    // Square (1:1 = 1.0)
    return ALL_PRESETS.find(p => p.id === 'square')!;
  }
};

export const DEFAULT_PRESET = ALL_PRESETS[0]; // Portrait
