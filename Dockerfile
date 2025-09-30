# syntax=docker/dockerfile:1
FROM node:18-alpine AS base
WORKDIR /app

# copy project
COPY server/package.json server/package.json
COPY server/dist/ server/dist/
COPY public/ public/
COPY README.md README.md

ENV NODE_ENV=production
ENV STATLITE_DATA=/data

EXPOSE 8787

CMD ["node", "server/dist/index.js"]

