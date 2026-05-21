FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

COPY services/notifications/package.json ./
RUN npm install --no-audit --no-fund

COPY services/orchestrator/prisma ./prisma
RUN npx prisma generate

COPY services/notifications/tsconfig.json ./
COPY services/notifications/src ./src

EXPOSE 8006
CMD ["npx", "tsx", "src/main.ts"]
