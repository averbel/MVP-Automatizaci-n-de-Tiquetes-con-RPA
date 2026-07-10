FROM mcr.microsoft.com/playwright:v1.40.0-jammy

# Crear directorio de la app
WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el código de la aplicación
COPY . .

# Exponer el puerto
EXPOSE 4000

# Iniciar la aplicación
CMD ["npm", "start"]
