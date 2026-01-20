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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-base)]/80 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-[var(--bg-surface)] rounded-lg border border-[var(--border-default)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            {showSuccess ? 'Export Complete' : error ? 'Export Failed' : 'Exporting...'}
          </h2>
        </div>

        {/* Content */}
        <div className="px-5 py-6">
          {showSuccess ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-[var(--success)]/20 flex items-center justify-center">
                <svg className="w-7 h-7 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-[var(--text-primary)] font-medium">Your video has been exported!</p>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  Saved to Downloads folder
                </p>
              </div>
              {outputPath && (
                <p className="text-xs text-[var(--text-tertiary)] font-mono break-all px-4">
                  {outputPath.split('/').pop()}
                </p>
              )}
            </div>
          ) : error ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-[var(--error)]/20 flex items-center justify-center">
                <svg className="w-7 h-7 text-[var(--error)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <p className="text-[var(--text-primary)] font-medium">Export failed</p>
                <p className="text-sm text-[var(--error)] mt-1">{error}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Status */}
              <div className="text-center">
                <p className="text-[var(--text-primary)] font-medium">{STAGE_LABELS[stage]}</p>
                {currentFile && (
                  <p className="text-sm text-[var(--text-secondary)] mt-1 truncate">
                    {currentFile}
                  </p>
                )}
              </div>

              {/* Progress bar */}
              <div className="space-y-2">
                <div className="progress-track h-1.5">
                  <div
                    className="progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-tertiary)]">{STAGE_LABELS[stage]}</span>
                  <span className="text-[var(--text-secondary)] font-mono">{Math.round(progress)}%</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-[var(--border-subtle)] flex gap-3">
          {showSuccess ? (
            <>
              <button
                onClick={handleOpenInFinder}
                className="btn-secondary flex-1"
              >
                Open in Finder
              </button>
              <button
                onClick={handleClose}
                className="btn-primary flex-1"
              >
                Done
              </button>
            </>
          ) : error ? (
            <button
              onClick={handleClose}
              className="btn-secondary w-full"
            >
              Close
            </button>
          ) : (
            <button
              onClick={cancelExport}
              className="btn-secondary w-full"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
