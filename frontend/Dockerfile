FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ARG VITE_API_URL=http://localhost:3001/v1
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM node:20-alpine
WORKDIR /app

RUN npm install -g serve@14.2.4
COPY --from=builder /app/dist dist

EXPOSE 4173
CMD ["serve", "-s", "dist", "-l", "4173"]
