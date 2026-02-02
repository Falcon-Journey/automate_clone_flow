# Use official Playwright image with Chromium (Ubuntu 22.04 LTS).
# Image version MUST match the Playwright version in package.json / package-lock.json.
# See: https://playwright.dev/docs/docker
FROM mcr.microsoft.com/playwright:v1.58.1-jammy

WORKDIR /app

# Copy package files first (leverage Docker layer cache)
COPY package.json package-lock.json* ./

# Install production deps only (no devDependencies)
RUN npm ci --omit=dev

# Copy app code
COPY server.js ./

# Create screenshots directory and set ownership
RUN mkdir -p screenshots && chown -R pwuser:pwuser screenshots

# Run as non-root user (pwuser)
USER pwuser

# Expose port (Elastic Beanstalk / ECS will map this)
EXPOSE 5001

# Use PORT env var (default 5001)
ENV PORT=5001

# Signal to app that it runs in Docker (headless Playwright, Chromium args)
ENV DOCKER=1
ENV NODE_ENV=production

# Health check – use a simple HTTP request to /api/health
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+process.env.PORT+'/api/health', (r)=>{ process.exit(r.statusCode===200?0:1); }).on('error', ()=> process.exit(1));" || exit 1

# Start the server
CMD ["node", "server.js"]
