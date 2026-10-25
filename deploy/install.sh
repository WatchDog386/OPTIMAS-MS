#!/usr/bin/env bash
# One-time preparation of a fresh Ubuntu 22.04/24.04 VM (e.g. on Proxmox) for Optimas MS.
# Run as root:  sudo bash deploy/install.sh
set -euo pipefail

echo "▶ Updating system…"
apt-get update -y && apt-get upgrade -y
apt-get install -y ca-certificates curl git ufw fail2ban unattended-upgrades qemu-guest-agent

echo "▶ Enabling QEMU guest agent (lets Proxmox see the VM IP and shut it down cleanly)…"
systemctl enable --now qemu-guest-agent || true

echo "▶ Adding swap if RAM is small (building the app needs headroom on 2 GB VMs)…"
mem_kb=$(awk '/MemTotal/ {print $2}' /proc/meminfo)
if [ "$mem_kb" -lt 3800000 ] && ! swapon --show | grep -q /swapfile; then
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "   4 GB swap enabled."
fi

echo "▶ Installing Docker…"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

echo "▶ Firewall: allow SSH, HTTP, HTTPS only…"
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

echo "▶ Automatic security updates + SSH brute-force protection…"
dpkg-reconfigure -f noninteractive unattended-upgrades
systemctl enable --now fail2ban

echo "✅ VM ready. Next: cp deploy/.env.example deploy/.env, edit it, then run: bash deploy/deploy.sh"
