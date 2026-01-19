import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export function useFFmpeg() {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkFFmpeg = async () => {
      try {
        const available: boolean = await invoke('check_ffmpeg');
        setIsAvailable(available);

        if (available) {
          const ver: string = await invoke('get_ffmpeg_version');
          setVersion(ver);
        }
      } catch (err) {
        setIsAvailable(false);
        setError(err instanceof Error ? err.message : 'Failed to check FFmpeg');
      }
    };

    checkFFmpeg();
  }, []);

  const getVideoDuration = useCallback(async (path: string): Promise<number> => {
    try {
      const duration: number = await invoke('get_video_duration', { path });
      return duration;
    } catch (err) {
      console.error('Failed to get video duration:', err);
      return 0;
    }
  }, []);

  return {
    isAvailable,
    version,
    error,
    getVideoDuration,
  };
}
