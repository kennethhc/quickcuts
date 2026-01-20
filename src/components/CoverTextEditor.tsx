import { useProjectStore } from '../stores/projectStore';

export function CoverTextEditor() {
  const { cover, setCoverText, setCoverColorScheme } = useProjectStore();

  const isBlackOnWhite = cover.colorScheme === 'blackOnWhite';
  const bgColor = isBlackOnWhite ? 'bg-white' : 'bg-black';
  const textColor = isBlackOnWhite ? 'text-black' : 'text-white';

  return (
    <div className="space-y-3">
      <h3 className="section-label">Cover Text</h3>

      <div className="relative">
        <textarea
          value={cover.text}
          onChange={(e) => setCoverText(e.target.value)}
          placeholder="Enter cover text..."
          maxLength={100}
          className="w-full h-20 px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-md text-[var(--text-primary)] placeholder-[var(--text-tertiary)] text-sm resize-none focus:outline-none focus:border-[var(--accent)]"
        />
        <span className="absolute bottom-2 right-2 text-[10px] text-[var(--text-tertiary)] font-mono">
          {cover.text.length}/100
        </span>
      </div>

      {/* Color scheme toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setCoverColorScheme('blackOnWhite')}
          className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-all border ${
            isBlackOnWhite
              ? 'bg-white text-black border-[var(--accent)]'
              : 'bg-[var(--bg-elevated)] text-[var(--text-tertiary)] border-[var(--border-default)] hover:border-[var(--border-strong)]'
          }`}
        >
          Black on White
        </button>
        <button
          onClick={() => setCoverColorScheme('whiteOnBlack')}
          className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-all border ${
            !isBlackOnWhite
              ? 'bg-black text-white border-[var(--accent)]'
              : 'bg-[var(--bg-elevated)] text-[var(--text-tertiary)] border-[var(--border-default)] hover:border-[var(--border-strong)]'
          }`}
        >
          White on Black
        </button>
      </div>

      {/* Preview */}
      {cover.text && (
        <div className="rounded-md overflow-hidden border border-[var(--border-default)]">
          <div className="px-2 py-1 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)]">
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide">Preview</span>
          </div>
          <div className={`aspect-video ${bgColor} flex items-center justify-center p-4`}>
            <p className={`${textColor} font-bold text-center break-words leading-tight whitespace-pre-wrap`} style={{
              fontFamily: "'Open Sans', sans-serif",
              fontSize: `clamp(8px, ${cover.text.split('\n').length > 3 ? '3vw' : cover.text.split('\n').length > 1 ? '3.5vw' : '4vw'}, 18px)`,
            }}>
              {cover.text}
            </p>
          </div>
          <div className="px-2 py-1 bg-[var(--bg-elevated)] border-t border-[var(--border-subtle)] flex justify-between">
            <span className="text-[10px] text-[var(--text-tertiary)] font-mono">{cover.duration}s</span>
            <span className="text-[10px] text-[var(--text-tertiary)]">{isBlackOnWhite ? 'Black on White' : 'White on Black'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
