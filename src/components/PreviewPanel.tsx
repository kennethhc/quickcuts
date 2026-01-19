import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useProjectStore, useTotalDuration } from '../stores/projectStore';
import { formatDuration } from '../utils/mediaUtils';

// Binary search to find segment containing given time - O(log n) instead of O(n)
function findSegmentIndex(segments: Array<{ startTime: number; endTime: number }>, time: number): number {
  if (segments.length === 0) return -1;

  let left = 0;
  let right = segments.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const segment = segments[mid];

    if (time >= segment.startTime && time < segment.endTime) {
      return mid;
    } else if (time < segment.startTime) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  // Return last segment if at the end
  return segments.length - 1;
}

// Throttle function for scrubber updates
function useThrottle<T>(value: T, limit: number): T {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastRan = useRef(Date.now());

  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= limit) {
        setThrottledValue(value);
        lastRan.current = Date.now();
      }
    }, limit - (Date.now() - lastRan.current));

    return () => clearTimeout(handler);
  }, [value, limit]);

  return throttledValue;
}

export function PreviewPanel() {
  // Granular selectors - only subscribe to what's needed (#5)
  const mediaFiles = useProjectStore((state) => state.mediaFiles);
  const cover = useProjectStore((state) => state.cover);
  const selectedPreset = useProjectStore((state) => state.selectedPreset);
  const previewTime = useProjectStore((state) => state.previewTime);
  const setPreviewTime = useProjectStore((state) => state.setPreviewTime);

  const totalDuration = useTotalDuration();
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const coverTimerRef = useRef<number | null>(null);

  // Throttle preview time for display updates (#10)
  const throttledPreviewTime = useThrottle(previewTime, 33); // ~30fps

  // Calculate timeline segments for each item (memoized)
  const segments = useMemo(() => {
    const result: Array<{ type: 'cover' | 'media'; startTime: number; endTime: number; item: any }> = [];
    let time = 0;
    const showCover = cover.text.trim().length > 0;

    if (showCover) {
      result.push({ type: 'cover', startTime: 0, endTime: cover.duration, item: cover });
      time = cover.duration;
    }

    for (const file of mediaFiles) {
      result.push({ type: 'media', startTime: time, endTime: time + file.duration, item: file });
      time += file.duration;
    }

    return result;
  }, [mediaFiles, cover]);

  // Find current segment using binary search (#3)
  const currentSegment = useMemo(() => {
    const index = findSegmentIndex(segments, previewTime);
    return index >= 0 ? segments[index] : null;
  }, [segments, previewTime]);

  // Get aspect ratio from preset
  const aspectRatio = selectedPreset
    ? `${selectedPreset.width} / ${selectedPreset.height}`
    : '16 / 9';

  // Convert file path to loadable URL
  const getFileSrc = useCallback((path: string) => {
    try {
      return convertFileSrc(path);
    } catch {
      return path;
    }
  }, []);

  // Handle video time updates - throttled internally
  const lastUpdateRef = useRef(0);
  const handleVideoTimeUpdate = useCallback(() => {
    const now = Date.now();
    if (now - lastUpdateRef.current < 33) return; // Throttle to ~30fps
    lastUpdateRef.current = now;

    if (videoRef.current && currentSegment?.type === 'media' && isPlaying) {
      const newTime = currentSegment.startTime + videoRef.current.currentTime;
      setPreviewTime(Math.min(newTime, totalDuration));
    }
  }, [currentSegment, setPreviewTime, totalDuration, isPlaying]);

  // Handle video ended - move to next segment
  const handleVideoEnded = useCallback(() => {
    if (!currentSegment) return;

    const currentIndex = segments.indexOf(currentSegment);
    const nextSegment = segments[currentIndex + 1];

    if (nextSegment) {
      setPreviewTime(nextSegment.startTime);
    } else {
      setIsPlaying(false);
      setPreviewTime(0);
    }
  }, [currentSegment, segments, setPreviewTime]);

  // Handle cover timer during playback
  useEffect(() => {
    if (isPlaying && currentSegment?.type === 'cover') {
      const startTime = Date.now();
      const startPreviewTime = previewTime;
      const endTime = currentSegment.endTime;

      const tick = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const newTime = startPreviewTime + elapsed;

        if (newTime >= endTime) {
          const currentIndex = segments.indexOf(currentSegment);
          const nextSegment = segments[currentIndex + 1];
          if (nextSegment) {
            setPreviewTime(nextSegment.startTime);
          } else {
            setIsPlaying(false);
            setPreviewTime(0);
          }
        } else {
          setPreviewTime(newTime);
          coverTimerRef.current = requestAnimationFrame(tick);
        }
      };

      coverTimerRef.current = requestAnimationFrame(tick);

      return () => {
        if (coverTimerRef.current) {
          cancelAnimationFrame(coverTimerRef.current);
        }
      };
    }
  }, [isPlaying, currentSegment, segments, previewTime, setPreviewTime]);

  // Sync video playback when segment changes or play state changes
  useEffect(() => {
    if (!videoRef.current || !currentSegment || currentSegment.type !== 'media') return;

    const video = videoRef.current;
    const videoTime = previewTime - currentSegment.startTime;

    if (Math.abs(video.currentTime - videoTime) > 0.3) {
      video.currentTime = Math.max(0, Math.min(videoTime, video.duration || Infinity));
    }

    if (isPlaying && video.paused) {
      video.play().catch(() => {});
    } else if (!isPlaying && !video.paused) {
      video.pause();
    }
  }, [isPlaying, currentSegment, previewTime]);

  // Handle scrubber change with ref for immediate video seeking
  const handleTimeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setPreviewTime(newTime);
    setIsPlaying(false);

    // Immediate video seek using ref (not dependent on state update)
    if (videoRef.current) {
      const segIndex = findSegmentIndex(segments, newTime);
      if (segIndex >= 0) {
        const seg = segments[segIndex];
        if (seg.type === 'media') {
          const videoTime = newTime - seg.startTime;
          if (videoTime >= 0) {
            videoRef.current.currentTime = videoTime;
          }
        }
      }
    }
  }, [segments, setPreviewTime]);

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    if (segments.length === 0) return;

    if (isPlaying) {
      setIsPlaying(false);
      if (videoRef.current) {
        videoRef.current.pause();
      }
    } else {
      if (previewTime >= totalDuration - 0.1) {
        setPreviewTime(0);
      }
      setIsPlaying(true);
    }
  }, [segments.length, isPlaying, previewTime, totalDuration, setPreviewTime]);

  const hasContent = mediaFiles.length > 0 || cover.text.trim().length > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Preview area with selected aspect ratio */}
      <div className="flex-1 flex items-center justify-center p-2 bg-gray-900/50 rounded-xl min-h-0 overflow-hidden">
        <div
          className="relative bg-black rounded-lg overflow-hidden shadow-2xl flex items-center justify-center"
          style={{
            aspectRatio,
            maxWidth: '100%',
            maxHeight: '100%',
            width: 'auto',
            height: 'auto',
          }}
        >
          {!hasContent ? (
            <div className="flex flex-col items-center justify-center text-gray-500 p-8">
              <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="text-sm">Preview will appear here</p>
            </div>
          ) : currentSegment?.type === 'cover' ? (
            <div className={`absolute inset-0 flex items-center justify-center p-8 ${
              cover.colorScheme === 'blackOnWhite' ? 'bg-white' : 'bg-black'
            }`}>
              <p
                className={`font-bold text-center break-words leading-tight ${
                  cover.colorScheme === 'blackOnWhite' ? 'text-black' : 'text-white'
                }`}
                style={{
                  fontFamily: "'Open Sans', sans-serif",
                  fontSize: 'clamp(16px, 5vw, 48px)',
                }}
              >
                {cover.text}
              </p>
            </div>
          ) : currentSegment?.type === 'media' ? (
            currentSegment.item.type === 'video' ? (
              <video
                key={currentSegment.item.id}
                ref={videoRef}
                src={getFileSrc(currentSegment.item.path)}
                className="max-w-full max-h-full object-contain"
                onTimeUpdate={handleVideoTimeUpdate}
                onEnded={handleVideoEnded}
                onPause={() => !isPlaying && setIsPlaying(false)}
                playsInline
              />
            ) : (
              <img
                key={currentSegment.item.id}
                src={getFileSrc(currentSegment.item.path)}
                alt={currentSegment.item.name}
                className="max-w-full max-h-full object-contain"
              />
            )
          ) : null}

          {/* Preset overlay */}
          {selectedPreset && (
            <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 rounded text-[10px] text-white">
              {selectedPreset.name} • {selectedPreset.width}×{selectedPreset.height}
            </div>
          )}
        </div>
      </div>

      {/* Timeline scrubber */}
      {hasContent && (
        <div className="flex-shrink-0 pt-3 pb-1 px-4">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-500 transition-colors"
            >
              {isPlaying ? (
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <div className="flex-1 relative">
              {/* Segment markers */}
              <div className="absolute inset-0 flex pointer-events-none rounded-full overflow-hidden">
                {segments.map((seg, i) => (
                  <div
                    key={i}
                    className={`h-full ${seg.type === 'cover' ? 'bg-purple-500/30' : 'bg-indigo-500/30'}`}
                    style={{ width: `${((seg.endTime - seg.startTime) / totalDuration) * 100}%` }}
                  />
                ))}
              </div>
              <input
                type="range"
                min={0}
                max={totalDuration || 1}
                step={0.01}
                value={throttledPreviewTime}
                onChange={handleTimeChange}
                className="relative w-full h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer z-10
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-3
                  [&::-webkit-slider-thumb]:h-3
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-indigo-500
                  [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-webkit-slider-thumb]:hover:bg-indigo-400
                  [&::-webkit-slider-thumb]:shadow-lg
                "
              />
            </div>

            <span className="text-xs text-gray-400 font-mono min-w-[80px] text-right">
              {formatDuration(throttledPreviewTime)} / {formatDuration(totalDuration)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
