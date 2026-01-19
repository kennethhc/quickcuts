import { useProjectStore } from '../stores/projectStore';
import type { FormatPreset } from '../types';
import { ALL_PRESETS } from '../utils/presets';

interface PresetButtonProps {
  preset: FormatPreset;
  isSelected: boolean;
  onSelect: () => void;
}

function PresetButton({ preset, isSelected, onSelect }: PresetButtonProps) {
  return (
    <button
      onClick={onSelect}
      className={`
        w-full px-4 py-3 rounded-lg border text-sm font-medium transition-all text-left
        ${isSelected
          ? 'border-indigo-500 bg-indigo-500/20 text-white'
          : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600 hover:bg-gray-800 hover:text-white'
        }
      `}
    >
      <div className="flex justify-between items-center">
        <span>{preset.name}</span>
        <span className="text-xs text-gray-500">{preset.aspectRatio}</span>
      </div>
    </button>
  );
}

export function PresetSelector() {
  const { selectedPreset, setSelectedPreset } = useProjectStore();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-300">Format</h3>

      {/* Preset buttons */}
      <div className="flex flex-col gap-2">
        {ALL_PRESETS.map((preset) => (
          <PresetButton
            key={preset.id}
            preset={preset}
            isSelected={selectedPreset?.id === preset.id}
            onSelect={() => setSelectedPreset(preset)}
          />
        ))}
      </div>

    </div>
  );
}
