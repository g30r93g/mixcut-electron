#!/usr/bin/env bash
set -euo pipefail

# Pinned versions — bump these to update
YTDLP_VERSION="2025.12.08"

BIN_DIR="$(cd "$(dirname "$0")/../resources/bin/darwin" && pwd)"
mkdir -p "$BIN_DIR"

# --- yt-dlp ---
if [ -x "$BIN_DIR/yt-dlp" ] && [ "$("$BIN_DIR/yt-dlp" --version 2>/dev/null)" = "$YTDLP_VERSION" ]; then
  echo "yt-dlp $YTDLP_VERSION already installed"
else
  echo "Downloading yt-dlp $YTDLP_VERSION..."
  curl -L --fail --retry 3 \
    "https://github.com/yt-dlp/yt-dlp/releases/download/$YTDLP_VERSION/yt-dlp_macos" \
    -o "$BIN_DIR/yt-dlp"
  chmod +x "$BIN_DIR/yt-dlp"
  # Remove macOS quarantine attribute if present
  xattr -d com.apple.quarantine "$BIN_DIR/yt-dlp" 2>/dev/null || true
  echo "yt-dlp $YTDLP_VERSION installed"
fi

# --- ffmpeg & ffprobe ---
# Uses Homebrew to get ffmpeg and ffprobe. On CI (macos-latest) Homebrew is available.
# For static builds, replace this section with curl commands to a static build source.
if [ -x "$BIN_DIR/ffmpeg" ] && [ -x "$BIN_DIR/ffprobe" ] && "$BIN_DIR/ffmpeg" -version &>/dev/null; then
  echo "ffmpeg already installed ($("$BIN_DIR/ffmpeg" -version 2>&1 | head -1))"
else
  echo "Installing ffmpeg via Homebrew..."
  if ! command -v brew &>/dev/null; then
    echo "Error: Homebrew is required to install ffmpeg. Install from https://brew.sh" >&2
    exit 1
  fi
  brew install ffmpeg 2>/dev/null || true
  FFMPEG_BIN="$(brew --prefix ffmpeg)/bin/ffmpeg"
  FFPROBE_BIN="$(brew --prefix ffmpeg)/bin/ffprobe"
  if [ ! -x "$FFMPEG_BIN" ] || [ ! -x "$FFPROBE_BIN" ]; then
    echo "Error: ffmpeg or ffprobe not found after brew install" >&2
    exit 1
  fi
  cp "$FFMPEG_BIN" "$BIN_DIR/ffmpeg"
  cp "$FFPROBE_BIN" "$BIN_DIR/ffprobe"
  chmod +x "$BIN_DIR/ffmpeg" "$BIN_DIR/ffprobe"
  echo "ffmpeg and ffprobe installed"
fi

echo ""
echo "All binaries ready in $BIN_DIR:"
ls -lh "$BIN_DIR"
