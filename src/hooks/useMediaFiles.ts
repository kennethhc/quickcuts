import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { v4 as uuidv4 } from 'uuid';
import type { MediaFile } from '../types';
import { useProjectStore } from '../stores/projectStore';
import { getMediaType, DEFAULT_IMAGE_DURATION } from '../utils/mediaUtils';

interface MediaMetadata {
  path: string;
  name: string;
  media_type: string;
  duration: number;
  width: number;
  height: number;
  timestamp: number;
  thumbnail: string | null;
  framerate: number | null;
  bitrate: number | null;
}

export function useMediaFiles() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addMediaFiles = useProjectStore((state) => state.addMediaFiles);
  const updateMediaFile = useProjectStore((state) => state.updateMediaFile);
  const mediaFiles = useProjectStore((state) => state.mediaFiles);

  // Lazy load thumbnails in background (#4 optimization)
  useEffect(() => {
    const loadThumbnails = async () => {
      // Find files without thumbnails
      const filesNeedingThumbs = mediaFiles.filter((f) => !f.thumbnail);
      if (filesNeedingThumbs.length === 0) return;

      // Prepare batch request
      const items: [string, string][] = filesNeedingThumbs.map((f) => [f.path, f.type]);

      try {
        const results: [string, string | null][] = await invoke('generate_thumbnails_batch', { items });

        // Update files with thumbnails
        for (const [path, thumbnail] of results) {
          if (thumbnail) {
            const file = mediaFiles.find((f) => f.path === path);
            if (file && updateMediaFile) {
              updateMediaFile(file.id, { thumbnail });
            }
          }
        }
      } catch (err) {
        console.error('Failed to generate thumbnails:', err);
      }
    };

    // Debounce thumbnail loading
    const timer = setTimeout(loadThumbnails, 100);
    return () => clearTimeout(timer);
  }, [mediaFiles, updateMediaFile]);

  const processFiles = useCallback(async (paths: string[]) => {
    setIsLoading(true);
    setError(null);

    try {
      // Get metadata for all files (parallel, no thumbnails - fast!)
      const metadataList: MediaMetadata[] = await invoke('get_media_metadata_batch', { paths });

      // Convert to MediaFile format (no thumbnails yet)
      const mediaFilesNew: MediaFile[] = metadataList.map((meta) => ({
        id: uuidv4(),
        name: meta.name,
        path: meta.path,
        type: meta.media_type as 'video' | 'image',
        duration: meta.media_type === 'image' ? DEFAULT_IMAGE_DURATION : meta.duration,
        timestamp: meta.timestamp,
        thumbnail: meta.thumbnail || undefined, // Will be loaded lazily
        width: meta.width,
        height: meta.height,
        framerate: meta.framerate || undefined,
        bitrate: meta.bitrate || undefined,
      }));

      addMediaFiles(mediaFilesNew);
      return mediaFilesNew;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process files';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [addMediaFiles]);

  const processDroppedFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validPaths: string[] = [];

    for (const file of fileArray) {
      const mediaType = getMediaType(file.name);
      if (mediaType) {
        const path = (file as unknown as { path?: string }).path || file.name;
        validPaths.push(path);
      }
    }

    if (validPaths.length === 0) {
      setError('No valid media files found');
      return [];
    }

    return processFiles(validPaths);
  }, [processFiles]);

  return {
    isLoading,
    error,
    processFiles,
    processDroppedFiles,
    clearError: () => setError(null),
  };
}
