#!/bin/bash
# Workflux Deployment Script
# Server: root@ssh178.104.228.157
# Password: Jaymaakaali@321 (for SSH authentication)

set -e

echo "=== Workflux Enterprise Deployment ==="
echo "Target Server: ssh178.104.228.157"

# Step 1: Connect to server and setup
ssh root@ssh178.104.228.157 << 'SSH_COMMANDS'

echo "Step 1: Updating system packages..."
apt-get update && apt-get upgrade -y

echo "Step 2: Installing Node.js and npm..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

echo "Step 3: Installing PM2 process manager..."
npm install -g pm2

echo "Step 4: Creating workspace directory..."
mkdir -p /var/www/workflux
cd /var/www/workflux

echo "Step 4: Initializing Git repository (or upload files)..."
# Note: You'll need to upload your Workflux project files here
# git init
# git remote add origin <your-repo-url>
# git pull origin main

echo ""
echo "=== Deployment Setup Complete ==="
echo "Please upload your Workflux project files to /var/www/workflux/"
echo "Then run: cd /var/www/workflux && bash install.sh"
SSH_COMMANDS

echo ""
echo "=== Now upload files and run installation ==="
echo "1. Upload Workflux project to /var/www/workflux/ on your server"
echo "2. Run: cd /var/www/workflux && bash install.sh"