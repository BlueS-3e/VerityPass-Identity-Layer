#!/usr/bin/env bash
set -euo pipefail

# Build the webapp inside Docker and copy out the generated dist/ directory
# Usage: ./scripts/build_webapp_in_docker.sh

APP_DIR=$(cd "$(dirname "$0")/.." && pwd)
IMAGE_NAME=realmint-web-build

echo "Building webapp inside Docker image $IMAGE_NAME..."
docker build --network=host -f "$APP_DIR/webapp/Dockerfile.build" -t "$IMAGE_NAME" "$APP_DIR/webapp"

CONTAINER=$(docker create "$IMAGE_NAME")
echo "Copying dist/ from container $CONTAINER to $APP_DIR/webapp/dist"
mkdir -p "$APP_DIR/webapp/dist"
docker cp "$CONTAINER":/dist/. "$APP_DIR/webapp/dist/"
docker rm "$CONTAINER"

echo "Build extracted to webapp/dist"
#!/usr/bin/env bash
set -euo pipefail

# Build the webapp in Docker and extract the dist/ directory into the repository.
# Usage: ./scripts/build_webapp_in_docker.sh

HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/.." && pwd)
WEBAPP_DIR="$ROOT/webapp"
IMAGE_TAG="realmint-web-build:latest"

echo "Building webapp in Docker..."
docker build -f "$WEBAPP_DIR/Dockerfile.build" -t $IMAGE_TAG "$WEBAPP_DIR"

CONTAINER_ID=$(docker create $IMAGE_TAG)
echo "Created container $CONTAINER_ID, extracting /app/dist -> $WEBAPP_DIR/dist"
rm -rf "$WEBAPP_DIR/dist"
docker cp "$CONTAINER_ID:/app/dist" "$WEBAPP_DIR/dist"
docker rm "$CONTAINER_ID"

echo "Build extracted to $WEBAPP_DIR/dist"
