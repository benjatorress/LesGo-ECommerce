# Dockerfile para el Backend (Node.js Express)
FROM node:22-alpine

WORKDIR /app

# Copiar archivos de descripción de dependencias
COPY package*.json ./

# Instalar dependencias de ejecución desde el lockfile
RUN npm ci --omit=dev

# Copiar el código fuente
COPY . .

# Exponer puerto
EXPOSE 5000

# Iniciar la API
CMD ["npm", "start"]
