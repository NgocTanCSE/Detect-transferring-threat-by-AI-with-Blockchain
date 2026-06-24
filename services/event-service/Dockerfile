FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3007
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 CMD wget --no-verbose --tries=1 --spider http://localhost:3007/health || exit 1
CMD ["node", "src/index.js"]
