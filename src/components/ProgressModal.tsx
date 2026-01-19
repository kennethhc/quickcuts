import { useState, useEffect } from 'react';
import { useExport } from '../hooks/useExport';

const STAGE_LABELS: Record<string, string> = {
  preparing: 'Preparing export...',
  processing: 'Processing media files...',
  concatenating: 'Combining segments...',
  finalizing: 'Finalizing output...',
  complete: 'Export complete!',
  error: 'Export failed',
};

interface ProgressModalProps {
  outputPath: string | null;
  onClose: () => void;
}

export function ProgressModal({ outputPath, onClose }: ProgressModalProps) {
  const { isExporting, exportProgress, cancelExport, openInFinder } = useExport();
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (exportProgress?.stage === 'complete' && outputPath) {
      setShowSuccess(true);
    }
  }, [exportProgress?.stage, outputPath]);

  if (!isExporting && !showSuccess && !exportProgress?.error) {
    return null;
  }

  const handleOpenInFinder = () => {
    if (outputPath) {
      openInFinder(outputPath);
    }
  };

  const handleClose = () => {
    setShowSuccess(false);
    cancelExport();
    onClose();
  };

  const stage = exportProgress?.stage || 'preparing';
  const progress = exportProgress?.progress || 0;
  const currentFile = exportProgress?.currentFile;
  const error = exportProgress?.error;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">
            {showSuccess ? 'Export Complete' : error ? 'Export Failed' : 'Exporting...'}
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {showSuccess ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-white font-medium">Your video has been exported!</p>
                <p className="text-sm text-gray-400 mt-1">
                  Saved to Downloads folder
                </p>
              </div>
              {outputPath && (
                <p className="text-xs text-gray-500 break-all px-4">
                  {outputPath.split('/').pop()}
                </p>
              )}
            </div>
          ) : error ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <p className="text-white font-medium">Export failed</p>
                <p className="text-sm text-red-400 mt-1">{error}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Status */}
              <div className="text-center">
                <p className="text-white font-medium">{STAGE_LABELS[stage]}</p>
                {currentFile && (
                  <p className="text-sm text-gray-400 mt-1 truncate">
                    {currentFile}
                  </p>
                )}
              </div>

              {/* Progress bar */}
              <div className="space-y-2">
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300 progress-bar"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>{STAGE_LABELS[stage]}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-gray-800 flex gap-3">
          {showSuccess ? (
            <>
              <button
                onClick={handleOpenInFinder}
                className="flex-1 py-2.5 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium text-sm transition-colors"
              >
                Open in Finder
              </button>
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 px-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium text-sm transition-colors"
              >
                Done
              </button>
            </>
          ) : error ? (
            <button
              onClick={handleClose}
              className="w-full py-2.5 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium text-sm transition-colors"
            >
              Close
            </button>
          ) : (
            <button
              onClick={cancelExport}
              className="w-full py-2.5 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium text-sm transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
