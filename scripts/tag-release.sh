#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PKG_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$PKG_DIR/.." && pwd)"

# Extract version from pyproject.toml
VERSION=$(grep -m1 '^version' "$PKG_DIR/pyproject.toml" | sed 's/.*"\(.*\)".*/\1/')
TAG="v${VERSION}"

echo "Version:  $VERSION"
echo "Tag:      $TAG"
echo ""

# Check for uncommitted changes
if ! git -C "$REPO_ROOT" diff --quiet HEAD; then
    echo "Error: You have uncommitted changes. Commit them first."
    exit 1
fi

# Check if tag already exists
if git -C "$REPO_ROOT" rev-parse "$TAG" >/dev/null 2>&1; then
    echo "Error: Tag '$TAG' already exists."
    exit 1
fi

# Confirm
read -rp "Create and push tag $TAG? [y/N] " confirm
if [[ "$confirm" != [yY] ]]; then
    echo "Aborted."
    exit 0
fi

# Create and push tag
git -C "$REPO_ROOT" tag -a "$TAG" -m "v$VERSION"
echo "Created tag: $TAG"

git -C "$REPO_ROOT" push origin "$TAG"
echo "Pushed tag: $TAG"

echo "Done!"
