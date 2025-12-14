#!/bin/bash
# Build and push Docker image for API to Docker Hub or private registry

set -e

REGISTRY="${DOCKER_REGISTRY:-docker.io}"
REPO="${DOCKER_REPO:-yourusername/realmint-api}"
TAG="${1:-latest}"

echo "🐳 Building Docker image for RealMint API"
echo "=========================================="
echo ""
echo "Registry: $REGISTRY"
echo "Repository: $REPO"
echo "Tag: $TAG"
echo ""

cd "$(dirname "$0")/.."

# Build API Dockerfile
docker build -f api/Dockerfile.prod -t "$REGISTRY/$REPO:$TAG" .

echo ""
echo "✓ Built: $REGISTRY/$REPO:$TAG"
echo ""

# Optional: push to registry
read -p "Push to registry? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  docker push "$REGISTRY/$REPO:$TAG"
  echo ""
  echo "✓ Pushed to $REGISTRY/$REPO:$TAG"
else
  echo "Skipped push. To push later, run:"
  echo "  docker push $REGISTRY/$REPO:$TAG"
fi
