#!/usr/bin/env bash
# Install, start or update Penny in Docker (macOS and Linux). Works on its own:
#   curl -fsSL https://raw.githubusercontent.com/Sergey-Bar/Penny/main/install-docker.sh | bash
# 1. checks that Docker is installed and running, 2. downloads the newest release into ~/Penny (or $PENNY_DIR),
# 3. if Penny is already there and a newer release exists, offers to update (backup + rollback via Penny-update.sh),
# 4. builds, starts and opens http://127.0.0.1:41234. Your data lives in a Docker volume, never in the code folder.
set -u
REPO="Sergey-Bar/Penny"
DIR="${PENNY_DIR:-$HOME/Penny}"

say() { printf '%s\n' "$*"; }
# Reads from the terminal even when this script arrives through a pipe.
ask() {
  local reply=""
  if [ -r /dev/tty ]; then read -r -p "$1 [Y/n] " reply </dev/tty || reply=""; fi
  case "$reply" in [nN]*) return 1 ;; *) return 0 ;; esac
}

# 1. Docker installed?
if ! command -v docker >/dev/null 2>&1; then
  say "Docker is not installed."
  if [ "$(uname)" = "Darwin" ]; then
    if command -v brew >/dev/null 2>&1 && ask "Install Docker Desktop with Homebrew now?"; then
      brew install --cask docker || { say "Install failed. Get it from https://www.docker.com/products/docker-desktop/"; exit 1; }
    else
      say "Install Docker Desktop from https://www.docker.com/products/docker-desktop/ and run this again."; exit 1
    fi
  else
    say "Install Docker Engine: https://docs.docker.com/engine/install/ (then add yourself to the docker group) and run this again."
    exit 1
  fi
fi

# Docker running? On a Mac, start Docker Desktop and wait for it.
if ! docker version >/dev/null 2>&1; then
  if [ "$(uname)" = "Darwin" ]; then
    say "Starting Docker Desktop..."
    open -a Docker 2>/dev/null
    for _ in $(seq 1 60); do docker version >/dev/null 2>&1 && break; sleep 2; done
  fi
  docker version >/dev/null 2>&1 || { say "Docker is installed but not running (or you lack permission). Start it and run this again."; exit 1; }
fi
docker compose version >/dev/null 2>&1 || { say "Docker Compose v2 is missing. Update Docker and run this again."; exit 1; }

# 2. Newest release.
latest="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" 2>/dev/null | sed -n 's/.*"tag_name": *"\(v[0-9.]*\)".*/\1/p' | head -n 1)"
[ -n "$latest" ] || { say "Could not reach GitHub to find the newest release."; [ -d "$DIR" ] || exit 1; }

download() { # $1 = tag: replaces the code in $DIR, keeps imports/ and .env
  local tmp
  tmp="$(mktemp -d)" || return 1
  curl -fsSL "https://github.com/$REPO/archive/refs/tags/$1.tar.gz" | tar -xz -C "$tmp" --strip-components=1 || { rm -rf "$tmp"; return 1; }
  mkdir -p "$DIR"
  find "$DIR" -mindepth 1 -maxdepth 1 ! -name imports ! -name .env -exec rm -rf {} +
  cp -R "$tmp"/. "$DIR"/ && rm -rf "$tmp"
  printf '%s\n' "$1" >"$DIR/.penny-version"
}

current_version() {
  if [ -d "$DIR/.git" ]; then git -C "$DIR" describe --tags --exact-match 2>/dev/null || git -C "$DIR" rev-parse --short HEAD 2>/dev/null
  elif [ -f "$DIR/.penny-version" ]; then cat "$DIR/.penny-version"
  fi
}

if [ ! -f "$DIR/docker-compose.yml" ]; then
  say "Downloading Penny $latest into $DIR..."
  if command -v git >/dev/null 2>&1; then
    git -c advice.detachedHead=false clone --quiet --branch "$latest" "https://github.com/$REPO.git" "$DIR" || { say "Download failed."; exit 1; }
  else
    download "$latest" || { say "Download failed."; exit 1; }
  fi
  exec bash "$DIR/Penny-docker.sh"
fi

# 3. Already installed: update if a newer release exists.
have="$(current_version)"
if [ -n "$latest" ] && [ "$have" != "$latest" ]; then
  if ask "Penny ${have:-(unknown version)} is installed. Update to $latest? Your data is backed up first."; then
    if [ -d "$DIR/.git" ]; then exec bash "$DIR/Penny-update.sh"; fi
    download "$latest" || { say "Download failed. Nothing was changed."; exit 1; }
    exec bash "$DIR/Penny-update.sh"
  fi
else
  say "Penny ${have:-} is up to date."
fi

# 4. Start (or restart) what is installed.
exec bash "$DIR/Penny-docker.sh"
