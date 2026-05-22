FROM node:20-slim
RUN apt-get update -y && apt-get install -y openssl
WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src

EXPOSE 5000

CMD ["node", "src/server.js"]
