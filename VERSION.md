# Snappy Stitcher - Version History

## v0.1.0 (Initial Release)

### Summary
Initial implementation of Snappy Stitcher - a macOS desktop app for stitching videos and images together with text covers and export to various social media and professional formats.

### Features Implemented

#### Core Functionality
- Drag & drop media import (videos: MP4, MOV, AVI, MKV, WebM; images: JPG, JPEG, PNG, WebP, GIF)
- Auto-sort media by file timestamp
- Drag-to-reorder items in timeline
- Text cover with black text on white background (4 second duration)
- Video preview panel with timeline scrubber
- FFmpeg-based video processing

#### Format Presets
**Social Media:**
- Instagram Square (1080×1080, 1:1)
- Instagram Story (1080×1920, 9:16)
- TikTok (1080×1920, 9:16)
- YouTube (1920×1080, 16:9)
- YouTube Shorts (1080×1920, 9:16)
- Twitter/X (1280×720, 16:9)

**Professional:**
- 1080p H.264 (1920×1080, 16:9)
- 4K H.264 (3840×2160, 16:9)
- 1080p ProRes (1920×1080, 16:9)
- 4K ProRes (3840×2160, 16:9)
- Square 1080 (1080×1080, 1:1)
- Portrait 1080 (1080×1920, 9:16)

#### Technical Stack
- **Framework**: Tauri 2.x
- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS 4.x
- **State Management**: Zustand
- **Video Processing**: FFmpeg (system-installed)
- **Drag & Drop**: @dnd-kit

### Requirements
- macOS 10.15 or later
- FFmpeg installed via Homebrew (`brew install ffmpeg`)

### Known Limitations
- Requires FFmpeg to be installed on the system
- Video preview shows thumbnails only (not actual video playback)
- Export cancellation does not stop the FFmpeg process

### File Structure
```
snappy-stitcher/
├── src-tauri/           # Rust backend
│   └── src/
│       ├── commands/    # Tauri commands
│       │   ├── ffmpeg.rs    # Video export
│       │   ├── files.rs     # File operations
│       │   └── metadata.rs  # Media metadata extraction
│       └── lib.rs
├── src/                 # React frontend
│   ├── components/      # UI components
│   ├── hooks/           # React hooks
│   ├── stores/          # Zustand store
│   ├── types/           # TypeScript types
│   └── utils/           # Utilities
└── VERSION.md           # This file
```
