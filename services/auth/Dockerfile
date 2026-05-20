FROM node:20-alpine

WORKDIR /app

# Install build deps for argon2 native
RUN apk add --no-cache python3 make g++ libc6-compat

COPY services/auth/package.json ./
RUN npm install --no-audit --no-fund

COPY services/auth/tsconfig.json services/auth/nest-cli.json ./
COPY services/auth/src ./src

EXPOSE 4001

CMD ["npm", "run", "start:dev"]
