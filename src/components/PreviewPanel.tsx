import { useMemo, useRef, useEffect, useCallback } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useProjectStore, useTotalDuration } from '../stores/projectStore';
import { formatDuration } from '../utils/mediaUtils';
import type { MediaFile } from '../types';

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

export function PreviewPanel() {
  // Granular selectors - only subscribe to what's needed
  const mediaFiles = useProjectStore((state) => state.mediaFiles);
  const cover = useProjectStore((state) => state.cover);
  const selectedPreset = useProjectStore((state) => state.selectedPreset);
  const previewTime = useProjectStore((state) => state.previewTime);
  const setPreviewTime = useProjectStore((state) => state.setPreviewTime);
  const isPlaying = useProjectStore((state) => state.isPlaying);
  const setIsPlaying = useProjectStore((state) => state.setIsPlaying);

  const totalDuration = useTotalDuration();
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const coverTimerRef = useRef<number | null>(null);
  const lastUpdateRef = useRef(0);

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

  // Find current segment using binary search
  const currentSegment = useMemo(() => {
    const index = findSegmentIndex(segments, previewTime);
    return index >= 0 ? segments[index] : null;
  }, [segments, previewTime]);

  // Get only video files for preloading
  const videoFiles = useMemo(() => {
    return mediaFiles.filter((f): f is MediaFile & { type: 'video' } => f.type === 'video');
  }, [mediaFiles]);

  // Get only image files
  const imageFiles = useMemo(() => {
    return mediaFiles.filter((f): f is MediaFile & { type: 'image' } => f.type === 'image');
  }, [mediaFiles]);

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
  const handleVideoTimeUpdate = useCallback((videoId: string) => {
    const now = Date.now();
    if (now - lastUpdateRef.current < 33) return; // Throttle to ~30fps
    lastUpdateRef.current = now;

    const video = videoRefs.current.get(videoId);
    if (video && currentSegment?.type === 'media' && currentSegment.item.id === videoId && isPlaying) {
      const newTime = currentSegment.startTime + video.currentTime;
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
  }, [currentSegment, segments, setPreviewTime, setIsPlaying]);

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
  }, [isPlaying, currentSegment, segments, previewTime, setPreviewTime, setIsPlaying]);

  // Sync video playback when segment changes or play state changes
  useEffect(() => {
    if (!currentSegment || currentSegment.type !== 'media' || currentSegment.item.type !== 'video') {
      // Pause all videos when not on a video segment
      videoRefs.current.forEach((video) => {
        if (!video.paused) video.pause();
      });
      return;
    }

    const currentVideoId = currentSegment.item.id;
    const video = videoRefs.current.get(currentVideoId);
    if (!video) return;

    const videoTime = previewTime - currentSegment.startTime;

    // Seek if needed (threshold reduced for smoother scrubbing)
    if (Math.abs(video.currentTime - videoTime) > 0.1) {
      video.currentTime = Math.max(0, Math.min(videoTime, video.duration || Infinity));
    }

    // Play/pause based on state
    if (isPlaying && video.paused) {
      video.play().catch(() => {});
    } else if (!isPlaying && !video.paused) {
      video.pause();
    }

    // Pause all other videos
    videoRefs.current.forEach((v, id) => {
      if (id !== currentVideoId && !v.paused) {
        v.pause();
      }
    });
  }, [isPlaying, currentSegment, previewTime]);

  // Register video ref
  const setVideoRef = useCallback((id: string, el: HTMLVideoElement | null) => {
    if (el) {
      videoRefs.current.set(id, el);
    } else {
      videoRefs.current.delete(id);
    }
  }, []);

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    if (segments.length === 0) return;

    if (isPlaying) {
      setIsPlaying(false);
    } else {
      if (previewTime >= totalDuration - 0.1) {
        setPreviewTime(0);
      }
      setIsPlaying(true);
    }
  }, [segments.length, isPlaying, previewTime, totalDuration, setPreviewTime, setIsPlaying]);

  // Handle scrubber change
  const handleTimeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setPreviewTime(newTime);
    setIsPlaying(false);

    // Find the segment at the new time and seek immediately
    const segIndex = findSegmentIndex(segments, newTime);
    if (segIndex >= 0) {
      const seg = segments[segIndex];
      if (seg.type === 'media' && seg.item.type === 'video') {
        const video = videoRefs.current.get(seg.item.id);
        if (video) {
          const videoTime = newTime - seg.startTime;
          if (videoTime >= 0) {
            video.currentTime = videoTime;
          }
        }
      }
    }
  }, [segments, setPreviewTime, setIsPlaying]);

  const hasContent = mediaFiles.length > 0 || cover.text.trim().length > 0;
  const showCover = cover.text.trim().length > 0;
  const currentItemId = currentSegment?.type === 'media' ? currentSegment.item.id : null;
  const showCoverPreview = currentSegment?.type === 'cover';

  return (
    <div className="h-full flex flex-col">
      {/* Preview area with selected aspect ratio */}
      <div className="flex-1 flex items-center justify-center p-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg min-h-0 overflow-hidden">
        <div
          className="relative bg-black rounded overflow-hidden"
          style={{
            aspectRatio,
            width: '100%',
            maxHeight: '100%',
          }}
        >
          {!hasContent ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--text-tertiary)] p-8">
              <svg className="w-10 h-10 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="text-xs">Preview will appear here</p>
            </div>
          ) : (
            <>
              {/* Cover overlay */}
              {showCover && (
                <div
                  className={`absolute inset-0 flex items-center justify-center p-8 transition-opacity duration-150 ${
                    showCoverPreview ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'
                  } ${cover.colorScheme === 'blackOnWhite' ? 'bg-white' : 'bg-black'}`}
                >
                  <p
                    className={`font-bold text-center break-words leading-tight whitespace-pre-wrap ${
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
              )}

              {/* Preloaded videos - all mounted, only current one visible */}
              {videoFiles.map((file) => (
                <video
                  key={file.id}
                  ref={(el) => setVideoRef(file.id, el)}
                  src={getFileSrc(file.path)}
                  className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-75 ${
                    currentItemId === file.id && !showCoverPreview ? 'opacity-100 z-5' : 'opacity-0 pointer-events-none'
                  }`}
                  onTimeUpdate={() => handleVideoTimeUpdate(file.id)}
                  onEnded={handleVideoEnded}
                  preload="auto"
                  playsInline
                  muted={currentItemId !== file.id}
                />
              ))}

              {/* Images - only render current one */}
              {imageFiles.map((file) => (
                <img
                  key={file.id}
                  src={getFileSrc(file.path)}
                  alt={file.name}
                  className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-75 ${
                    currentItemId === file.id && !showCoverPreview ? 'opacity-100 z-5' : 'opacity-0 pointer-events-none'
                  }`}
                />
              ))}
            </>
          )}

          {/* Preset overlay */}
          {selectedPreset && (
            <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 rounded text-[10px] text-[var(--text-secondary)] font-mono z-20">
              {selectedPreset.width}×{selectedPreset.height}
            </div>
          )}
        </div>
      </div>

      {/* Timeline scrubber */}
      {hasContent && (
        <div className="flex-shrink-0 pt-3 px-1">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="w-8 h-8 flex items-center justify-center rounded bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-default)] transition-colors"
            >
              {isPlaying ? (
                <svg className="w-3.5 h-3.5 text-[var(--text-primary)]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5 text-[var(--text-primary)] ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <div className="flex-1 relative h-4 flex items-center">
              {/* Track background */}
              <div className="absolute inset-x-0 h-1 bg-[var(--bg-elevated)] rounded-sm overflow-hidden">
                {/* Progress fill */}
                <div
                  className="h-full bg-[var(--accent)]"
                  style={{ width: `${(previewTime / (totalDuration || 1)) * 100}%` }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={totalDuration || 1}
                step={0.01}
                value={previewTime}
                onChange={handleTimeChange}
                className="relative w-full h-4 bg-transparent cursor-pointer z-10"
              />
            </div>

            <span className="text-[11px] text-[var(--text-tertiary)] font-mono min-w-[72px] text-right tabular-nums">
              {formatDuration(previewTime)} / {formatDuration(totalDuration)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
