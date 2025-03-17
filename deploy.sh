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

# Build the Docker image
echo "Building Docker image..."
# Create a temporary build directory to avoid git context issues
mkdir -p tmp_build
cp -r index.html main.js style.css vite.config.js package*.json nginx.conf tmp_build/
if [ -d "public" ]; then
  cp -r public tmp_build/
fi

# Build from the temporary directory
docker build --no-cache --build-arg GITHUB_TOKEN=$GITHUB_TOKEN -t hourglass-timer:latest -f Dockerfile tmp_build

# Check if build was successful
if [ $? -ne 0 ]; then
  echo "Error: Docker build failed"
  # Clean up
  rm -rf tmp_build
  exit 1
fi

# Clean up
rm -rf tmp_build

# Check if previous container exists and remove it
if [ "$(docker ps -aq -f name=hourglass-timer)" ]; then
  echo "Removing existing container..."
  docker stop hourglass-timer
  docker rm hourglass-timer
fi

# Run the container
echo "Starting container..."
docker run -d -p 80:80 --name hourglass-timer hourglass-timer:latest

if [ $? -eq 0 ]; then
  echo "Deployment complete! Application available at http://localhost"
else
  echo "Error: Failed to start container"
  exit 1
fi
