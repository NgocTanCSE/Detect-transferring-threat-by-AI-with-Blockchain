# --- Stage 1: Frontend Builder ---
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- Stage 2: Backend & Runtime ---
FROM python:3.11-slim AS runtime

# Install system dependencies
RUN apt-get update && apt-get install -y \
  gcc \
  libpq-dev \
  curl \
  supervisor \
  nodejs \
  npm \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Setup Backend
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# Copy Backend code
COPY backend/ ./backend/

# Copy database bootstrap SQL files used for Supabase initialization
COPY database/ ./database/

# Setup Frontend from builder
COPY --from=frontend-builder /app/frontend/public ./frontend/public
COPY --from=frontend-builder /app/frontend/.next/standalone ./frontend/
COPY --from=frontend-builder /app/frontend/.next/static ./frontend/.next/static

# Copy supervisord config
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app/backend
ENV PORT=7860
ENV BACKEND_URL=http://localhost:8000

# Create log directory for supervisor
RUN mkdir -p /var/log/supervisor && chmod -R 777 /var/log/supervisor

# Hugging Face Spaces port
EXPOSE 7860

# We use a custom entrypoint script to handle potential migrations or seeding
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

CMD ["/app/entrypoint.sh"]
