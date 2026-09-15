# syntax=docker/dockerfile:1
FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates procps python3 python3-pip python3-venv \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/mobile/package.json ./apps/mobile/

RUN npm ci --ignore-scripts

COPY apps/api ./apps/api

WORKDIR /app/apps/api
RUN rm -rf geopy/.venv \
  && python3 -m venv geopy/.venv \
  && geopy/.venv/bin/pip install --no-cache-dir -r geopy/requirements.txt \
  && npx prisma generate

ENV NODE_ENV=development
ENV API_PORT=3000
ENV GEOCODE_PYTHON=/app/apps/api/geopy/.venv/bin/python
ENV GEOCODE_SCRIPT=/app/apps/api/geopy/geocode.py
EXPOSE 3000

CMD ["npm", "run", "start:dev"]
