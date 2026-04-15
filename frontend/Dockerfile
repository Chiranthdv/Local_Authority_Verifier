ARG TARGETPLATFORM=linux/amd64
FROM --platform=$TARGETPLATFORM node:20-alpine
# Fallback if alpine still throws exec format errors:
# FROM --platform=$TARGETPLATFORM node:20

WORKDIR /app
ENV NODE_ENV=development

COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
