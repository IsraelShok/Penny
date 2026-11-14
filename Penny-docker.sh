#!/usr/bin/env bash
# Start Penny in Docker and open it in the browser (macOS and Linux; Windows uses Penny-docker.bat).
set -u
cd "$(dirname "$0")"
url="http://127.0.0.1:41234"

docker version >/dev/null 2>&1 || { echo "Docker is not running. Start Docker Desktop and try again."; exit 1; }

# Lets the update check compare the running version with the newest one.
PENNY_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
export PENNY_COMMIT
# Created by you, not by Docker, so the app can move imported files (Docker would create it owned by root).
mkdir -p imports

echo "Building and starting Penny (the first build takes a few minutes)..."
docker compose up -d --build --remove-orphans || { echo "Build failed. See the messages above."; exit 1; }

for _ in $(seq 1 40); do
  if [ "$(docker inspect --format '{{.State.Health.Status}}' penny 2>/dev/null)" = "healthy" ]; then
    echo "Penny is running at $url"
    if command -v open >/dev/null; then open "$url"; elif command -v xdg-open >/dev/null; then xdg-open "$url" >/dev/null 2>&1; fi
    exit 0
  fi
  sleep 3
done
echo "Penny did not become healthy. Logs:"
docker compose logs --tail 30 penny
exit 1
