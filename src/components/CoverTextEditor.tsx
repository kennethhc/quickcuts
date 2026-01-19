import { useProjectStore } from '../stores/projectStore';

export function CoverTextEditor() {
  const { cover, setCoverText, setCoverColorScheme } = useProjectStore();

  const isBlackOnWhite = cover.colorScheme === 'blackOnWhite';
  const bgColor = isBlackOnWhite ? 'bg-white' : 'bg-black';
  const textColor = isBlackOnWhite ? 'text-black' : 'text-white';
  const colorLabel = isBlackOnWhite ? 'Black on White' : 'White on Black';

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-300">Cover Text</h3>

      <div className="relative">
        <textarea
          value={cover.text}
          onChange={(e) => setCoverText(e.target.value)}
          placeholder="Enter cover text..."
          maxLength={100}
          className="
            w-full h-20 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
            text-white placeholder-gray-500 text-sm resize-none
            focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
          "
        />
        <span className="absolute bottom-2 right-2 text-[10px] text-gray-500">
          {cover.text.length}/100
        </span>
      </div>

      {/* Color scheme toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setCoverColorScheme('blackOnWhite')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all border ${
            isBlackOnWhite
              ? 'bg-white text-black border-indigo-500'
              : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'
          }`}
        >
          Black on White
        </button>
        <button
          onClick={() => setCoverColorScheme('whiteOnBlack')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all border ${
            !isBlackOnWhite
              ? 'bg-black text-white border-indigo-500'
              : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'
          }`}
        >
          White on Black
        </button>
      </div>

      {/* Preview */}
      {cover.text && (
        <div className="rounded-lg overflow-hidden border border-gray-700">
          <div className="px-2 py-1 bg-gray-800 border-b border-gray-700">
            <span className="text-[10px] text-gray-400">Preview</span>
          </div>
          <div className={`aspect-video ${bgColor} flex items-center justify-center p-4`}>
            <p className={`${textColor} font-bold text-center break-words leading-tight whitespace-pre-wrap`} style={{
              fontFamily: "'Open Sans', sans-serif",
              fontSize: `clamp(8px, ${cover.text.split('\n').length > 3 ? '3vw' : cover.text.split('\n').length > 1 ? '3.5vw' : '4vw'}, 18px)`,
            }}>
              {cover.text}
            </p>
          </div>
          <div className="px-2 py-1 bg-gray-800 border-t border-gray-700 flex justify-between">
            <span className="text-[10px] text-gray-400">Duration: {cover.duration}s</span>
            <span className="text-[10px] text-gray-400">{colorLabel}</span>
          </div>
        </div>
      )}
    </div>
  );
}
