import { useExport } from '../hooks/useExport';
import { useTotalDuration, useMediaCount } from '../stores/projectStore';
import { formatDuration } from '../utils/mediaUtils';

export function ExportButton() {
  const { canExport, isExporting, startExport } = useExport();
  const totalDuration = useTotalDuration();
  const { total, videos, images } = useMediaCount();

  const handleExport = async () => {
    if (!canExport) return;

    try {
      await startExport();
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  return (
    <div className="space-y-3">
      {/* Summary */}
      {total > 0 && (
        <div className="p-3 bg-[var(--bg-elevated)]/50 rounded-md border border-[var(--border-default)] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-tertiary)]">Duration</span>
            <span className="text-sm font-mono text-[var(--text-primary)]">{formatDuration(totalDuration)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-tertiary)]">Media</span>
            <span className="text-xs text-[var(--text-secondary)]">
              {videos > 0 && `${videos} video${videos !== 1 ? 's' : ''}`}
              {videos > 0 && images > 0 && ', '}
              {images > 0 && `${images} image${images !== 1 ? 's' : ''}`}
            </span>
          </div>
        </div>
      )}

      {/* Export button - refined bordered style */}
      <button
        onClick={handleExport}
        disabled={!canExport}
        className={`
          w-full py-3 px-4 rounded-md text-sm font-medium transition-all
          flex items-center justify-center gap-2 border
          ${canExport
            ? 'border-[var(--text-primary)] text-[var(--text-primary)] hover:bg-[var(--text-primary)] hover:text-[var(--bg-base)]'
            : 'border-[var(--border-default)] text-[var(--text-tertiary)] cursor-not-allowed'
          }
        `}
      >
        {isExporting ? (
          <>
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span>Exporting...</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <span>Export</span>
          </>
        )}
      </button>

      {/* Keyboard shortcut hint */}
      {canExport && (
        <div className="flex items-center justify-center gap-1.5">
          <span className="kbd">⌘</span>
          <span className="kbd">E</span>
        </div>
      )}

      {/* Help text */}
      {!canExport && total === 0 && (
        <p className="text-xs text-[var(--text-tertiary)] text-center">
          Add media files to start exporting
        </p>
      )}
    </div>
  );
}
