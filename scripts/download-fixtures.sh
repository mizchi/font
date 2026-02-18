#!/usr/bin/env bash
set -euo pipefail

REPO="mizchi/font"
TAG="fixtures-v1"
ASSET="fixtures.tar.gz"
DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [ -f "$DIR/fixtures/NotoSansMono-Regular.ttf" ]; then
  echo "fixtures/ already exists, skipping download"
  exit 0
fi

echo "Downloading fixtures from $REPO release $TAG..."
cd "$DIR"

if command -v gh &>/dev/null; then
  gh release download "$TAG" --repo "$REPO" --pattern "$ASSET" --dir /tmp --clobber
else
  curl -fsSL -o /tmp/"$ASSET" \
    "https://github.com/$REPO/releases/download/$TAG/$ASSET"
fi

tar xzf /tmp/"$ASSET"
rm -f /tmp/"$ASSET"
echo "fixtures/ extracted successfully"
