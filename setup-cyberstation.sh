#!/usr/bin/env bash
# =============================================================================
# CyberStation Setup Script
# Run this ONCE on the CyberStation box to set up auto-deploying from GHCR.
#
# Usage:
#   ssh -i ./cyberstation_key admin@cyberstation.wpi.edu
#   # then on the box:
#   bash setup-cyberstation.sh
# =============================================================================
set -euo pipefail

DEPLOY_DIR="$HOME/ZaraOS-DriverStation"
GHCR_IMAGE="ghcr.io/koalbymqp/zaraos-driverstation/driver-station"

echo "============================================"
echo "  CyberStation Driver Station Setup"
echo "============================================"
echo ""

# --- 1. Authenticate Docker with GHCR ---
echo "==> Step 1: Log in to GitHub Container Registry"
echo "   You'll need a GitHub Personal Access Token (classic) with 'read:packages' scope."
echo "   Create one at: https://github.com/settings/tokens/new"
echo ""
read -rp "GitHub username: " GH_USER
read -rsp "GitHub PAT (read:packages): " GH_TOKEN
echo ""
echo "$GH_TOKEN" | docker login ghcr.io -u "$GH_USER" --password-stdin
echo "   Docker logged in to GHCR!"
echo ""

# --- 2. Create deploy directory ---
echo "==> Step 2: Setting up deployment directory"
mkdir -p "$DEPLOY_DIR"

# --- 3. Create .env file if it doesn't exist ---
if [ ! -f "$DEPLOY_DIR/.env" ]; then
  echo "==> Step 3: Creating .env file"
  echo "   Only the server-side secret is needed here."
  echo "   (NEXT_PUBLIC_* vars are baked into the image via GitHub Secrets)"
  echo ""
  read -rsp "AZURE_CLIENT_SECRET: " AZURE_SECRET
  echo ""
  cat > "$DEPLOY_DIR/.env" << EOF
AZURE_CLIENT_SECRET=$AZURE_SECRET
EOF
  echo "   .env file created at $DEPLOY_DIR/.env"
else
  echo "==> Step 3: .env file already exists, skipping"
fi
echo ""

# --- 4. Download production compose file ---
echo "==> Step 4: Downloading docker-compose.prod.yml"
curl -fsSL "https://raw.githubusercontent.com/KoalbyMQP/ZaraOS-DriverStation/main/docker-compose.prod.yml" \
  -o "$DEPLOY_DIR/docker-compose.yml" || {
  echo "   Could not download from GitHub. Copy docker-compose.prod.yml manually to $DEPLOY_DIR/docker-compose.yml"
}
echo ""

# --- 5. Pull and start ---
echo "==> Step 5: Pulling image and starting services"
cd "$DEPLOY_DIR"
docker compose pull
docker compose up -d

echo ""
echo "============================================"
echo "  Setup Complete!"
echo "============================================"
echo ""
echo "  Frontend:   http://localhost:3000"
echo "  Image:      $GHCR_IMAGE"
echo ""
echo "  Watchtower is polling GHCR every 30 seconds."
echo "  When a new image is pushed, it will automatically"
echo "  pull it and restart the frontend container."
echo ""
echo "  Useful commands:"
echo "    cd $DEPLOY_DIR"
echo "    docker compose ps          # check status"
echo "    docker compose logs -f     # view logs"
echo "    docker compose down        # stop everything"
echo ""
