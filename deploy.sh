#!/bin/bash
# Build the Docker image with explicit context path
docker build -t hourglass-timer:latest .

# Run the container
docker run -d -p 80:80 --name hourglass-timer hourglass-timer:latest
