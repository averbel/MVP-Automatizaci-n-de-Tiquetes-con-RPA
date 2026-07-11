FROM node:20-slim

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY web/package.json web/package-lock.json ./
RUN npm ci

COPY web/prisma ./prisma
RUN npx prisma generate

COPY web/ ./
RUN npx vue-tsc -b && npx vite build

COPY web/server.ts ./
COPY web/api ./api/
COPY web/shared ./shared/
COPY web/tsconfig.server.json ./
RUN npx tsc --project tsconfig.server.json

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist-server/server.js"]
