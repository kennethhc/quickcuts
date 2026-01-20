import { useMemo, useState, useRef, useCallback } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import {
  createPortal
} from 'react-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useProjectStore, useTotalDuration } from '../stores/projectStore';
import type { MediaFile } from '../types';
import { formatDuration } from '../utils/mediaUtils';

interface SortableItemProps {
  file: MediaFile;
  onRemove: (id: string) => void;
  onPreview: (file: MediaFile | null) => void;
}

function SortableItem({ file, onRemove, onPreview }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: file.id });

  const longPressTimerRef = useRef<number | null>(null);
  const isLongPressRef = useRef(false);

  const handlePointerDown = useCallback(() => {
    if (file.type !== 'video') return;

    isLongPressRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      isLongPressRef.current = true;
      onPreview(file);
    }, 400); // 400ms for long press
  }, [file, onPreview]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (isLongPressRef.current) {
      onPreview(null);
    }
    isLongPressRef.current = false;
  }, [onPreview]);

  const handlePointerLeave = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (isLongPressRef.current) {
      onPreview(null);
    }
    isLongPressRef.current = false;
  }, [onPreview]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      className="timeline-item relative flex-shrink-0 w-24 h-20 rounded-md overflow-hidden bg-[var(--bg-elevated)] border border-[var(--border-default)] cursor-grab active:cursor-grabbing group select-none"
    >
      {/* Thumbnail */}
      {file.thumbnail ? (
        <img
          src={file.thumbnail}
          alt={file.name}
          className="w-full h-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-[var(--bg-hover)]">
          {file.type === 'video' ? (
            <svg className="w-6 h-6 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          )}
        </div>
      )}

      {/* Type badge */}
      <div className="absolute top-1 left-1">
        <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
          file.type === 'video'
            ? 'bg-[var(--accent)]/90 text-[var(--text-inverse)]'
            : 'bg-[var(--border-strong)] text-[var(--text-primary)]'
        }`}>
          {file.type === 'video' ? 'VID' : 'IMG'}
        </span>
      </div>

      {/* Duration */}
      <div className="absolute bottom-0 left-0 right-0 px-1.5 py-0.5 bg-black/80">
        <p className="text-[10px] text-[var(--text-primary)] text-center font-mono">
          {formatDuration(file.duration)}
        </p>
      </div>

      {/* Remove button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(file.id);
        }}
        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[var(--error)]/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--error)]"
      >
        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

interface CoverItemProps {
  text: string;
  colorScheme: 'blackOnWhite' | 'whiteOnBlack';
}

function CoverItem({ text, colorScheme }: CoverItemProps) {
  const isBlackOnWhite = colorScheme === 'blackOnWhite';

  return (
    <div className={`flex-shrink-0 w-24 h-20 rounded-md overflow-hidden relative border-2 border-[var(--accent)] flex flex-col items-center justify-center ${isBlackOnWhite ? 'bg-white' : 'bg-black'}`}>
      <div className="absolute top-1 left-1">
        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-[var(--accent)]/90 text-[var(--text-inverse)]">
          COVER
        </span>
      </div>
      <p className={`text-[10px] font-bold text-center px-1 line-clamp-2 ${isBlackOnWhite ? 'text-black' : 'text-white'}`}>
        {text || 'Cover'}
      </p>
    </div>
  );
}

interface VideoPreviewPopupProps {
  file: MediaFile;
}

function VideoPreviewPopup({ file }: VideoPreviewPopupProps) {
  const videoSrc = convertFileSrc(file.path);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-base)]/90 backdrop-blur-sm pointer-events-none">
      <div className="relative max-w-[80vw] max-h-[80vh] rounded-lg overflow-hidden shadow-2xl border border-[var(--border-default)]">
        <video
          src={videoSrc}
          autoPlay
          muted
          loop
          className="max-w-full max-h-[80vh] object-contain"
        />
        <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/80 rounded text-[var(--text-primary)] text-xs font-mono">
          {file.name}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function MediaTimeline() {
  const { mediaFiles, cover, reorderMediaFiles, removeMediaFile, clearMediaFiles } = useProjectStore();
  const totalDuration = useTotalDuration();
  const [previewFile, setPreviewFile] = useState<MediaFile | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = mediaFiles.findIndex((f) => f.id === active.id);
      const newIndex = mediaFiles.findIndex((f) => f.id === over.id);
      reorderMediaFiles(oldIndex, newIndex);
    }
  };

  const showCover = cover.enabled && cover.text.trim().length > 0;
  const hasMedia = mediaFiles.length > 0 || showCover;

  const itemIds = useMemo(() => mediaFiles.map((f) => f.id), [mediaFiles]);

  if (!hasMedia) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--text-tertiary)]">
        <p className="text-sm">No media added yet</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-3">
          <h3 className="section-label">Timeline</h3>
          <span className="text-xs text-[var(--text-tertiary)]">
            {mediaFiles.length} item{mediaFiles.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[var(--text-secondary)] font-mono">
            {formatDuration(totalDuration)}
          </span>
          {mediaFiles.length > 0 && (
            <button
              onClick={clearMediaFiles}
              className="text-xs text-[var(--error)] hover:text-[var(--error)]/80 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Timeline items */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-3">
        <div className="flex items-center gap-2 min-w-max">
          {showCover && (
            <>
              <CoverItem text={cover.text} colorScheme={cover.colorScheme} />
              <div className="w-px h-12 bg-[var(--border-default)]" />
            </>
          )}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={itemIds}
              strategy={horizontalListSortingStrategy}
            >
              <div className="flex items-center gap-2">
                {mediaFiles.map((file) => (
                  <SortableItem
                    key={file.id}
                    file={file}
                    onRemove={removeMediaFile}
                    onPreview={setPreviewFile}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>

      {/* Video Preview Popup */}
      {previewFile && <VideoPreviewPopup file={previewFile} />}
    </div>
  );
}
