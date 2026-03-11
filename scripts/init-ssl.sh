#!/bin/bash
# ============================================================================
# SSL Certificate Initialization Script
# Run this on EC2 after DNS has propagated to the server IP
# Usage: bash scripts/init-ssl.sh
# ============================================================================

set -e

DOMAIN="oneops.co.nz"
EMAIL="${SSL_EMAIL:-admin@oneops.co.nz}"

echo "============================================"
echo "  SSL Certificate Setup for $DOMAIN"
echo "============================================"

cd ~/fnb-ops

# Step 1: Check DNS resolution
echo ""
echo "[1/6] Checking DNS resolution..."
if command -v dig &> /dev/null; then
    RESOLVED_IP=$(dig +short $DOMAIN 2>/dev/null)
elif command -v nslookup &> /dev/null; then
    RESOLVED_IP=$(nslookup $DOMAIN 2>/dev/null | tail -2 | grep Address | awk '{print $2}')
else
    echo "  WARNING: Cannot check DNS. Proceeding anyway..."
    RESOLVED_IP="unknown"
fi

if [ -z "$RESOLVED_IP" ]; then
    echo "  ERROR: Cannot resolve $DOMAIN. Please wait for DNS propagation."
    echo "  You can check with: nslookup $DOMAIN"
    exit 1
fi
echo "  $DOMAIN resolves to: $RESOLVED_IP"

# Step 2: Create dummy certificate so nginx can start
echo ""
echo "[2/6] Creating temporary self-signed certificate..."
CERT_DIR="/tmp/letsencrypt/live/$DOMAIN"
mkdir -p "$CERT_DIR"
openssl req -x509 -nodes -newkey rsa:2048 \
    -days 1 \
    -keyout "$CERT_DIR/privkey.pem" \
    -out "$CERT_DIR/fullchain.pem" \
    -subj "/CN=$DOMAIN" 2>/dev/null
echo "  Temporary certificate created."

# Step 3: Copy dummy cert to Docker volume and start containers
echo ""
echo "[3/6] Starting containers with temporary certificate..."
docker-compose -f docker-compose.aws.yml up -d --build

# Wait for nginx to start
sleep 5

# Copy dummy certs into the certbot volume
docker cp "$CERT_DIR/fullchain.pem" fnb-ops-nginx:/etc/letsencrypt/live/$DOMAIN/fullchain.pem 2>/dev/null || true
docker cp "$CERT_DIR/privkey.pem" fnb-ops-nginx:/etc/letsencrypt/live/$DOMAIN/privkey.pem 2>/dev/null || true

# Create cert directory in volume
docker-compose -f docker-compose.aws.yml exec -T nginx sh -c "mkdir -p /etc/letsencrypt/live/$DOMAIN" 2>/dev/null || true
docker-compose -f docker-compose.aws.yml exec -T nginx sh -c "mkdir -p /var/www/certbot" 2>/dev/null || true

# Restart nginx to load the config
docker-compose -f docker-compose.aws.yml restart nginx
sleep 5

echo "  Containers started."

# Step 4: Remove dummy certificate and request real one
echo ""
echo "[4/6] Requesting real SSL certificate from Let's Encrypt..."

# Delete dummy certs from volume
docker-compose -f docker-compose.aws.yml exec -T nginx sh -c "rm -rf /etc/letsencrypt/live/$DOMAIN" 2>/dev/null || true
docker-compose -f docker-compose.aws.yml exec -T nginx sh -c "rm -rf /etc/letsencrypt/renewal/$DOMAIN.conf" 2>/dev/null || true

# Request real certificate
docker-compose -f docker-compose.aws.yml run --rm certbot \
    certonly --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN" \
    -d "www.$DOMAIN"

# Step 5: Reload nginx with real certificate
echo ""
echo "[5/6] Reloading Nginx with real SSL certificate..."
docker-compose -f docker-compose.aws.yml restart nginx
sleep 3

# Step 6: Verify
echo ""
echo "[6/6] Verifying SSL setup..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/" --max-time 10 2>/dev/null || echo "000")
if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "301" ] || [ "$HTTP_STATUS" = "302" ]; then
    echo "  SSL is working! HTTPS status: $HTTP_STATUS"
else
    echo "  WARNING: HTTPS returned status $HTTP_STATUS"
    echo "  This might be normal if DNS hasn't fully propagated."
    echo "  Check logs: docker logs fnb-ops-nginx"
fi

# Cleanup
rm -rf /tmp/letsencrypt

echo ""
echo "============================================"
echo "  SSL Setup Complete!"
echo ""
echo "  https://$DOMAIN"
echo "  https://www.$DOMAIN"
echo ""
echo "  Certificate auto-renewal is configured."
echo "  To manually renew:"
echo "    docker-compose -f docker-compose.aws.yml run --rm certbot renew"
echo "    docker-compose -f docker-compose.aws.yml restart nginx"
echo "============================================"
