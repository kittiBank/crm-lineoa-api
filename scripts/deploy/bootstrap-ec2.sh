#!/usr/bin/env bash
# One-time EC2 bootstrap (run manually via SSH before first CI deploy).
# Example:
#   curl -fsSL https://raw.githubusercontent.com/kittiBank/crm-lineoa-api/main/scripts/deploy/bootstrap-ec2.sh | bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/crm-lineoa-api}"

echo "==> Installing Docker (Amazon Linux 2023 / Ubuntu)"
if command -v apt-get >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y ca-certificates curl gnupg
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" |
    sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  sudo usermod -aG docker "$USER"
elif command -v dnf >/dev/null 2>&1; then
  sudo dnf install -y docker
  sudo systemctl enable --now docker
  sudo usermod -aG docker "$USER"
  DOCKER_CONFIG="${DOCKER_CONFIG:-$HOME/.docker}"
  mkdir -p "$DOCKER_CONFIG/cli-plugins"
  curl -SL "https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-$(uname -m)" \
    -o "$DOCKER_CONFIG/cli-plugins/docker-compose"
  chmod +x "$DOCKER_CONFIG/cli-plugins/docker-compose"
else
  echo "Unsupported OS. Install Docker + Compose plugin manually." >&2
  exit 1
fi

mkdir -p "$APP_DIR"
echo "==> Bootstrap complete."
echo "    App directory: $APP_DIR"
echo "    Log out/in (or new SSH session) so docker group applies."
echo "    Set GitHub repository variable EC2_APP_DIR=$APP_DIR if different from default."
