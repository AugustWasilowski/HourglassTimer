#!/bin/bash
# Check if .env file exists
if [ ! -f .env ]; then
  echo "Error: .env file not found. Please create one based on .env.example"
  exit 1
fi

# Load environment variables
source .env

# Verify all required files exist
required_files=("Dockerfile" "nginx.conf" "package.json")
for file in "${required_files[@]}"; do
  if [ ! -f "$file" ]; then
    echo "Error: Required file $file not found in current directory"
    exit 1
  fi
done

# Login to GitHub Container Registry using the token
echo "Authenticating with GitHub..."
echo $GITHUB_TOKEN | docker login ghcr.io -u $GITHUB_USERNAME --password-stdin

# Build the Docker image
echo "Building Docker image..."
docker build --build-arg GITHUB_TOKEN=$GITHUB_TOKEN -t hourglass-timer:latest .

# Check if previous container exists and remove it
if [ "$(docker ps -aq -f name=hourglass-timer)" ]; then
  echo "Removing existing container..."
  docker stop hourglass-timer
  docker rm hourglass-timer
fi

# Run the container
echo "Starting container..."
docker run -d -p 80:80 --name hourglass-timer hourglass-timer:latest

echo "Deployment complete! Application available at http://localhost"
