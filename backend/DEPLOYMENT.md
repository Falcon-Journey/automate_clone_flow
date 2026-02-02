# Deploy Backend to AWS (Minimal Cost)

This guide covers deploying the Node + Playwright backend to AWS using **containers**, with options for **Elastic Beanstalk (EB)** or **ECS Fargate**. Both work with the included `Dockerfile`.

## Prerequisites

- AWS CLI configured (`aws configure`)
- Docker installed locally (to build and optionally push the image)
- Anima credentials: `ANIMA_EMAIL`, `ANIMA_PASSWORD` (set in AWS as environment variables)

---

## 1. Build & run the image locally

```bash
cd backend
cp .env.example .env
# Edit .env: set ANIMA_EMAIL, ANIMA_PASSWORD, and optionally PORT

docker build -t clone-backend .
docker run --init --ipc=host -p 5001:5001 --env-file .env clone-backend
```

- `--init`: avoids zombie processes (recommended by Playwright).
- `--ipc=host`: recommended for Chromium in Docker.
- **If the clone gets stuck during "Monitoring progress"** in Docker: give the container more memory and shared memory, e.g. `docker run ... --shm-size=1g -m 2g ...` (Chromium in headless can hang when starved of memory/shm).

Test: `curl http://localhost:5001/api/health`

---

## 2. Option A: AWS Elastic Beanstalk (Docker platform) — simplest

Elastic Beanstalk can run your Dockerfile directly (single container). Good for one backend service with minimal setup.

### Steps

1. **Install EB CLI** (if needed):
   ```bash
   pip install awsebcli
   ```

2. **From the repo root** (parent of `backend`):
   ```bash
   eb init -p docker clone-backend --region us-east-1
   ```
   - When asked for Docker configuration, choose "Docker running on 64bit Amazon Linux 2" or use a **Dockerfile in the application directory**.  
   - To use the backend’s Dockerfile, either:
     - Run `eb init` from inside `backend`, or  
     - Add a top-level `Dockerfile` that builds/runs from `backend` (e.g. multi-stage or `COPY backend/` and set `WORKDIR`), then run `eb init` from repo root.  
   The simplest is to run EB from **inside `backend`** so it uses `backend/Dockerfile`.

3. **Run from `backend` directory**:
   ```bash
   cd backend
   eb init -p docker clone-backend --region us-east-1
   eb create clone-backend-env
   ```
   Or, if you already have a different app at repo root, create a `Dockerrun.aws.json` that points to your built image; for “Dockerfile” style, running `eb init` and `eb create` from `backend` is easiest.

4. **Set environment variables in EB**:
   ```bash
   eb setenv ANIMA_EMAIL=your-email@example.com ANIMA_PASSWORD=your-password PORT=8080
   ```
   EB typically exposes the app on port 8080 (or 80 via proxy); set `PORT=8080` if EB expects 8080.

5. **Expose `/api/*`**  
   EB with Docker platform exposes the container port (e.g. 5001 or 8080). Configure the **Environment type** so the process listens on `process.env.PORT` (our app does). EB’s default process listens on 8080; our Dockerfile uses `PORT=5001`. Either:
   - Set `PORT=8080` in EB env and in Dockerfile (`ENV PORT=8080`), or  
   - Keep `PORT=5001` and in EB Console → Configuration → Software → Environment properties add `PORT=5001`, and under **Load balancer** ensure the listener forwards to the same port.

   After deploy, the EB URL will serve the app; e.g. `https://your-env.region.elasticbeanstalk.com/api/health`, `/api/clone-stream`, etc.

6. **Deploy**:
   ```bash
   eb deploy
   ```

7. **Cost**  
   Single instance (e.g. t3.micro or t3.small) + minimal ALB: usually **~$15–25/month** depending on region and instance type. Use **t3.micro** (free tier eligible for 12 months) to minimize cost.

---

## 3. Option B: ECS Fargate (serverless containers) — no EC2 to manage

Fargate runs your container without managing servers. Slightly more setup than EB, but scales to zero if you use scheduled tasks; for a 24/7 API, cost is similar to a small EC2.

### Steps (high level)

1. **Build and push image to ECR**:
   ```bash
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
   aws ecr create-repository --repository-name clone-backend --region us-east-1
   docker build -t clone-backend ./backend
   docker tag clone-backend:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/clone-backend:latest
   docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/clone-backend:latest
   ```

2. **Create ECS cluster** (Fargate):
   - ECS → Clusters → Create cluster (Fargate, no EC2).

3. **Task definition**:
   - Fargate, 0.25 vCPU, 0.5 GB (or 1 GB if Playwright needs more memory).
   - Container: image = `YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/clone-backend:latest`.
   - Port: 5001 (or 8080); set **Environment**: `PORT=5001`, `ANIMA_EMAIL`, `ANIMA_PASSWORD`.
   - **Linux parameters** (for Chromium): add:
     - `"init": true`
     - Or in **Container definition** → **Advanced** → **Extra host**: not required; for `--ipc=host` you’d use host network mode (not supported on Fargate). Fargate runs without `--ipc=host`; if you see Chromium issues, try increasing memory to 1 GB.

4. **Service**:
   - Create service: 1 task, Application Load Balancer, target group on port 5001 (or 8080), path `/api/*` or `/` for health.

5. **ALB**:
   - Listener (e.g. 80/443) → forward to target group (port 5001 or 8080).  
   Your API base URL will be the ALB DNS (or a custom domain).

6. **Cost**  
   ~0.25 vCPU + 0.5 GB, 24/7: **~$15–20/month** plus ALB. Use 0.25 vCPU / 0.5 GB to minimize cost; increase if Playwright is unstable.

---

## 4. Environment variables (all options)

| Variable           | Required | Description                                      |
|--------------------|----------|--------------------------------------------------|
| `PORT`             | No       | Server port (default 5001). EB often uses 8080. |
| `ANIMA_EMAIL`      | Yes*     | Anima login email (*when login is required).    |
| `ANIMA_PASSWORD`   | Yes*     | Anima login password.                           |
| `NODE_ENV`         | No       | Set to `production` on AWS.                     |

Optional: `PLAYWRIGHT_HEADED=1` only for local debugging (do not use in cloud).

---

## 5. Endpoints to expose

- **Health**: `GET /api/health`
- **Clone (streaming)**: `GET /api/clone-stream?url=<url>&prompt=<optional>`
- **Clone (redirect)**: `POST /api/clone` (body: `{ "url": "..." }`)
- **Screenshots**: `GET /screenshots/*` (static files)

Ensure your ALB/EB listener forwards to the container port (5001 or 8080) and that security groups allow inbound traffic on that port from the ALB.

---

## 6. Minimizing cost

- **Elastic Beanstalk**: Use **t3.micro** (free tier for 12 months), single instance, no RDS/ElastiCache unless needed.
- **ECS Fargate**: Use **0.25 vCPU, 0.5 GB** (or 1 GB if needed); single task.
- **No** multi-AZ or extra instances until you need HA.
- Consider **AWS Free Tier** (12 months): t2.micro/t3.micro, 750 h/month Fargate (limited).

---

## 7. Playwright in Docker / AWS

- The app detects Docker via `DOCKER=1` (set in Dockerfile) or `/.dockerenv`. In Docker it runs Playwright **headless** with Chromium args (`--no-sandbox`, `--disable-setuid-sandbox`, `--disable-dev-shm-usage`, etc.).
- **Locally** (no Docker): browser runs **headful** by default; set `PLAYWRIGHT_HEADED=0` in `.env` for headless.
- **No `slowMo`** in Docker; `slowMo` is used only when running headful locally.
- Browsers are provided by the **Playwright Docker image** (`mcr.microsoft.com/playwright:v1.58.1-jammy`); no need to install browsers on the host.
- If you upgrade `playwright` in `package.json`, update the Docker image tag in `Dockerfile` to the same version (e.g. `v1.XX.0-jammy`).

---

## 8. Quick checklist

- [ ] `ANIMA_EMAIL` and `ANIMA_PASSWORD` set in AWS (EB env or ECS task env).
- [ ] `PORT` matches what the platform expects (8080 for EB default, or 5001 if you configured it).
- [ ] Health check: `GET /api/health` returns 200.
- [ ] ALB/EB forwards to the container port.
- [ ] Docker image tag in `Dockerfile` matches Playwright version in `package.json`.
