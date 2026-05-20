FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json next.config.mjs postcss.config.js tailwind.config.ts ./
COPY app ./app
COPY components ./components
COPY lib ./lib
COPY public ./public

EXPOSE 3000
CMD ["npm", "run", "dev"]
