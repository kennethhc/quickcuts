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
      className={`w-full px-3 py-2.5 rounded-md border text-sm transition-all text-left ${
        isSelected
          ? 'border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--text-primary)]'
          : 'border-[var(--border-default)] bg-[var(--bg-elevated)]/50 text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
      }`}
    >
      <div className="flex justify-between items-center">
        <span className="font-medium">{preset.name}</span>
        <span className="text-[11px] text-[var(--text-tertiary)] font-mono">{preset.aspectRatio}</span>
      </div>
    </button>
  );
}

export function PresetSelector() {
  const { selectedPreset, setSelectedPreset } = useProjectStore();

  return (
    <div className="space-y-3">
      <h3 className="section-label">Format</h3>

      {/* Preset buttons */}
      <div className="flex flex-col gap-1.5">
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
