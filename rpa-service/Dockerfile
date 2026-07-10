FROM node:20-slim

# Instalar chromium nativo (esto incluye todas las dependencias del OS)
RUN apt-get update && apt-get install -y chromium && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Decirle a Playwright que use el Chromium nativo
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

EXPOSE 4000
CMD ["npm", "start"]
