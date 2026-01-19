#!/bin/bash
# Generate all required icons for Tauri app from a source image

SOURCE_IMAGE="$1"
ICONS_DIR="$(dirname "$0")/../src-tauri/icons"

if [ -z "$SOURCE_IMAGE" ]; then
    echo "Usage: ./generate-icons.sh <source-image>"
    exit 1
fi

if [ ! -f "$SOURCE_IMAGE" ]; then
    echo "Error: Source image not found: $SOURCE_IMAGE"
    exit 1
fi

echo "Generating icons from: $SOURCE_IMAGE"
echo "Output directory: $ICONS_DIR"

# Create temp directory for iconset
ICONSET_DIR=$(mktemp -d)/icon.iconset
mkdir -p "$ICONSET_DIR"

# Generate PNG icons for Tauri
echo "Generating PNG icons..."
sips -z 32 32 "$SOURCE_IMAGE" --out "$ICONS_DIR/32x32.png" >/dev/null 2>&1
sips -z 128 128 "$SOURCE_IMAGE" --out "$ICONS_DIR/128x128.png" >/dev/null 2>&1
sips -z 256 256 "$SOURCE_IMAGE" --out "$ICONS_DIR/128x128@2x.png" >/dev/null 2>&1
sips -z 512 512 "$SOURCE_IMAGE" --out "$ICONS_DIR/icon.png" >/dev/null 2>&1

# Generate Windows Square logos
echo "Generating Windows logos..."
sips -z 30 30 "$SOURCE_IMAGE" --out "$ICONS_DIR/Square30x30Logo.png" >/dev/null 2>&1
sips -z 44 44 "$SOURCE_IMAGE" --out "$ICONS_DIR/Square44x44Logo.png" >/dev/null 2>&1
sips -z 71 71 "$SOURCE_IMAGE" --out "$ICONS_DIR/Square71x71Logo.png" >/dev/null 2>&1
sips -z 89 89 "$SOURCE_IMAGE" --out "$ICONS_DIR/Square89x89Logo.png" >/dev/null 2>&1
sips -z 107 107 "$SOURCE_IMAGE" --out "$ICONS_DIR/Square107x107Logo.png" >/dev/null 2>&1
sips -z 142 142 "$SOURCE_IMAGE" --out "$ICONS_DIR/Square142x142Logo.png" >/dev/null 2>&1
sips -z 150 150 "$SOURCE_IMAGE" --out "$ICONS_DIR/Square150x150Logo.png" >/dev/null 2>&1
sips -z 284 284 "$SOURCE_IMAGE" --out "$ICONS_DIR/Square284x284Logo.png" >/dev/null 2>&1
sips -z 310 310 "$SOURCE_IMAGE" --out "$ICONS_DIR/Square310x310Logo.png" >/dev/null 2>&1
sips -z 50 50 "$SOURCE_IMAGE" --out "$ICONS_DIR/StoreLogo.png" >/dev/null 2>&1

# Generate macOS iconset
echo "Generating macOS iconset..."
sips -z 16 16 "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_16x16.png" >/dev/null 2>&1
sips -z 32 32 "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_16x16@2x.png" >/dev/null 2>&1
sips -z 32 32 "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_32x32.png" >/dev/null 2>&1
sips -z 64 64 "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_32x32@2x.png" >/dev/null 2>&1
sips -z 128 128 "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_128x128.png" >/dev/null 2>&1
sips -z 256 256 "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_128x128@2x.png" >/dev/null 2>&1
sips -z 256 256 "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_256x256.png" >/dev/null 2>&1
sips -z 512 512 "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_256x256@2x.png" >/dev/null 2>&1
sips -z 512 512 "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_512x512.png" >/dev/null 2>&1
sips -z 1024 1024 "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_512x512@2x.png" >/dev/null 2>&1

# Convert to icns
echo "Creating icon.icns..."
iconutil -c icns "$ICONSET_DIR" -o "$ICONS_DIR/icon.icns"

# Generate ICO for Windows (using sips + manual assembly isn't ideal, but works)
# For proper ICO, we'd need ImageMagick. Using a simple approach here.
echo "Creating icon.ico..."
# Copy the 256x256 as a placeholder - for proper ICO, install ImageMagick
if command -v convert &> /dev/null; then
    convert "$SOURCE_IMAGE" -define icon:auto-resize=256,128,64,48,32,16 "$ICONS_DIR/icon.ico"
else
    echo "Note: ImageMagick not found. Using 256x256 PNG as ICO placeholder."
    sips -z 256 256 "$SOURCE_IMAGE" --out "$ICONS_DIR/icon.ico" >/dev/null 2>&1
fi

# Cleanup
rm -rf "$(dirname "$ICONSET_DIR")"

echo "✅ Icons generated successfully!"
echo ""
echo "Generated files:"
ls -la "$ICONS_DIR"
