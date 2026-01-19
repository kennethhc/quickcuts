# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Development (starts both Vite dev server and Tauri)
npm run tauri:dev

# Build for production (current architecture)
npm run tauri:build

# Build universal binary (Intel + Apple Silicon)
npm run tauri -- build --target universal-apple-darwin

# Lint frontend
npm run lint

# Type check
npm run build  # runs tsc -b && vite build
```

## FFmpeg Binary Setup

The app bundles static FFmpeg/FFprobe binaries. These are NOT in the git repo due to size. Before building:

1. Download static binaries:
   - x86_64: https://evermeet.cx/ffmpeg/
   - arm64: https://www.osxexperts.net/

2. Place in `src-tauri/binaries/`:
   ```
   ffmpeg-x86_64-apple-darwin
   ffmpeg-aarch64-apple-darwin
   ffprobe-x86_64-apple-darwin
   ffprobe-aarch64-apple-darwin
   ```

3. For universal builds, create combined binaries:
   ```bash
   lipo -create ffmpeg-x86_64-apple-darwin ffmpeg-aarch64-apple-darwin -output ffmpeg-universal-apple-darwin
   lipo -create ffprobe-x86_64-apple-darwin ffprobe-aarch64-apple-darwin -output ffprobe-universal-apple-darwin
   ```

## Architecture

### Frontend (React + TypeScript)
- **State**: Zustand store in `src/stores/projectStore.ts` - single source of truth for media files, cover config, export state
- **Components**: `src/components/` - PreviewPanel (video preview), MediaTimeline (drag-drop timeline), CoverTextEditor, PresetSelector, ExportButton
- **Hooks**: `src/hooks/useExport.ts` handles export orchestration, progress tracking, save dialog

### Backend (Rust/Tauri)
- **Commands**: `src-tauri/src/commands/`
  - `ffmpeg.rs` - Video export pipeline, fast concat mode (stream copy), hardware encoding
  - `metadata.rs` - Media metadata extraction, thumbnail generation (parallel batch processing)
  - `files.rs` - File system operations, FFmpeg availability checks
  - `sidecar.rs` - Locates bundled FFmpeg/FFprobe binaries (sidecar or system fallback)

### Key Data Flow
1. User drops files → `useMediaFiles` hook calls `get_media_metadata_batch` Tauri command
2. Metadata extracted via FFprobe → thumbnails generated in parallel → stored in Zustand
3. Export triggered → `export_video` command builds FFmpeg filter graph → progress emitted via Tauri events
4. Fast concat mode activates when: no cover, all videos, same resolution/framerate

### FFmpeg Integration
- Sidecar pattern: bundled binaries in app bundle, fallback to system PATH in dev
- Hardware encoding: VideoToolbox (h264_videotoolbox) when available
- Fast concat: `-f concat -c copy` for same-format videos (no re-encoding)
- Cover text: drawtext filter with multiline support (`\n` escape)

## Tauri Plugin Usage
- `tauri-plugin-shell`: Sidecar binary execution
- `tauri-plugin-dialog`: Save file dialog
- `tauri-plugin-fs`: File system access
- `tauri-plugin-notification`: Export complete notifications
