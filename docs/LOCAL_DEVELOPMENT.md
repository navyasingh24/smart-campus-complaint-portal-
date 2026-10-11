# Local Development on macOS

Everything in this guide works **without any cloud account**. Deployment to Render is covered in [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md).

## 1. Install the required software

1. **Homebrew** (package manager), from https://brew.sh:
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
2. **Git and Node.js:**
   ```bash
   brew install git node@24
   brew link --overwrite node@24
   node -v    # must print v22.x or newer (v24 recommended)
   npm -v
   ```
3. **Docker Desktop** for Mac: https://www.docker.com/products/docker-desktop/
   (choose Apple Silicon or Intel). Start it once and wait until it shows "Engine running".
   ```bash
   docker --version
   docker compose version
   ```
4. A code editor, for example Visual Studio Code.

## 2. Get the project

```bash
mkdir -p ~/projects && cd ~/projects
git clone https://github.com/<your-username>/<your-repo>.git smart-campus-complaint-portal
cd smart-campus-complaint-portal
```

(If you are starting from an empty folder instead, copy the repository files
into it and run `git init`.)

## 3. Configure environment variables

Local and production configuration are kept apart:

| File | Used by | Committed? |
| --- | --- | --- |
| `backend/.env.example` | Template for local backend settings | Yes |
| `backend/.env` | Your local backend settings (`DB_DRIVER=local`, `COOKIE_SECURE=false`) | **No** (git-ignored) |
| `.env.example` / `.env` | `JWT_SECRET` for `docker compose` | Template only |
| Render environment variables (`render.yaml` + dashboard) | Production settings (`COOKIE_SECURE=true`, generated `JWT_SECRET`, admin email/password) | Set in Render, never in Git |

```bash
cd backend
cp .env.example .env
# Put a random secret into .env (macOS sed needs the empty '' after -i):
sed -i '' "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" .env
cat .env
```

## 4. Install dependencies

```bash
cd ~/projects/smart-campus-complaint-portal/backend && npm install
cd ../frontend && npm install
```

## 5. Start the backend (Terminal 1)

```bash
cd ~/projects/smart-campus-complaint-portal/backend
npm run dev
```

You should see a JSON log line like
`{"level":"info","message":"server started","port":8080,...,"database":"local"}`.
`npm run dev` restarts automatically when you save a backend file. Data is
stored in `backend/data/local-db.json` and survives restarts (delete the file to
start fresh).

## 6. Start the frontend (Terminal 2)

```bash
cd ~/projects/smart-campus-complaint-portal/frontend
npm run dev
```

Open http://localhost:5173. Vite forwards every `/api` request to
http://localhost:8080, so the browser sees one origin.

## 7. Create an administrator (Terminal 3)

```bash
cd ~/projects/smart-campus-complaint-portal/backend
read -rs -p "Admin password: " ADMIN_PASSWORD; export ADMIN_PASSWORD; echo
ADMIN_NAME="Campus Admin" ADMIN_EMAIL=admin@example.edu npm run create-admin
unset ADMIN_PASSWORD
```

Then register a student in the browser, submit complaints, log out, log in as
the admin and update statuses.

## 8. Run the automated tests

```bash
cd backend
npm test                 # all tests
npm run test:coverage    # with a coverage report in backend/coverage/lcov-report/index.html
npx jest tests/admin.test.js   # a single file
```

See [TESTING.md](TESTING.md) for how to read the output.

## 9. Test the APIs manually

```bash
curl http://localhost:8080/api/health
curl http://localhost:8080/api/health/ready
```

More examples are in [API.md](API.md#trying-the-api-with-curl). You can also use
Postman or Thunder Client (VS Code): send JSON bodies and keep cookies enabled.

## 10. Run with Docker

### Option A: the production image alone (local JSON database)

```bash
cd ~/projects/smart-campus-complaint-portal
docker build -t smart-campus:local .
docker run --rm -p 8080:8080 \
  -e NODE_ENV=production -e DB_DRIVER=local -e COOKIE_SECURE=false \
  -e LOCAL_DB_FILE=/app/data/db.json \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -v smart-campus-data:/app/data \
  smart-campus:local
```

Open http://localhost:8080 (Express now serves the built React app). Stop with
`Ctrl+C`. The named volume `smart-campus-data` keeps the data.

### Option B: Docker Compose with DynamoDB Local (tests the DynamoDB adapter)

```bash
cd ~/projects/smart-campus-complaint-portal
echo "JWT_SECRET=$(openssl rand -hex 32)" > .env     # once
docker compose up --build                             # add -d to run in background
```

This starts DynamoDB Local, creates the tables and indexes, then starts the app
on http://localhost:8080 using the **real DynamoDB code**. Create an admin:

```bash
read -rs -p "Admin password: " ADMIN_PASSWORD; export ADMIN_PASSWORD; echo
docker compose exec -e ADMIN_NAME="Campus Admin" -e ADMIN_EMAIL=admin@example.edu \
  -e ADMIN_PASSWORD app node scripts/create-admin.js
```

Useful commands:

```bash
docker compose logs -f app       # follow application logs
docker compose down              # stop (data is kept in the dynamodb-data volume)
docker compose down -v           # stop AND delete the local database
docker compose up --build        # rebuild after code changes
```

Never pass real AWS keys into these containers; the dummy keys in
`docker-compose.yml` only satisfy DynamoDB Local.

## 11. Troubleshooting

| Problem | Fix |
| --- | --- |
| `EADDRINUSE: address already in use :::8080` | Another process uses the port: `lsof -i :8080` then `kill <PID>`, or stop the Docker container. On macOS, AirPlay Receiver uses port 5000 (not used here) |
| Frontend shows "Cannot reach the server" | The backend is not running in Terminal 1, or it is on a different port than the Vite proxy (8080) |
| Logged out after every backend restart | `JWT_SECRET` is missing from `backend/.env`, so a random one is generated each start |
| Login works but you are immediately logged out | `COOKIE_SECURE=true` over plain HTTP: set it to `false` locally |
| `npm ERR! engine` / syntax errors | Node.js is older than 22: `node -v`, then `brew upgrade node@24` |
| `Cannot connect to the Docker daemon` | Start Docker Desktop and wait for "Engine running" |
| `docker compose` says `JWT_SECRET` is missing | Create `.env` in the repository root (step 10B) |
| `create-tables` exits with `ECONNREFUSED` once | Normal: DynamoDB Local was still starting; Compose restarts it automatically |
| Apple Silicon image warnings | The images used are multi-architecture; update Docker Desktop if you see `exec format error` |
| Tests fail with `429` | The rate limit is relaxed automatically in tests; make sure you run them with `npm test` (sets `NODE_ENV=test`) |
| Want a clean local database | Delete `backend/data/local-db.json` (JSON mode) or run `docker compose down -v` |
