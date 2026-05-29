FROM node:20-slim
RUN apt-get update -y && apt-get install -y openssl
WORKDIR /app

COPY package.json ./
COPY prisma ./prisma
RUN npm install --production

COPY src ./src

EXPOSE 5000

CMD ["node", "src/server.js"]
