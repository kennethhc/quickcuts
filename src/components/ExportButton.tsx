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
        <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Total Duration</span>
            <span className="text-sm font-medium text-white">{formatDuration(totalDuration)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Media Items</span>
            <span className="text-xs text-gray-300">
              {videos > 0 && `${videos} video${videos !== 1 ? 's' : ''}`}
              {videos > 0 && images > 0 && ', '}
              {images > 0 && `${images} image${images !== 1 ? 's' : ''}`}
            </span>
          </div>
        </div>
      )}

      {/* Export button */}
      <button
        onClick={handleExport}
        disabled={!canExport}
        className={`
          w-full py-3 px-4 rounded-lg font-medium text-sm transition-all
          flex items-center justify-center gap-2
          ${canExport
            ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600 shadow-lg shadow-indigo-500/25'
            : 'bg-gray-700 text-gray-400 cursor-not-allowed'
          }
        `}
      >
        {isExporting ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Exporting...</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>Export Video</span>
          </>
        )}
      </button>

      {/* Help text */}
      {!canExport && total === 0 && (
        <p className="text-xs text-gray-500 text-center">
          Add media files to start exporting
        </p>
      )}
    </div>
  );
}
