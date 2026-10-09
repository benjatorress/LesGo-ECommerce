# Dockerfile para el Backend (Node.js Express)
FROM node:20-alpine

WORKDIR /app

# Copiar archivos de descripción de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar el código fuente
COPY . .

# Exponer puerto
EXPOSE 5000

# Comando para iniciar el backend
CMD ["npm", "start"]
