import type { MediaFile, MediaType } from '../types';

// Supported file extensions
export const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
export const ALL_EXTENSIONS = [...VIDEO_EXTENSIONS, ...IMAGE_EXTENSIONS];

// Default duration for images (in seconds)
export const DEFAULT_IMAGE_DURATION = 4;

// Default duration for cover text (in seconds)
export const DEFAULT_COVER_DURATION = 4;

/**
 * Get the media type from a file extension
 */
export const getMediaType = (filename: string): MediaType | null => {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  return null;
};

/**
 * Check if a file is a supported media type
 */
export const isSupportedMedia = (filename: string): boolean => {
  return getMediaType(filename) !== null;
};

/**
 * Format duration in seconds to MM:SS or HH:MM:SS
 */
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Format file size in bytes to human-readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Get a human-readable file name without extension
 */
export const getDisplayName = (filename: string): string => {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.slice(0, lastDot) : filename;
};

/**
 * Generate a timestamp-based filename
 */
export const generateOutputFilename = (preset: string): string => {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `snappy-${preset}-${timestamp}.mp4`;
};

/**
 * Calculate aspect ratio string from dimensions
 */
export const calculateAspectRatio = (width: number, height: number): string => {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
};

/**
 * Check if file path has a supported extension
 */
export const hasValidExtension = (path: string): boolean => {
  const ext = path.toLowerCase().slice(path.lastIndexOf('.'));
  return ALL_EXTENSIONS.includes(ext);
};

/**
 * Sort media files by timestamp
 */
export const sortByTimestamp = (files: MediaFile[]): MediaFile[] => {
  return [...files].sort((a, b) => a.timestamp - b.timestamp);
};

/**
 * Get the file extension from a path
 */
export const getFileExtension = (path: string): string => {
  return path.slice(path.lastIndexOf('.')).toLowerCase();
};

/**
 * Validate media file dimensions
 */
export const validateDimensions = (
  width: number,
  height: number,
  minWidth = 100,
  minHeight = 100,
  maxWidth = 7680,
  maxHeight = 4320
): boolean => {
  return width >= minWidth && width <= maxWidth && height >= minHeight && height <= maxHeight;
};
