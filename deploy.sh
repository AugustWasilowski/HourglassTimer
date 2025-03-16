#!/bin/bash
# Check if .env file exists
if [ ! -f .env ]; then
  echo "Error: .env file not found. Please create one based on .env.example"
  exit 1
fi

# Load environment variables
source .env

# Create a temporary build directory
mkdir -p /tmp/hourglass-build
cp -r * /tmp/hourglass-build/
cp .dockerignore /tmp/hourglass-build/
cp .env /tmp/hourglass-build/

# Build the Docker image from the clean directory
cd /tmp/hourglass-build

# Login to GitHub Container Registry using the token
echo "Authenticating with GitHub..."
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Build the Docker image
docker build --build-arg GITHUB_TOKEN=$GITHUB_TOKEN -t hourglass-timer:latest .

# Run the container
echo "Starting container..."
docker run -d -p 80:80 --name hourglass-timer hourglass-timer:latest

# Clean up
cd -
rm -rf /tmp/hourglass-build
echo "Deployment complete!"
