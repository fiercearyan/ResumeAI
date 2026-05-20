FROM mcr.microsoft.com/playwright:v1.42.1-jammy

WORKDIR /app

# Prisma uses openssl
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY services/auto-apply/package.json ./
RUN npm install --no-audit --no-fund

# Use the same Prisma schema as the orchestrator (single source of truth).
COPY services/orchestrator/prisma ./prisma
RUN npx prisma generate

COPY services/auto-apply/tsconfig.json ./
COPY services/auto-apply/src ./src

EXPOSE 8005
CMD ["npx", "tsx", "src/main.ts"]
