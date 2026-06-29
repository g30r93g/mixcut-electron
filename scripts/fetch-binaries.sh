#!/usr/bin/env bash
set -euo pipefail

# Fetches the CLI tools the app bundles into resources/bin/darwin.
#
# Usage: scripts/fetch-binaries.sh [ytdlp|ffmpeg]   (no arg = all)
#
# IMPORTANT: every binary here is spawned as a standalone child process on the
# end user's Mac. It must be self-contained — it may only link against system
# frameworks (/usr/lib, /System), never against libraries that live outside the
# .app bundle. Homebrew's ffmpeg is dynamically linked against dylibs under
# /opt/homebrew; copying it in "works" on a dev/CI machine that has Homebrew but
# fails on every end-user machine, where yt-dlp then reports
# "ffprobe and ffmpeg not found". We therefore fetch a static ffmpeg/ffprobe.

# --- Pinned versions — bump these to update ---
YTDLP_VERSION="2026.06.09"
# Static, self-contained arm64 build from https://ffmpeg.martin-riedl.de
FFMPEG_BUILD="1781693612_N-125070-gd69e8d0a95"
FFMPEG_BASE="https://ffmpeg.martin-riedl.de/download/macos/arm64/${FFMPEG_BUILD}"
FFMPEG_SHA256="901de66570758a415e768bbbf23e535ab0524892061cc6b70505196df24a8d9d"
FFPROBE_SHA256="9b439b90421f6a6c891a9f8cc743d8a5ecf57aacf759bdb194008d371d41d197"

BIN_DIR="$(cd "$(dirname "$0")/../resources/bin/darwin" && pwd)"
mkdir -p "$BIN_DIR"

TARGET="${1:-all}"

# True when $1 is a self-contained binary (no deps outside system frameworks).
is_self_contained() {
  ! otool -L "$1" | tail -n +2 | grep -qv '/usr/lib/\|/System/'
}

fetch_ytdlp() {
  if [ -x "$BIN_DIR/yt-dlp" ] && [ "$("$BIN_DIR/yt-dlp" --version 2>/dev/null)" = "$YTDLP_VERSION" ]; then
    echo "yt-dlp $YTDLP_VERSION already installed"
    return
  fi
  echo "Downloading yt-dlp $YTDLP_VERSION..."
  curl -L --fail --retry 3 \
    "https://github.com/yt-dlp/yt-dlp/releases/download/$YTDLP_VERSION/yt-dlp_macos" \
    -o "$BIN_DIR/yt-dlp"
  chmod +x "$BIN_DIR/yt-dlp"
  xattr -d com.apple.quarantine "$BIN_DIR/yt-dlp" 2>/dev/null || true
  echo "yt-dlp $YTDLP_VERSION installed"
}

# Download one static binary, verify its checksum, architecture, and that it has
# no library dependencies outside the system frameworks, then install it.
fetch_static_bin() {
  local name="$1" expected="$2"
  # A `trap ... RETURN` set here is NOT scoped to this function (bash only scopes
  # RETURN traps under `set -o functrace`); it would also fire on the caller's
  # return, where this local $tmp is out of scope and trips `set -u`. So clean up
  # explicitly instead — on every error path and at the end.
  local tmp; tmp="$(mktemp -d)"

  echo "Downloading $name (static)..."
  curl -L --fail --retry 3 "$FFMPEG_BASE/$name.zip" -o "$tmp/$name.zip"

  local actual; actual="$(shasum -a 256 "$tmp/$name.zip" | awk '{print $1}')"
  if [ "$actual" != "$expected" ]; then
    echo "Error: checksum mismatch for $name (expected $expected, got $actual)" >&2
    rm -rf "$tmp"; exit 1
  fi

  unzip -oq "$tmp/$name.zip" -d "$tmp"
  if [ "$(lipo -archs "$tmp/$name")" != "arm64" ]; then
    echo "Error: $name is not arm64" >&2
    rm -rf "$tmp"; exit 1
  fi
  if ! is_self_contained "$tmp/$name"; then
    echo "Error: $name has library dependencies outside the system frameworks" >&2
    otool -L "$tmp/$name" | tail -n +2 | grep -v '/usr/lib/\|/System/' >&2
    rm -rf "$tmp"; exit 1
  fi

  install -m 0755 "$tmp/$name" "$BIN_DIR/$name"
  rm -rf "$tmp"
}

fetch_ffmpeg() {
  # Re-fetch if missing OR if a previously-bundled dynamic (Homebrew) build is present.
  if [ -x "$BIN_DIR/ffmpeg" ] && [ -x "$BIN_DIR/ffprobe" ] \
    && is_self_contained "$BIN_DIR/ffmpeg" && is_self_contained "$BIN_DIR/ffprobe"; then
    echo "ffmpeg + ffprobe already installed (static): $("$BIN_DIR/ffmpeg" -version 2>&1 | head -1)"
    return
  fi
  fetch_static_bin ffmpeg "$FFMPEG_SHA256"
  fetch_static_bin ffprobe "$FFPROBE_SHA256"
  echo "ffmpeg + ffprobe installed: $("$BIN_DIR/ffmpeg" -version 2>&1 | head -1)"
}

case "$TARGET" in
  ytdlp) fetch_ytdlp ;;
  ffmpeg) fetch_ffmpeg ;;
  all) fetch_ytdlp; fetch_ffmpeg ;;
  *) echo "Usage: $0 [ytdlp|ffmpeg]" >&2; exit 2 ;;
esac

echo ""
echo "Binaries ready in $BIN_DIR:"
ls -lh "$BIN_DIR"
