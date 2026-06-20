FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY . .
RUN npm ci --frozen-lockfile
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile --production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["npm", "start"]
