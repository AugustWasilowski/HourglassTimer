#!/bin/bash
# Build the Docker image
docker build -t hourglass-timer .

# Run the container
docker run -d -p 80:80 --name hourglass-timer hourglass-timer
