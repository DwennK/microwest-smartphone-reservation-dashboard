# syntax=docker/dockerfile:1

FROM node:22.21.1-slim AS base
WORKDIR /app

FROM base AS build

COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json

RUN npm ci --include=dev

COPY client ./client
COPY server ./server
COPY README.md ./

RUN npm run build

FROM base AS runtime

ENV NODE_ENV=production
ENV PORT=3001

COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json

RUN npm ci --omit=dev

COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/server ./server
COPY README.md ./

EXPOSE 3001

CMD ["npm", "run", "start"]
