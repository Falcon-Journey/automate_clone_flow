# Hosting on AWS

This app has a **Node + Playwright backend** (Express, Chromium) and a **Vite + React frontend**. The backend automates Anima’s “Clone Website” flow; the frontend streams progress and shows the result.

To run correctly on AWS you need:

1. **Backend** in a **container** (Playwright/Chromium needs a proper runtime). Use **Elastic Beanstalk (Docker)** or **ECS Fargate**.
2. **Frontend** either served from the **same host** as the backend (one URL, no CORS) or on **S3 + CloudFront** with the backend URL set at build time.
3. **Environment variables** for Anima and port (see below).

---

## Architecture summary

| Part        | Tech              | Notes |
|------------|-------------------|--------|
| Backend    | Express, Playwright, Chromium | Must run in Docker on AWS (headless). |
| Frontend   | Vite, React       | Static build; can be served by backend or S3/CloudFront. |
| API        | `GET /api/clone-stream?url=...&prompt=...`, `GET /api/health`, `GET /screenshots/*` | Backend must be reachable on these. |

Backend already uses `process.env.ANIMA_EMAIL` and `process.env.ANIMA_PASSWORD` (with fallbacks for local dev). **On AWS, always set these in the environment** (no hardcoded credentials in production).

---

## Option A: Single host (simplest – one URL)

One domain, backend serves both API and frontend. No CORS, no `VITE_API_URL` needed.

### 1. Build frontend and plug into backend

```bash
# From repo root
cd frontend
npm ci
npm run build
# Puts output in frontend/dist

cd ../backend
cp -r ../frontend/dist ./frontend-dist
```

### 2. Backend Docker image that includes frontend

A **root-level** [Dockerfile](Dockerfile) builds the frontend and copies it into the Playwright backend image. Build from **repo root**:

```bash
docker build -t clone-app .
# Run locally: docker run --init --ipc=host -p 5001:5001 -e ANIMA_EMAIL=... -e ANIMA_PASSWORD=... clone-app
```

### 3. Deploy that image to AWS

- **Elastic Beanstalk (Docker)**  
  - Use the Dockerfile that includes frontend (e.g. from repo root as above).  
  - In EB, set env: `ANIMA_EMAIL`, `ANIMA_PASSWORD`, `PORT=8080` (if EB expects 8080), `SERVE_FRONTEND=1`.  
  - Open the EB URL in the browser: you get the app and `/api/*`, `/screenshots/*` on the same origin.

- **ECS Fargate**  
  - Build and push the same image to ECR.  
  - Create a service with an ALB; target group on the container port (5001 or 8080).  
  - Set env: `ANIMA_EMAIL`, `ANIMA_PASSWORD`, `PORT`, `SERVE_FRONTEND=1`.  
  - Use ALB URL (or a custom domain) as the single entry point.

Result: one host, e.g. `https://your-env.elasticbeanstalk.com` or `https://your-alb-domain.com`. Frontend and API work with no extra CORS or API URL config.

---

## Option B: Frontend and backend on different hosts

Frontend on **S3 + CloudFront** (or Amplify), backend on **EB** or **ECS**.

### 1. Backend (EB or ECS)

- Deploy **backend only** (current `backend/Dockerfile`), as in [backend/DEPLOYMENT.md](backend/DEPLOYMENT.md).  
- Set env: `ANIMA_EMAIL`, `ANIMA_PASSWORD`, `PORT` (8080 for EB if required).  
- Note the backend base URL, e.g. `https://api.yourdomain.com` or `https://your-eb-env.elasticbeanstalk.com`.

### 2. Frontend build with backend URL

The frontend uses `VITE_API_URL` for the EventSource and screenshot URLs. Build with the **exact** backend base URL (no trailing slash):

```bash
cd frontend
npm ci
VITE_API_URL=https://api.yourdomain.com npm run build
```

Upload the contents of `frontend/dist` to S3 and point CloudFront (or Amplify) at that bucket. Use the CloudFront/Amplify URL (or your custom domain) as the app URL.

### 3. CORS

Backend has `app.use(cors())` so all origins are allowed. For production you can restrict:

```javascript
const allowedOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: allowedOrigin }));
```

Set `CORS_ORIGIN=https://your-frontend-domain.com` in the backend environment.

Result: users open the frontend URL; the app calls and displays screenshots from the backend URL correctly.

---

## Environment variables (backend)

| Variable           | Required | Description |
|--------------------|----------|-------------|
| `PORT`             | No       | Server port (default 5001; EB often uses 8080). |
| `ANIMA_EMAIL`      | Yes*     | Anima login email (*required when login is used). |
| `ANIMA_PASSWORD`   | Yes*     | Anima login password. |
| `NODE_ENV`         | No       | Set to `production` on AWS. |
| `SERVE_FRONTEND`   | No       | Set to `1` only when frontend static files are in `backend/frontend-dist` (Option A). |
| `CORS_ORIGIN`      | No       | Restrict CORS to this origin (Option B). |

---

## Frontend (Option B only)

| Variable         | When        | Description |
|------------------|-------------|-------------|
| `VITE_API_URL`   | Build time  | Backend base URL, e.g. `https://api.yourdomain.com`. Omit for same-origin (Option A). |

---

## Endpoints to expose

- `GET /api/health` – health check (ALB/EB).
- `GET /api/clone-stream?url=<url>&prompt=<optional>` – SSE clone flow.
- `GET /screenshots/*` – static screenshots.

ALB/EB must forward traffic to the container port (5001 or 8080). Security groups: allow inbound from the ALB (and, for Option B, from the internet on 443 if you use HTTPS on the ALB).

---

## Checklist for “working correctly” on AWS

- [ ] Backend runs in Docker (Playwright image); `DOCKER=1` or `/.dockerenv` so Chromium runs headless with safe args.
- [ ] `ANIMA_EMAIL` and `ANIMA_PASSWORD` set in the backend environment (never rely on fallbacks in production).
- [ ] `PORT` matches what the platform expects (e.g. 8080 for EB).
- [ ] Health check: `GET /api/health` returns 200 (used by EB/ECS/ALB).
- [ ] **Option A**: Frontend build is inside the image and `SERVE_FRONTEND=1` is set; one URL serves both app and API.
- [ ] **Option B**: Frontend built with `VITE_API_URL=<backend base URL>`; CORS allows your frontend origin if you set `CORS_ORIGIN`.
- [ ] ALB/EB listener forwards to the container port; timeouts for `/api/clone-stream` are at least 30+ minutes (long-running SSE).

For more detail on **EB vs ECS**, Docker run flags, and cost, see [backend/DEPLOYMENT.md](backend/DEPLOYMENT.md).
