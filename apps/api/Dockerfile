FROM node:20-slim
RUN apt-get update -y && apt-get install -y openssl
WORKDIR /app

COPY package.json ./
COPY prisma ./prisma
RUN npm install --production

COPY src ./src

EXPOSE 5000

# Apply ERP migrations before starting. (Home-schooling runs as its own service.)
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
