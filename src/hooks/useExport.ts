import { useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { save } from '@tauri-apps/plugin-dialog';
import { downloadDir } from '@tauri-apps/api/path';
import { useProjectStore } from '../stores/projectStore';
import type { ExportProgress } from '../types';

interface ExportConfig {
  preset_id: string;
  width: number;
  height: number;
  codec: string;
  framerate: number | null;
  bitrate: number | null;
}

interface MediaItem {
  path: string;
  media_type: string;
  duration: number;
  width: number | null;
  height: number | null;
  framerate: number | null;
}

interface CoverConfig {
  enabled: boolean;
  text: string;
  duration: number;
  color_scheme: string;
}

export function useExport() {
  const {
    mediaFiles,
    cover,
    selectedPreset,
    isExporting,
    exportProgress,
    setIsExporting,
    setExportProgress,
  } = useProjectStore();

  // Listen for export progress events
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    let mounted = true;

    const setupListener = async () => {
      try {
        const unlistenFn = await listen<ExportProgress>('export-progress', (event) => {
          if (mounted) {
            setExportProgress(event.payload);
          }
        });
        if (mounted) {
          unlisten = unlistenFn;
        } else {
          // Component unmounted before listener was set up
          unlistenFn();
        }
      } catch (err) {
        console.error('Failed to set up export progress listener:', err);
      }
    };

    setupListener();

    return () => {
      mounted = false;
      if (unlisten) {
        unlisten();
      }
    };
  }, [setExportProgress]);

  const startExport = useCallback(async () => {
    if (!selectedPreset || mediaFiles.length === 0) {
      return null;
    }

    try {
      // Get first video to use its date for default filename
      const firstVideo = mediaFiles.find((f) => f.type === 'video');

      // Generate default filename based on first video's timestamp
      const defaultDate = firstVideo
        ? new Date(firstVideo.timestamp)
        : new Date();
      const dateStr = defaultDate.toISOString().slice(0, 10).replace(/-/g, '');
      const defaultName = `video_${dateStr}`;

      // Get Downloads directory for default location
      const downloadsPath = await downloadDir();

      // Show save dialog
      const outputPath = await save({
        defaultPath: `${downloadsPath}/${defaultName}.mp4`,
        filters: [{ name: 'Video', extensions: ['mp4', 'mov'] }],
        title: 'Save Video',
      });

      // User cancelled
      if (!outputPath) {
        return null;
      }

      setIsExporting(true);
      setExportProgress({
        stage: 'preparing',
        progress: 0,
      });

      const framerate = firstVideo?.framerate ?? null;
      const bitrate = firstVideo?.bitrate ?? null;

      // Prepare export config
      const config: ExportConfig = {
        preset_id: selectedPreset.id,
        width: selectedPreset.width,
        height: selectedPreset.height,
        codec: selectedPreset.codec,
        framerate,
        bitrate,
      };

      // Prepare media items
      const mediaItems: MediaItem[] = mediaFiles.map((file) => ({
        path: file.path,
        media_type: file.type,
        duration: file.duration,
        width: file.width ?? null,
        height: file.height ?? null,
        framerate: file.framerate ?? null,
      }));

      // Prepare cover config - enabled when text is not empty
      const coverConfig: CoverConfig = {
        enabled: cover.text.trim().length > 0,
        text: cover.text,
        duration: cover.duration,
        color_scheme: cover.colorScheme,
      };

      // Start export
      const result: string = await invoke('export_video', {
        mediaItems,
        cover: coverConfig,
        config,
        outputPath,
      });

      setExportProgress({
        stage: 'complete',
        progress: 100,
      });

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Export failed';
      setExportProgress({
        stage: 'error',
        progress: 0,
        error: errorMessage,
      });
      throw err;
    } finally {
      setIsExporting(false);
    }
  }, [
    mediaFiles,
    cover,
    selectedPreset,
    setIsExporting,
    setExportProgress,
  ]);

  const openInFinder = useCallback(async (path: string) => {
    try {
      await invoke('open_in_finder', { path });
    } catch (err) {
      console.error('Failed to open in Finder:', err);
    }
  }, []);

  const cancelExport = useCallback(() => {
    // Note: This doesn't actually cancel the FFmpeg process
    // In a production app, you'd need to implement proper cancellation
    setIsExporting(false);
    setExportProgress(null);
  }, [setIsExporting, setExportProgress]);

  return {
    isExporting,
    exportProgress,
    startExport,
    cancelExport,
    openInFinder,
    canExport: mediaFiles.length > 0 && selectedPreset !== null && !isExporting,
  };
}
