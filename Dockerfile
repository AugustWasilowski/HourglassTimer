FROM node:18-alpine AS build

# Add GitHub token as build argument
ARG GITHUB_TOKEN
# Configure npm to use GitHub packages with authentication
RUN if [ -n "$GITHUB_TOKEN" ]; then \
    echo "//npm.pkg.github.com/:_authToken=$GITHUB_TOKEN" > ~/.npmrc && \
    echo "@OWNER:registry=https://npm.pkg.github.com" >> ~/.npmrc; \
    fi

WORKDIR /app
COPY package*.json ./
# Use the token for npm install if needed
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
