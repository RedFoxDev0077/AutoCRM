#!/bin/bash
# deploy.sh — Run once on the VPS to deploy the full stack
set -e

echo "==> Updating system..."
apt-get update -q && apt-get upgrade -y -q

echo "==> Installing Docker..."
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

echo "==> Installing Docker Compose plugin..."
apt-get install -y docker-compose-plugin

echo "==> Cloning project..."
# Replace with your actual git repo URL after pushing
# git clone https://github.com/youruser/autocrm.git /opt/autocrm
# cd /opt/autocrm

echo "==> Copying .env..."
cp .env.example .env
echo ""
echo "  *** EDIT .env with your real credentials before continuing ***"
echo "  Run: nano .env"
echo ""
read -p "Press Enter when .env is ready..."

echo "==> Creating nginx certs directory..."
mkdir -p nginx/certs

echo "==> Building and starting containers..."
docker compose up -d --build

echo "==> Waiting for services to start..."
sleep 10

echo "==> Checking health..."
curl -s http://localhost/health || echo "Backend not ready yet — wait 30s and retry"

echo ""
echo "==> Done! Stack is running."
echo "    Frontend: http://$(curl -s ifconfig.me)"
echo "    API:      http://$(curl -s ifconfig.me)/api"
echo ""
echo "==> To enable HTTPS:"
echo "    1. Point your domain DNS A record to this IP"
echo "    2. Run: docker compose run --rm certbot certonly --webroot -w /var/www/certbot -d YOUR_DOMAIN --email YOUR_EMAIL --agree-tos"
echo "    3. Uncomment the HTTPS server block in nginx/nginx.conf"
echo "    4. Run: docker compose restart nginx"
