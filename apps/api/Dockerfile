FROM node:20-slim
RUN apt-get update -y && apt-get install -y openssl
WORKDIR /app

COPY package.json ./
COPY prisma ./prisma
RUN npm install --production

COPY src ./src

EXPOSE 5000

# Apply migrations to both databases (ERP + home-schooling) before starting.
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma migrate deploy --schema=prisma/homeschool/schema.prisma && node src/server.js"]
