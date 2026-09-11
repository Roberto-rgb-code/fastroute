# syntax=docker/dockerfile:1
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/mobile/package.json ./apps/mobile/

RUN npm ci --ignore-scripts

COPY apps/web ./apps/web

WORKDIR /app/apps/web

ENV NODE_ENV=development
EXPOSE 4200

# Proxy targets the Docker service name "api"
CMD ["npm", "run", "start", "--", "--host", "0.0.0.0", "--port", "4200", "--proxy-config", "proxy.conf.docker.json"]
