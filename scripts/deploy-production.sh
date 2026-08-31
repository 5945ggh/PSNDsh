#!/usr/bin/env bash
set -euo pipefail

compose_file="${COMPOSE_FILE:-docker-compose.production.yml}"
: "${IMAGE:?set IMAGE, for example ghcr.io/owner/repository:latest}"

compose=(docker compose --file "$compose_file")

echo "Validating production Compose configuration..."
"${compose[@]}" config --quiet

echo "Pulling $IMAGE..."
"${compose[@]}" pull personal-dashboard

echo "Starting the new image without a local build..."
"${compose[@]}" up --detach --no-build personal-dashboard

echo "Current service status:"
"${compose[@]}" ps
