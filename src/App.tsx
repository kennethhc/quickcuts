import { useState, useCallback, useEffect, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { MediaTimeline } from './components/MediaTimeline';
import { PreviewPanel } from './components/PreviewPanel';
import { CoverTextEditor } from './components/CoverTextEditor';
import { PresetSelector } from './components/PresetSelector';
import { ExportButton } from './components/ExportButton';
import { ProgressModal } from './components/ProgressModal';
import { useFFmpeg } from './hooks/useFFmpeg';
import { useMediaFiles } from './hooks/useMediaFiles';
import { useExport } from './hooks/useExport';
import { useProjectStore, useTotalDuration } from './stores/projectStore';
import { isSupportedMedia, ALL_EXTENSIONS } from './utils/mediaUtils';

function App() {
  const { isAvailable: ffmpegAvailable } = useFFmpeg();
  const { processFiles } = useMediaFiles();
  const { canExport, startExport } = useExport();
  const { isPlaying, setIsPlaying, previewTime, setPreviewTime, resetProject } = useProjectStore();
  const totalDuration = useTotalDuration();
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const seekIntervalRef = useRef<number | null>(null);

  // Listen for Tauri drag-drop events
  useEffect(() => {
    let mounted = true;

    const setupDragDrop = async () => {
      const appWindow = getCurrentWindow();

      const unlisten = await appWindow.onDragDropEvent((event) => {
        if (!mounted) return;

        if (event.payload.type === 'over' || event.payload.type === 'enter') {
          setIsDraggingOver(true);
        } else if (event.payload.type === 'leave') {
          setIsDraggingOver(false);
        } else if (event.payload.type === 'drop') {
          setIsDraggingOver(false);
          const paths = event.payload.paths;
          const validPaths = paths.filter((path: string) => isSupportedMedia(path));
          if (validPaths.length > 0) {
            processFiles(validPaths);
          }
        }
      });

      return unlisten;
    };

    const cleanup = setupDragDrop();

    return () => {
      mounted = false;
      cleanup.then((fn) => fn?.());
    };
  }, [processFiles]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const isMeta = e.metaKey || e.ctrlKey;

      // Space - Play/Pause
      if (e.code === 'Space' && !isMeta) {
        e.preventDefault();
        setIsPlaying(!isPlaying);
      }

      // Left Arrow - Seek backward 5s (with repeat on hold)
      if (e.code === 'ArrowLeft' && !isMeta && !e.repeat) {
        e.preventDefault();
        const newTime = Math.max(0, previewTime - 5);
        setPreviewTime(newTime);
        setIsPlaying(false);

        // Start continuous seeking on hold
        seekIntervalRef.current = window.setInterval(() => {
          const current = useProjectStore.getState().previewTime;
          setPreviewTime(Math.max(0, current - 5));
        }, 200);
      }

      // Right Arrow - Seek forward 5s (with repeat on hold)
      if (e.code === 'ArrowRight' && !isMeta && !e.repeat) {
        e.preventDefault();
        const newTime = Math.min(totalDuration, previewTime + 5);
        setPreviewTime(newTime);
        setIsPlaying(false);

        // Start continuous seeking on hold
        seekIntervalRef.current = window.setInterval(() => {
          const state = useProjectStore.getState();
          const current = state.previewTime;
          // Calculate duration from current state
          const coverDur = state.cover.enabled && state.cover.text ? state.cover.duration : 0;
          const mediaDur = state.mediaFiles.reduce((sum, f) => sum + f.duration, 0);
          const duration = coverDur + mediaDur;
          setPreviewTime(Math.min(duration, current + 5));
        }, 200);
      }

      // Cmd+E - Export
      if (e.code === 'KeyE' && isMeta) {
        e.preventDefault();
        if (canExport) {
          startExport().then((result) => {
            if (result) {
              setOutputPath(result);
            }
          });
        }
      }

      // Cmd+N - New Edit (reset project)
      if (e.code === 'KeyN' && isMeta) {
        e.preventDefault();
        resetProject();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Stop continuous seeking when arrow key is released
      if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && seekIntervalRef.current) {
        clearInterval(seekIntervalRef.current);
        seekIntervalRef.current = null;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (seekIntervalRef.current) {
        clearInterval(seekIntervalRef.current);
      }
    };
  }, [isPlaying, setIsPlaying, previewTime, setPreviewTime, totalDuration, canExport, startExport, resetProject]);

  // Open file picker dialog
  const handleAddMedia = useCallback(async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: 'Media Files',
            extensions: ALL_EXTENSIONS.map((ext) => ext.replace('.', '')),
          },
        ],
      });

      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        await processFiles(paths);
      }
    } catch (err) {
      console.error('Failed to open file dialog:', err);
    }
  }, [processFiles]);

  return (
    <div className="h-screen flex bg-[#1a1a2e] text-white overflow-hidden">
      {/* Left side - Preview, Add Media, Timeline */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Preview Panel */}
        <div className="flex-1 p-4 min-h-0 overflow-hidden">
          <PreviewPanel />
        </div>

        {/* Add Media Button */}
        <div className="px-4 pb-4">
          <button
            onClick={handleAddMedia}
            className="w-full flex items-center justify-center gap-3 h-12 px-6 rounded-xl border-2 border-dashed border-gray-600 hover:border-indigo-500 bg-gray-800/30 hover:bg-indigo-500/10 transition-all cursor-pointer"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span className="text-gray-300 text-sm font-medium">Add Media</span>
            <span className="text-gray-500 text-xs">or drag files anywhere</span>
          </button>
        </div>

        {/* Timeline */}
        <div className="h-32 border-t border-gray-800 bg-gray-900/30">
          <MediaTimeline />
        </div>
      </div>

      {/* Right panel - Controls (full height) */}
      <div className="w-80 border-l border-gray-800 bg-gray-900/30 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Cover Text Editor */}
          <CoverTextEditor />

          {/* Preset Selector */}
          <PresetSelector />

          {/* Export Button */}
          <ExportButton />
        </div>
      </div>

      {/* FFmpeg warning */}
      {ffmpegAvailable === false && (
        <div className="fixed bottom-4 left-4 right-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="text-red-400 font-medium">FFmpeg not found</h3>
              <p className="text-sm text-red-300/80 mt-1">
                Please install FFmpeg to use this application. On macOS, you can install it using Homebrew:
              </p>
              <code className="block mt-2 px-3 py-2 bg-black/30 rounded text-sm text-red-300 font-mono">
                brew install ffmpeg
              </code>
            </div>
          </div>
        </div>
      )}

      {/* Progress Modal - always rendered, handles its own visibility */}
      <ProgressModal
        outputPath={outputPath}
        onClose={() => {
          setOutputPath(null);
        }}
      />

      {/* Full-screen drop overlay */}
      {isDraggingOver && (
        <div className="fixed inset-0 z-50 bg-[#1a1a2e]/95 backdrop-blur-sm flex items-center justify-center">
          <div className="border-4 border-dashed border-indigo-500 rounded-3xl p-16 bg-indigo-500/10 animate-pulse">
            <div className="flex flex-col items-center gap-6">
              <div className="w-24 h-24 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <svg className="w-12 h-12 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-2xl font-semibold text-white mb-2">Drop to add media</p>
                <p className="text-gray-400">Release to add videos and images to your project</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
