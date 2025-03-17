FROM node:18-alpine AS build

# Add GitHub token as build argument
ARG GITHUB_TOKEN

WORKDIR /app
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . ./

# Build the application
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
