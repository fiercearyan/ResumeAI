FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++ libc6-compat openssl

COPY services/orchestrator/package.json ./
RUN npm install --no-audit --no-fund

COPY services/orchestrator/prisma ./prisma
RUN npx prisma generate

COPY services/orchestrator/tsconfig.json services/orchestrator/nest-cli.json ./
COPY services/orchestrator/src ./src

EXPOSE 4000

# Run migrations on startup (idempotent), then boot in watch mode.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:dev"]
