#!/bin/bash
# ============================================================================
# AWS EC2 Deployment Script for fnb-ops
# Run this on a fresh EC2 instance (Amazon Linux 2023 or Ubuntu 22.04)
# ============================================================================

set -e

echo "=========================================="
echo "  fnb-ops AWS Deployment"
echo "=========================================="

# ============================================================================
# Step 1: Install Docker
# ============================================================================
install_docker() {
    echo "[1/5] Installing Docker..."

    if command -v docker &> /dev/null; then
        echo "Docker already installed."
    else
        # Amazon Linux 2023
        if [ -f /etc/amazon-linux-release ]; then
            sudo dnf update -y
            sudo dnf install -y docker
            sudo systemctl start docker
            sudo systemctl enable docker
            sudo usermod -aG docker $USER
        # Ubuntu
        elif [ -f /etc/lsb-release ]; then
            sudo apt-get update
            sudo apt-get install -y ca-certificates curl gnupg
            sudo install -m 0755 -d /etc/apt/keyrings
            curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
            sudo chmod a+r /etc/apt/keyrings/docker.gpg
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
            sudo apt-get update
            sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
            sudo usermod -aG docker $USER
        fi
        echo "Docker installed successfully."
    fi
}

# ============================================================================
# Step 2: Install Docker Compose
# ============================================================================
install_docker_compose() {
    echo "[2/5] Installing Docker Compose..."

    if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
        echo "Docker Compose already installed."
    else
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
        echo "Docker Compose installed successfully."
    fi
}

# ============================================================================
# Step 3: Install Git
# ============================================================================
install_git() {
    echo "[3/5] Installing Git..."

    if command -v git &> /dev/null; then
        echo "Git already installed."
    else
        if [ -f /etc/amazon-linux-release ]; then
            sudo dnf install -y git
        else
            sudo apt-get install -y git
        fi
    fi
}

# ============================================================================
# Step 4: Clone Repository
# ============================================================================
clone_repo() {
    echo "[4/5] Setting up project..."

    APP_DIR="/home/$USER/fnb-ops"

    if [ -d "$APP_DIR" ]; then
        echo "Project directory exists. Pulling latest changes..."
        cd "$APP_DIR"
        git pull origin main
    else
        echo "Cloning repository..."
        git clone https://github.com/kysong1981-code/fnb-ops.git "$APP_DIR"
        cd "$APP_DIR"
    fi
}

# ============================================================================
# Step 5: Setup Environment & Deploy
# ============================================================================
deploy() {
    echo "[5/5] Deploying..."

    APP_DIR="/home/$USER/fnb-ops"
    cd "$APP_DIR"

    # Check if .env exists
    if [ ! -f .env ]; then
        echo ""
        echo "ERROR: .env file not found!"
        echo "Please create .env file first:"
        echo "  cp .env.aws.example .env"
        echo "  nano .env  # Fill in your RDS and other settings"
        echo ""
        exit 1
    fi

    # Create logs directory
    mkdir -p backend/logs

    # Build and start containers
    echo "Building and starting containers..."
    docker compose -f docker-compose.aws.yml build
    docker compose -f docker-compose.aws.yml up -d

    echo ""
    echo "=========================================="
    echo "  Deployment Complete!"
    echo "=========================================="
    echo ""
    echo "  App URL: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo 'your-ec2-ip')"
    echo ""
    echo "  Useful commands:"
    echo "    docker compose -f docker-compose.aws.yml logs -f     # View logs"
    echo "    docker compose -f docker-compose.aws.yml restart     # Restart"
    echo "    docker compose -f docker-compose.aws.yml down        # Stop"
    echo ""
    echo "  Create admin user:"
    echo "    docker compose -f docker-compose.aws.yml exec backend python manage.py createsuperuser"
    echo ""
}

# ============================================================================
# Run
# ============================================================================
install_docker
install_docker_compose
install_git
clone_repo
deploy
