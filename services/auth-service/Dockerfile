FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=5s --retries=5 CMD node -e "require('http').get('http://localhost:3001/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"
CMD ["sh", "-c", "node migrate.js && node src/index.js"]
