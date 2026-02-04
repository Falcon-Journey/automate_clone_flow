# Option A: Single-host deploy (backend + frontend). Build from repo root: docker build -t clone-app .

# Stage 1: build frontend
FROM node:20-alpine AS frontend
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: backend + Playwright (serves API + frontend when SERVE_FRONTEND=1)
FROM mcr.microsoft.com/playwright:v1.58.1-jammy
WORKDIR /app
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --omit=dev
COPY backend/server.js ./
RUN mkdir -p screenshots && chown -R pwuser:pwuser screenshots
COPY --from=frontend /fe/dist ./frontend-dist
USER pwuser
EXPOSE 5001
ENV PORT=5001
ENV DOCKER=1
ENV NODE_ENV=production
ENV SERVE_FRONTEND=1
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+process.env.PORT+'/api/health', (r)=>{ process.exit(r.statusCode===200?0:1); }).on('error', ()=> process.exit(1));" || exit 1
CMD ["node", "server.js"]
