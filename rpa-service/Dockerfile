FROM node:20-bookworm

# Crear directorio de la app
WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Instalar dependencias del sistema operativo y navegadores para Playwright
RUN npx playwright install --with-deps chromium

# Copiar el resto del código
COPY . .

# Exponer el puerto
EXPOSE 4000

# Comando de inicio
CMD ["npm", "start"]
